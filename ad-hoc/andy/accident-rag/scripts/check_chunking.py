"""Quick sanity check: chunk law.pdf and print a summary. No AWS calls."""

from __future__ import annotations

from pathlib import Path

from accident_rag.pdf_loader import load_chunks


def main() -> None:
    pdf = Path("~/Downloads/law.pdf").expanduser()
    chunks = load_chunks(pdf)
    print(f"total_chunks: {len(chunks)}")
    for c in chunks[:5]:
        print(
            f"  - id={c.chunk_id} | art={c.article_no} | "
            f"title={c.article_title!r} | page={c.page_hint} | len={len(c.text)}"
        )
    if chunks:
        head = chunks[0].text[:240].replace("\n", " / ")
        print(f"first chunk head: {head}")
    print(f"first 100 chunk lengths min/avg/max: "
          f"{min(len(c.text) for c in chunks[:100])} / "
          f"{sum(len(c.text) for c in chunks[:100]) // max(1, min(100, len(chunks)))} / "
          f"{max(len(c.text) for c in chunks[:100])}")


if __name__ == "__main__":
    main()
