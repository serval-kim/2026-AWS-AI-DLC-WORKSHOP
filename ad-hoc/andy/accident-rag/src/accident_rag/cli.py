"""CLI for the accident-rag package.

Subcommands:
  ingest      Chunk a PDF, embed with Titan V2, and load into OpenSearch.
  query       Embed a query, retrieve top-k chunks, ask the LLM for a verdict.
  doctor      Diagnose AWS + OpenSearch connectivity.
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import logging
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from accident_rag.ingest import ingest_pdf
from accident_rag.opensearch_store import store_from_env
from accident_rag.query import answer_query


def _add_common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--region",
        default=os.environ.get("AWS_REGION", "us-east-1"),
        help="AWS region for Bedrock and OpenSearch.",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable debug logging.",
    )


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="accident-rag",
        description="도로교통법 RAG: PDF -> Bedrock + OpenSearch -> 과실비율 verdict.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_ingest = sub.add_parser(
        "ingest",
        help="Chunk a PDF, embed with Titan V2, and load into OpenSearch.",
    )
    p_ingest.add_argument(
        "--pdf",
        type=Path,
        required=True,
        help="Source PDF path (e.g. ~/Downloads/law.pdf).",
    )
    p_ingest.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Max chunks to embed/index (default 10 for PoC).",
    )
    p_ingest.add_argument(
        "--dimensions",
        type=int,
        default=1024,
        choices=[256, 512, 1024],
        help="Titan V2 embedding dimensions (must match index).",
    )
    p_ingest.add_argument(
        "--recreate-index",
        action="store_true",
        help="Drop and recreate the OpenSearch index before ingest.",
    )
    p_ingest.add_argument(
        "--sleep-between",
        type=float,
        default=0.0,
        help="Seconds to sleep between embedding calls (throttle helper).",
    )
    _add_common(p_ingest)

    p_query = sub.add_parser(
        "query",
        help="Embed a query, retrieve top-k chunks, ask the LLM for a verdict.",
    )
    p_query.add_argument(
        "--text",
        required=True,
        help="사고 상황 자유 텍스트 (한국어).",
    )
    p_query.add_argument("--k", type=int, default=5, help="Top-k retrieval count.")
    p_query.add_argument(
        "--dimensions",
        type=int,
        default=1024,
        choices=[256, 512, 1024],
        help="Must match the index dimensions used during ingest.",
    )
    p_query.add_argument(
        "--llm-model-id",
        default=os.environ.get("RAG_LLM_MODEL_ID"),
        help="Bedrock chat model id. Defaults to Claude Haiku 4.5.",
    )
    p_query.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Write the full result JSON to this path (defaults to stdout).",
    )
    _add_common(p_query)

    p_doctor = sub.add_parser(
        "doctor",
        help="Diagnose OpenSearch connectivity and report cluster info.",
    )
    _add_common(p_doctor)

    return parser


def _require_endpoint() -> int | None:
    if not os.environ.get("OPENSEARCH_ENDPOINT"):
        print("OPENSEARCH_ENDPOINT is not set. Add it to .env.", file=sys.stderr)
        return 64
    return None


def _cmd_ingest(args: argparse.Namespace) -> int:
    rv = _require_endpoint()
    if rv is not None:
        return rv

    summary = ingest_pdf(
        pdf_path=args.pdf,
        region=args.region,
        limit=args.limit,
        dimensions=args.dimensions,
        recreate_index=args.recreate_index,
        sleep_between_embeds=args.sleep_between,
    )
    print(json.dumps(dataclasses.asdict(summary), ensure_ascii=False, indent=2))
    return 0


def _cmd_query(args: argparse.Namespace) -> int:
    rv = _require_endpoint()
    if rv is not None:
        return rv

    response = answer_query(
        query=args.text,
        region=args.region,
        k=args.k,
        dimensions=args.dimensions,
        llm_model_id=args.llm_model_id,
    )
    serialized = json.dumps(response.to_dict(), ensure_ascii=False, indent=2)
    if args.output:
        args.output.write_text(serialized, encoding="utf-8")
        print(f"Wrote result to {args.output}")
    else:
        print(serialized)
    if not response.verdict:
        print("WARN: Failed to parse verdict JSON from LLM output.", file=sys.stderr)
        return 3
    return 0


def _cmd_doctor(args: argparse.Namespace) -> int:
    rv = _require_endpoint()
    if rv is not None:
        return rv

    store = store_from_env(region=args.region, dimensions=1024)
    info = store._client.info()  # noqa: SLF001 — diagnostic, intentional
    print(json.dumps(info, ensure_ascii=False, indent=2))
    try:
        exists = store._client.indices.exists(index=store.index)  # noqa: SLF001
        print(f"index '{store.index}' exists = {exists}")
        if exists:
            count = store._client.count(index=store.index).get("count")  # noqa: SLF001
            print(f"index doc count = {count}")
    except Exception as exc:  # noqa: BLE001
        print(f"index check failed: {exc}", file=sys.stderr)
        return 4
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s | %(message)s",
    )

    if args.command == "ingest":
        return _cmd_ingest(args)
    if args.command == "query":
        return _cmd_query(args)
    if args.command == "doctor":
        return _cmd_doctor(args)
    parser.error(f"Unknown command: {args.command}")
    return 64


if __name__ == "__main__":
    raise SystemExit(main())
