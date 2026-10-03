"""Executes a workflow graph as a Scrapy spider.

Data model: every value flowing along an edge is a *context* — a flat dict of
variables (`zipcode`, `store_id`, `Name`, ...). Input nodes create contexts,
Request nodes turn a context into an HTTP request and pass it on together with
the response, Parser nodes emit one new context per record (parent variables +
extracted fields), and Output nodes collect contexts as records. Keys starting
with `_cf` are internal and never written to outputs.
"""

from __future__ import annotations

import csv
import io
import json
import re
from collections import defaultdict
from typing import Any, Callable, Iterable
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

import scrapy
from parsel import Selector
from scrapy.http import Response, TextResponse

from crawlflow.engine import jsonpath
from crawlflow.models.workflow import ExtractField, FlowEdge, FlowNode, Workflow
from crawlflow.engine.templating import is_missing, is_template, lookup, render, render_map

SAMPLE_LIMIT = 5
RESPONSE_SAMPLE_BYTES = 300_000
DEFAULT_HANDLES = {"pagination": "next", "branch": "true"}

Emission = Any  # scrapy.Request | OutputItem | tuple[str | None, dict]


class OutputItem(dict):
    pass


def clean(ctx: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in ctx.items() if not k.startswith("_cf")}


# ---------------------------------------------------------------- inputs


def input_contexts(node: FlowNode, global_vars: dict[str, str]) -> list[dict[str, Any]]:
    d = node.data
    base: dict[str, Any] = {**global_vars}
    base.update({k: render(v, base) for k, v in d.variables.items() if k})
    mode = d.input_mode
    if mode == "single":
        url = render(d.url, base).strip()
        return [{**base, "url": url} if url else base]
    if mode == "list":
        name = (d.list_var or "value").strip()
        values = [v.strip() for v in [*d.values, *d.urls] if v and v.strip()]
        return [{**base, name: v} for v in values]
    if mode == "table":
        return [{**base, **row} for row in parse_table(d.table)]
    step = d.range_step or 1
    end = d.range_end + (1 if step > 0 else -1)
    return [{**base, d.range_var or "page": i} for i in range(d.range_start, end, step)]


def parse_table(text: str) -> list[dict[str, str]]:
    lines = [line for line in (text or "").strip().splitlines() if line.strip()]
    if not lines:
        return []
    header = lines[0]
    delimiter = "\t" if "\t" in header else ";" if ";" in header and "," not in header else ","
    reader = csv.DictReader(io.StringIO("\n".join(lines)), delimiter=delimiter)
    rows = []
    for row in reader:
        cleaned = {(k or "").strip(): (v or "").strip() for k, v in row.items() if k and k.strip()}
        if any(cleaned.values()):
            rows.append(cleaned)
    return rows


# ---------------------------------------------------------------- parsing


def _sel(target: Selector | Response, selector: str, kind: str):
    return target.xpath(selector) if kind == "xpath" else target.css(selector)


def _text_of(el: Selector) -> str:
    if isinstance(el.root, str):
        return el.root
    return " ".join(el.xpath(".//text()").getall())


def _finish(values: list[Any], field: ExtractField) -> Any:
    if field.regex:
        pat = re.compile(field.regex)
        clipped = []
        for v in values:
            m = pat.search(v if isinstance(v, str) else json.dumps(v))
            if m:
                clipped.append(m.group(1) if m.lastindex else m.group(0))
        values = clipped
    if field.multiple:
        return values
    value = values[0] if values else None
    if value in (None, "") and field.default not in (None, ""):
        return field.default
    return value


def _template_field(field: ExtractField, scope: dict[str, Any]) -> Any:
    return _finish([render(field.selector, scope)], field)


def extract_html_field(block: Selector, field: ExtractField, scope: dict[str, Any]) -> Any:
    if is_template(field.selector):
        return _template_field(field, scope)
    sel = _sel(block, field.selector, field.selector_type) if field.selector else [block]
    if field.extract == "attr" and field.attr:
        values = [el.attrib.get(field.attr, "") if not isinstance(el.root, str) else el.get() for el in sel]
    elif field.extract == "html":
        values = [el.get() or "" for el in sel]
    else:
        values = [_text_of(el) for el in sel]
    values = [re.sub(r"\s+", " ", v).strip() for v in values if v and str(v).strip()]
    return _finish(values, field)


