"""PDF text extraction and chunking for the traffic-accident RAG.

Why pypdf:
- pure Python, no native deps, fine for text-PDF (도로교통법 정부 PDF는 텍스트 레이어 보유).
- 스캔본이라면 OCR이 필요. 본 PoC에서는 텍스트 PDF를 가정한다.

Chunking strategy:
- 한국 법령 PDF는 ``제N조`` 단위로 의미 단락이 명확하므로 ``제N조(...)``
  헤더로 1차 분할.
- 분할 결과가 ``max_chars`` 보다 길면 줄바꿈 경계에서 추가 분할 (오버랩 포함).
- 너무 짧은 조각(< ``min_chars``)은 다음 조각과 병합.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader

logger = logging.getLogger(__name__)

# ``제1조`` / ``제 1 조의2`` 패턴. 줄 시작에서만 매칭해야 본문 인용을 자르지 않음.
ARTICLE_HEADER = re.compile(r"(?m)^\s*(제\s*\d+\s*조(?:의\s*\d+)?)\s*\(([^)]+)\)")


@dataclass(frozen=True)
class Chunk:
    """A single chunk ready for embedding."""

    chunk_id: str  # stable id, e.g. "law-art-12-0"
    article_no: str  # "제12조" or "제12조의2" or "preamble"
    article_title: str  # 괄호 안 제목, 없으면 ""
    text: str  # 청크 본문 (조 헤더 포함)
    source: str  # 원본 파일명 (basename)
    page_hint: int | None  # 첫 등장 페이지 (1-indexed). 알 수 없으면 None.


def _read_pdf_pages(pdf_path: Path) -> list[str]:
    reader = PdfReader(str(pdf_path))
    pages: list[str] = []
    for i, page in enumerate(reader.pages):
        try:
            pages.append(page.extract_text() or "")
        except Exception:  # pypdf may raise on malformed pages
            logger.warning("Failed to extract page %d from %s", i + 1, pdf_path)
            pages.append("")
    return pages


def _normalize(text: str) -> str:
    """Light cleanup: drop hard hyphenation artifacts and excessive whitespace."""
    # 한국 법령 PDF 추출본은 줄 끝에서 단어가 잘리는 경우가 드물지만, 페이지
    # 헤더/푸터(예: "도로교통법 [시행 ...]")는 자주 끼어든다. 본 PoC에서는
    # 공격적인 클리닝 대신 빈 줄 정리만 한다.
    text = text.replace("\u00ad", "")  # soft hyphen
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _split_by_articles(full_text: str) -> list[tuple[str, str, str]]:
    """Split into (article_no, article_title, body) tuples.

    Body includes the header line so the chunk is self-describing when fed to
    the LLM later.
    """
    matches = list(ARTICLE_HEADER.finditer(full_text))
    if not matches:
        return [("preamble", "", full_text)]

    sections: list[tuple[str, str, str]] = []

    # 본문 시작 ~ 첫 매치 이전 -> preamble
    if matches[0].start() > 0:
        head = full_text[: matches[0].start()].strip()
        if head:
            sections.append(("preamble", "", head))

    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(full_text)
        article_no = re.sub(r"\s+", "", m.group(1))  # "제 12 조" -> "제12조"
        article_title = m.group(2).strip()
        body = full_text[start:end].strip()
        sections.append((article_no, article_title, body))

    return sections


def _split_long(body: str, *, max_chars: int, overlap: int) -> list[str]:
    """Split a long article body into pieces no longer than max_chars.

    Splits at line boundaries when possible to keep clauses (① ② ③ ...) intact.
    """
    if len(body) <= max_chars:
        return [body]

    pieces: list[str] = []
    cursor = 0
    while cursor < len(body):
        end = min(cursor + max_chars, len(body))
        if end < len(body):
            # 줄바꿈에서 자르려고 시도
            nl = body.rfind("\n", cursor, end)
            if nl > cursor + max_chars // 2:
                end = nl
        pieces.append(body[cursor:end].strip())
        if end >= len(body):
            break
        cursor = max(end - overlap, cursor + 1)
    return [p for p in pieces if p]


def load_chunks(
    pdf_path: Path,
    *,
    max_chars: int = 1200,
    min_chars: int = 200,
    overlap: int = 150,
) -> list[Chunk]:
    """Load and chunk a legal-text PDF into RAG-ready chunks.

    Args:
        pdf_path: Path to the source PDF.
        max_chars: Hard cap on chunk length in characters. 1200자는 한국어
            기준 약 600~800 토큰 수준이라 임베딩/생성 모델 입력에 안전.
        min_chars: 너무 짧은 조각은 다음 청크와 병합한다.
        overlap: 긴 조를 분할할 때 인접 청크 간 문자 오버랩.

    Returns:
        List of Chunk objects in document order.
    """
    pdf_path = pdf_path.expanduser().resolve()
    if not pdf_path.is_file():
        raise FileNotFoundError(pdf_path)

    pages = _read_pdf_pages(pdf_path)
    full_text = _normalize("\n".join(pages))

    # 페이지 힌트: 각 청크 첫 글자가 어느 페이지에서 시작했는지 추적
    # (대략적이지만 출처 표기에는 충분)
    page_offsets: list[int] = []
    running = 0
    for p in pages:
        page_offsets.append(running)
        running += len(_normalize(p)) + 1  # +1 for joining newline

    def _page_for_offset(offset: int) -> int | None:
        if not page_offsets:
            return None
        for idx in range(len(page_offsets) - 1, -1, -1):
            if offset >= page_offsets[idx]:
                return idx + 1
        return 1

    raw_sections = _split_by_articles(full_text)

    chunks: list[Chunk] = []
    pending: tuple[str, str, list[str]] | None = None  # (no, title, [bodies])

    source_name = pdf_path.name

    def _flush_pending() -> None:
        nonlocal pending
        if pending is None:
            return
        no, title, bodies = pending
        merged = "\n".join(bodies).strip()
        if not merged:
            pending = None
            return
        # 위치 추정: merged의 첫 글자 = 첫 body의 시작
        offset = full_text.find(bodies[0])
        page_hint = _page_for_offset(offset) if offset >= 0 else None
        for idx, piece in enumerate(_split_long(merged, max_chars=max_chars, overlap=overlap)):
            chunks.append(
                Chunk(
                    chunk_id=f"{source_name}::{no}::{idx}",
                    article_no=no,
                    article_title=title,
                    text=piece,
                    source=source_name,
                    page_hint=page_hint,
                )
            )
        pending = None

    for no, title, body in raw_sections:
        if len(body) < min_chars and no != "preamble":
            # 짧은 조는 직전 청크와 병합 시도
            if pending is None:
                pending = (no, title, [body])
            else:
                pending[2].append(body)
            continue
        _flush_pending()
        pending = (no, title, [body])
        _flush_pending()

    _flush_pending()

    logger.info(
        "Loaded %d chunks from %s (pages=%d, chars=%d)",
        len(chunks),
        source_name,
        len(pages),
        len(full_text),
    )
    return chunks
