from __future__ import annotations

import csv
import io
import json
from pathlib import Path
from typing import Any

from scrapy import signals
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings

from crawlflow.models.workflow import FlowNode, Workflow
from crawlflow.engine.spider import WorkflowSpider

REPORT_ITEMS = 200


def scrapy_settings(workflow: Workflow) -> dict[str, Any]:
    s = workflow.settings
    settings: dict[str, Any] = {
        "BOT_NAME": "crawlflow",
        "ROBOTSTXT_OBEY": s.robots_txt,
        "USER_AGENT": s.user_agent,
        "CONCURRENT_REQUESTS": s.concurrent_requests,
        "CONCURRENT_REQUESTS_PER_DOMAIN": s.concurrent_requests_per_domain,
        "DOWNLOAD_DELAY": s.download_delay,
        "RANDOMIZE_DOWNLOAD_DELAY": False,
        "DOWNLOAD_DELAY_JITTER": 0.5 if s.randomize_download_delay else 0,
        "COOKIES_ENABLED": s.cookies_enabled,
        "RETRY_TIMES": s.retry_times,
        "DOWNLOAD_TIMEOUT": s.download_timeout,
        "AUTOTHROTTLE_ENABLED": s.autothrottle,
        "HTTPCACHE_ENABLED": s.http_cache,
        "DEFAULT_REQUEST_HEADERS": {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.9,*/*;q=0.8",
            "Accept-Language": "en",
        },
        "TELNETCONSOLE_ENABLED": False,
        "LOG_LEVEL": "INFO",
        "ITEM_PIPELINES": {"crawlflow.engine.runtime.OutputPipeline": 100},
    }
    if s.max_pages:
        settings["CLOSESPIDER_PAGECOUNT"] = s.max_pages
    if s.max_items:
        settings["CLOSESPIDER_ITEMCOUNT"] = s.max_items
    if s.max_depth:
        settings["DEPTH_LIMIT"] = s.max_depth
    return settings


def _cell(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return value


def render_output(node: FlowNode, records: list[dict[str, Any]]) -> str:
    fmt = node.data.format
    if fmt == "json":
        return json.dumps(records, ensure_ascii=False, indent=2)
    if fmt == "csv":
        columns: list[str] = [c.partition("=")[0].strip() for c in node.data.columns if c.strip()]
        if not columns:
            for record in records:
                columns.extend(k for k in record if not str(k).startswith("_cf") and k not in columns)
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        for record in records:
            writer.writerow({k: _cell(record.get(k)) for k in columns})
        return buffer.getvalue()
    return "".join(json.dumps(record, ensure_ascii=False) + "\n" for record in records)


def write_output(node: FlowNode, records: list[dict[str, Any]], path: Path) -> str:
    text = render_output(node, records)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return text


class OutputPipeline:
    """Groups items by Output node and writes each node's file when the crawl ends."""

    paths: dict[str, Path] = {}
    results: dict[str, list[dict[str, Any]]] = {}

    def process_item(self, item):
        payload = dict(item)
        node_id = payload.pop("_cf_output", None)
        OutputPipeline.results.setdefault(node_id or "_default", []).append(payload)
        return item


def output_paths(workflow: Workflow, override: str | None) -> dict[str, Path]:
    outputs = [n for n in workflow.nodes if n.type == "output"]
    paths: dict[str, Path] = {}
    for i, node in enumerate(outputs):
        raw = override if (override and i == 0) else node.data.path or f"output/{node.id}.{node.data.format}"
        paths[node.id] = Path(raw)
    return paths


def run_workflow(
    workflow: Workflow,
    output_path: str | None = None,
    report_path: str | None = None,
) -> dict[str, list[dict[str, Any]]]:
    OutputPipeline.results = {}
    paths = output_paths(workflow, output_path)
    settings = get_project_settings()
    for key, value in scrapy_settings(workflow).items():
        settings.set(key, value, priority="cmdline")
    process = CrawlerProcess(settings)
    crawler = process.create_crawler(WorkflowSpider)
    state: dict[str, Any] = {}

    def on_closed(spider, reason):
        state["report"] = spider.report
        state["reason"] = reason

    crawler.signals.connect(on_closed, signal=signals.spider_closed)
    process.crawl(crawler, workflow=workflow)
    process.start()

    results = OutputPipeline.results
    nodes = {n.id: n for n in workflow.nodes}
    files: dict[str, str] = {}
    for node_id, path in paths.items():
        files[node_id] = write_output(nodes[node_id], results.get(node_id, []), path)

    if report_path:
        report = {
            "reason": state.get("reason"),
            "nodes": state.get("report", {}),
            "outputs": {
                node_id: {
                    "path": path.name,
                    "filename": path.name,
                    "format": nodes[node_id].data.format,
                    "count": len(results.get(node_id, [])),
                    "items": results.get(node_id, [])[:REPORT_ITEMS],
                    "content": files.get(node_id, ""),
                }
                for node_id, path in paths.items()
            },
        }
        Path(report_path).write_text(json.dumps(report, ensure_ascii=False, default=str))
    return results