def extract_json_field(record: Any, field: ExtractField, scope: dict[str, Any]) -> Any:
    if is_template(field.selector):
        return _template_field(field, scope)
    path = field.selector or field.name
    values = [v for v in jsonpath.find(record, path) if v is not None]
    return _finish(values, field)


def load_json(raw: Any) -> Any:
    if isinstance(raw, (dict, list)):
        return raw
    text = raw.text if isinstance(raw, TextResponse) else raw.decode() if isinstance(raw, bytes) else str(raw)
    text = text.strip()
    if text.startswith(")]}'"):
        text = text.split("\n", 1)[-1]
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        match = re.match(r"^[\w$.]+\s*\(([\s\S]*)\)\s*;?\s*$", text)
        if match:
            return json.loads(match.group(1))
        raise ValueError(f"Response is not valid JSON ({exc.msg} at char {exc.pos})") from exc


def parse_records(node: FlowNode, ctx: dict[str, Any], response: Response | None) -> list[dict[str, Any]]:
    d = node.data
    if d.source:
        raw = lookup(ctx, d.source)
        if raw is None or is_missing(raw):
            raise ValueError(f"Source variable {d.source!r} is not set")
    elif response is None:
        raise ValueError("Parser has no response: connect it after a Request node")
    else:
        raw = response

    rows: list[dict[str, Any]] = []
    if d.parser_type == "json":
        data = load_json(raw)
        records = jsonpath.find(data, d.record_path) if d.record_path else [data]
        for record in records:
            row: dict[str, Any] = {}
            base_scope = {**ctx, **(record if isinstance(record, dict) else {"value": record})}
            for field in d.fields:
                if field.name:
                    row[field.name] = extract_json_field(record, field, {**base_scope, **row})
            if not d.fields and isinstance(record, dict):
                row = dict(record)
            rows.append(row)
    else:
        if isinstance(raw, Response):
            doc: Selector | Response = raw
        else:
            doc = Selector(text=str(raw), base_url=ctx.get("_cf_base", ""))
        blocks = _sel(doc, d.item_selector, d.item_selector_type) if d.item_selector else [doc]
        for block in blocks:
            row = {}
            for field in d.fields:
                if field.name:
                    row[field.name] = extract_html_field(block, field, {**ctx, **row})
            rows.append(row)
    return rows


def extract_links(response: Response, node: FlowNode) -> list[str]:
    data = node.data
    hrefs: list[str] = []
    for el in response.css(data.link_selector or "a"):
        href = el.attrib.get(data.link_attr or "href")
        if not href:
            continue
        url = urljoin(response.url, href)
        if data.allow and not re.search(data.allow, url):
            continue
        if data.deny and re.search(data.deny, url):
            continue
        hrefs.append(url)
    return list(dict.fromkeys(hrefs))


def branch_ok(ctx: dict[str, Any], node: FlowNode) -> bool:
    data = node.data
    raw = lookup(ctx, data.field or "")
    op = data.operator
    expected = render(data.value, ctx)
    if op == "exists":
        return not is_missing(raw) and raw not in (None, "", [], {})
    if raw is None or is_missing(raw):
        return False
    text = str(raw)
    if op == "equals":
        return text == expected
    if op == "contains":
        return expected in text
    if op == "regex":
        return bool(expected and re.search(expected, text))
    try:
        num, other = float(text), float(expected or 0)
    except (TypeError, ValueError):
        return False
    return num > other if op == "gt" else num < other if op == "lt" else False


def _with_query(url: str, params: dict[str, str]) -> str:
    if not params:
        return url
    parsed = urlparse(url)
    query = parse_qsl(parsed.query, keep_blank_values=True) + list(params.items())
    return urlunparse(parsed._replace(query=urlencode(query)))


