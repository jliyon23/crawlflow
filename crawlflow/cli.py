from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from crawlflow.engine.graph import check
from crawlflow.engine.runtime import run_workflow
from crawlflow.models.workflow import workflow_from_obj


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="crawlflow", description="Visual Scrapy crawler workflows")
    sub = parser.add_subparsers(dest="cmd", required=True)

    run_p = sub.add_parser("run", help="Execute a workflow JSON file")
    run_p.add_argument("workflow", type=Path)
    run_p.add_argument("-o", "--output", type=Path, default=None, help="Override the first Output node's path")
    run_p.add_argument("--report", type=Path, default=None, help="Write per-node samples and results as JSON")

    val_p = sub.add_parser("validate", help="Validate a workflow JSON file")
    val_p.add_argument("workflow", type=Path)

    serve = sub.add_parser("serve", help="Start the API + editor backend")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)

    args = parser.parse_args(argv)

    if args.cmd == "validate":
        data = json.loads(args.workflow.read_text())
        wf = workflow_from_obj(data)
        problems = check(wf)
        for problem in problems:
            print(f"WARN {problem}")
        print(f"OK  {wf.name} ({len(wf.nodes)} nodes, {len(wf.edges)} edges)")
        return 0

    if args.cmd == "run":
        data = json.loads(args.workflow.read_text())
        wf = workflow_from_obj(data)
        out = str(args.output) if args.output else None
        report = str(args.report) if args.report else None
        results = run_workflow(wf, out, report)
        total = sum(len(v) for v in results.values())
        print(f"Finished: {total} records", file=sys.stderr)
        return 0

    if args.cmd == "serve":
        import uvicorn

        uvicorn.run("crawlflow.api.app:app", host=args.host, port=args.port, reload=False)
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