def static_hosts(workflow: Workflow) -> list[str] | None:
    """Domains reachable by the workflow, or None when any URL is variable."""
    hosts: list[str] = []
    for node in workflow.nodes:
        candidates: list[str] = []
        if node.type == "input" and node.data.input_mode == "single":
            candidates.append(node.data.url or "")
        elif node.type == "input" and node.data.input_mode == "list" and node.data.list_var == "url":
            candidates.extend(node.data.values)
        elif node.type == "input":
            continue
        elif node.type == "request":
            url = node.data.url or ""
            if url.startswith("/") and not url.startswith("//"):
                continue
            if not url or "{{" in (urlparse(url).netloc or url.split("/")[0]):
                return None
            candidates.append(url)
        elif node.type == "follow":
            return None
        for url in candidates:
            if "{{" in url:
                return None
            if url and urlparse(url).hostname:
                hosts.append(urlparse(url).hostname)
    return list(dict.fromkeys(hosts))


# ---------------------------------------------------------------- spider


class WorkflowSpider(scrapy.Spider):
    name = "crawlflow"

    def __init__(self, workflow: Workflow, **kwargs: Any):
        super().__init__(**kwargs)
        self.workflow = workflow
        self.nodes: dict[str, FlowNode] = {n.id: n for n in workflow.nodes}
        self.outgoing: dict[str, list[FlowEdge]] = defaultdict(list)
        for edge in workflow.edges:
            if edge.source in self.nodes and edge.target in self.nodes:
                self.outgoing[edge.source].append(edge)
        if workflow.settings.allowed_domains:
            self.allowed_domains = list(workflow.settings.allowed_domains)
        else:
            hosts = static_hosts(workflow)
            if hosts:
                self.allowed_domains = hosts
        self.report: dict[str, dict[str, Any]] = {
            n.id: {"in": 0, "out": 0, "samples": [], "errors": [], "warnings": []} for n in workflow.nodes
        }
        self._seen: dict[str, set[str]] = defaultdict(set)
        self._handlers: dict[str, Callable[[FlowNode, dict[str, Any], Response | None], Iterable[Emission]]] = {
            "input": self._on_input,
            "request": self._on_request,
            "parser": self._on_parser,
            "pagination": self._on_pagination,
            "loop": self._on_loop,
            "follow": self._on_follow,
            "branch": self._on_branch,
            "output": self._on_output,
        }

    # -- reporting

    def _note(self, node_id: str, kind: str, message: str) -> None:
        bucket = self.report[node_id][kind]
        if message not in bucket and len(bucket) < SAMPLE_LIMIT:
            bucket.append(message)
        if kind == "errors":
            self.logger.error("[%s] %s", node_id, message)

    def _record_response(self, node_id: str, response: Response, doc: Any = None) -> None:
        entry = self.report[node_id]
        if "response" in entry:
            return
        if doc is not None and not isinstance(doc, Response):
            body = doc if isinstance(doc, str) else json.dumps(doc, ensure_ascii=False)
            content_type = "application/json" if not isinstance(doc, str) else "text/plain"
        else:
            body = response.text if isinstance(response, TextResponse) else ""
            content_type = response.headers.get("Content-Type", b"").decode("latin-1")
        entry["response"] = {
            "url": response.url,
            "status": response.status,
            "content_type": content_type,
            "body": body[:RESPONSE_SAMPLE_BYTES],
            "truncated": len(body) > RESPONSE_SAMPLE_BYTES,
        }

    # -- graph traversal

    async def start(self):
        for node in self.workflow.nodes:
            if node.type == "input":
                for item in self._enter(node, {}, None):
                    yield item

    def parse(self, response: Response, **kwargs: Any):
        node = self.nodes[response.meta["cf_node"]]
        self._record_response(node.id, response)
        self.report[node.id]["out"] += 1
        ctx = {**response.meta.get("cf_ctx", {}), "_cf_base": response.url, "_cf_status": response.status}
        yield from self._emit(node, None, ctx, response)

    def _errback(self, failure):
        request = failure.request
        node_id = request.meta.get("cf_node")
        if node_id in self.report:
            status = getattr(getattr(failure.value, "response", None), "status", None)
            reason = f"HTTP {status}" if status else failure.getErrorMessage() or failure.type.__name__
            self._note(node_id, "errors", f"{request.method} {request.url}: {reason}")

    def _enter(self, node: FlowNode, ctx: dict[str, Any], response: Response | None):
        entry = self.report[node.id]
        entry["in"] += 1
        try:
            results = list(self._handlers[node.type](node, ctx, response))
        except Exception as exc:  # noqa: BLE001 - surfaced per node in the editor
            self._note(node.id, "errors", f"{type(exc).__name__}: {exc}")
            return
        for result in results:
            if isinstance(result, (scrapy.Request, OutputItem)):
                yield result
            else:
                handle, out_ctx = result
                yield from self._emit(node, handle, out_ctx, response)

    def _emit(self, node: FlowNode, handle: str | None, ctx: dict[str, Any], response: Response | None):
        entry = self.report[node.id]
        if node.type != "request":
            entry["out"] += 1
        if len(entry["samples"]) < SAMPLE_LIMIT:
            entry["samples"].append(clean(ctx))
        for edge in self.outgoing.get(node.id, []):
            edge_handle = edge.source_handle or DEFAULT_HANDLES.get(node.type)
            if handle is not None and edge_handle != handle:
                continue
            yield from self._enter(self.nodes[edge.target], ctx, response)

    # -- node handlers

    def _on_input(self, node, ctx, response):
        contexts = input_contexts(node, self.workflow.variables)
        if not contexts:
            self._note(node.id, "warnings", "Input produced no rows")
        return [(None, {**ctx, **c}) for c in contexts]

    def _on_request(self, node: FlowNode, ctx: dict[str, Any], response):
        d = node.data
        settings = self.workflow.settings
        ctx = dict(ctx)
        missing: set[str] = set()
        override = ctx.pop("_cf_url", None)
        if override:
            url = override
        else:
            url = render(d.url or "{{url}}", ctx, missing).strip()
            url = _with_query(url, render_map(d.params, ctx, missing))
        base = ctx.get("_cf_base")
        if base:
            url = urljoin(base, url)
        if not urlparse(url).scheme:
            raise ValueError(f"URL {url!r} is not absolute; set a full URL or a {{{{url}}}} variable")

        headers = {**render_map(settings.headers, ctx, missing), **render_map(d.headers, ctx, missing)}
        cookies = {**render_map(settings.cookies, ctx, missing), **render_map(d.cookies, ctx, missing)}
        body: str | None = None
        lower = {k.lower() for k in headers}
        if d.body_type in ("raw", "json"):
            body = render(d.body, ctx, missing)
            if d.body_type == "json":
                json.loads(body or "null")
                if "content-type" not in lower:
                    headers["Content-Type"] = "application/json"
        elif d.body_type == "form":
            body = urlencode(render_map(d.form, ctx, missing))
            if "content-type" not in lower:
                headers["Content-Type"] = "application/x-www-form-urlencoded"
        if missing:
            self._note(node.id, "warnings", f"Missing variable(s): {', '.join(sorted(missing))}")

        meta: dict[str, Any] = {"cf_node": node.id, "cf_ctx": ctx, "cookiejar": 1}
        proxy = render(d.proxy, ctx).strip() or (settings.proxy or "").strip()
        if proxy:
            meta["proxy"] = proxy
        entry = self.report[node.id]
        if "request" not in entry:
            entry["request"] = {"method": d.method.upper(), "url": url, "headers": headers, "body": body}
        yield scrapy.Request(
            url,
            method=(d.method or "GET").upper(),
            headers=headers or None,
            cookies=cookies or None,
            body=body,
            callback=self.parse,
            errback=self._errback,
            dont_filter=settings.dont_filter or d.dont_filter,
            meta=meta,
        )

    def _on_parser(self, node: FlowNode, ctx: dict[str, Any], response):
        d = node.data
        if response is not None and not d.source:
            doc = None
            if d.parser_type == "json":
                try:
                    doc = load_json(response)
                except ValueError:
                    doc = None
            self._record_response(node.id, response, doc)
        rows = parse_records(node, ctx, response)
        if not rows:
            self._note(node.id, "warnings", "No records matched")
            if d.keep_empty:
                rows = [{f.name: None for f in d.fields if f.name}]
        return [(None, {**ctx, **row}) for row in rows]

    def _on_pagination(self, node: FlowNode, ctx: dict[str, Any], response):
        d = node.data
        if response is None:
            raise ValueError("Pagination must be connected after a Request node")
        counter = f"_cf_page_{node.id}"
        page_no = int(ctx.get(counter, 1))
        if d.max_pages and page_no >= d.max_pages:
            return []
        if d.stop_selector and not self._matches(response, d.stop_selector, d.stop_selector_type):
            return []
        nxt = {k: v for k, v in ctx.items() if k not in ("_cf_url",)}
        nxt[counter] = page_no + 1
        kind = d.pagination_type

        if kind == "next_link":
            selector = d.next_selector or ".next a"
            sel = _sel(response, selector, d.next_selector_type)
            if not sel:
                return []
            el = sel[0]
            href = el.get() if isinstance(el.root, str) else el.attrib.get("href")
            if not href:
                return []
            nxt["_cf_url"] = urljoin(response.url, href.strip())
        elif kind == "page_param":
            parsed = urlparse(response.url)
            query = dict(parse_qsl(parsed.query, keep_blank_values=True))
            current = int(query.get(d.page_param) or d.page_start)
            following = current + (d.page_step or 1)
            if d.page_end is not None and following > d.page_end:
                return []
            query[d.page_param] = str(following)
            nxt["_cf_url"] = urlunparse(parsed._replace(query=urlencode(query)))
        elif kind == "json_next":
            value = jsonpath.find_first(load_json(response), d.next_path or "$.next")
            if value in (None, "", False):
                return []
            if d.cursor_var:
                nxt[d.cursor_var] = value
            else:
                nxt["_cf_url"] = urljoin(response.url, str(value))
        else:
            var = d.page_var or "page"
            current = ctx.get(var)
            current = int(current) if current not in (None, "") else d.page_start
            following = current + (d.page_step or 1)
            if d.page_end is not None and following > d.page_end:
                return []
            nxt[var] = following
        return [("next", nxt)]

    def _matches(self, response: Response, selector: str, kind: str) -> bool:
        if kind == "jsonpath":
            found = jsonpath.find(load_json(response), selector)
            return any(v not in (None, "", [], {}) for v in found)
        return bool(_sel(response, selector, kind))

    def _on_loop(self, node: FlowNode, ctx: dict[str, Any], response):
        d = node.data
        values = lookup(ctx, d.loop_var)
        if values is None or is_missing(values):
            raise ValueError(f"Loop variable {d.loop_var!r} is not set")
        if isinstance(values, str):
            try:
                values = json.loads(values)
            except json.JSONDecodeError:
                values = [v.strip() for v in values.split(",") if v.strip()]
        if not isinstance(values, list):
            values = [values]
        var = d.item_var or "item"
        return [(None, {**ctx, var: v, f"{var}_index": i}) for i, v in enumerate(values)]

    def _on_follow(self, node: FlowNode, ctx: dict[str, Any], response):
        if response is None:
            raise ValueError("Follow must be connected after a Request node")
        return [(None, {**ctx, "_cf_url": url, "link": url}) for url in extract_links(response, node)]

    def _on_branch(self, node: FlowNode, ctx: dict[str, Any], response):
        return [("true" if branch_ok(ctx, node) else "false", ctx)]

    def _on_output(self, node: FlowNode, ctx: dict[str, Any], response):
        d = node.data
        if d.columns:
            record: dict[str, Any] = {}
            for column in d.columns:
                name, _, source = column.partition("=")
                name, source = name.strip(), (source.strip() or name.strip())
                if not name:
                    continue
                value = lookup(ctx, source)
                record[name] = None if is_missing(value) else value
        else:
            record = {k: v for k, v in clean(ctx).items() if k not in self.workflow.variables}
        if d.dedupe_key:
            key = render(d.dedupe_key, ctx) if "{{" in d.dedupe_key else str(lookup(ctx, d.dedupe_key))
            if key in self._seen[node.id]:
                return []
            self._seen[node.id].add(key)
        return [OutputItem(_cf_output=node.id, **record), (None, ctx)]
