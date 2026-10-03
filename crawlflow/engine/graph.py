"""Static checks on a workflow graph (mirrored by web/src/variables.ts)."""

from __future__ import annotations

from collections import defaultdict

from crawlflow.models.workflow import FlowNode, Workflow
from crawlflow.engine.spider import parse_table
from crawlflow.engine.templating import referenced

BUILTIN_VARS = {"url", "link"}


def provided_vars(node: FlowNode) -> set[str]:
    d = node.data
    if node.type == "input":
        out = set(d.variables)
        if d.input_mode == "single":
            out.add("url")
        elif d.input_mode == "list":
            out.add(d.list_var or "value")
        elif d.input_mode == "table":
            rows = parse_table(d.table)
            out.update(rows[0].keys() if rows else [])
        else:
            out.add(d.range_var or "page")
        return out
    if node.type == "parser":
        return {f.name for f in d.fields if f.name}
    if node.type == "loop":
        var = d.item_var or "item"
        return {var, f"{var}_index"}
    if node.type == "pagination":
        if d.pagination_type == "increment":
            return {d.page_var or "page"}
        if d.pagination_type == "json_next" and d.cursor_var:
            return {d.cursor_var}
    if node.type == "follow":
        return {"link"}
    return set()


def upstream_vars(workflow: Workflow) -> dict[str, set[str]]:
    incoming: dict[str, list[str]] = defaultdict(list)
    for edge in workflow.edges:
        incoming[edge.target].append(edge.source)
    nodes = {n.id: n for n in workflow.nodes}
    result: dict[str, set[str]] = {}
    for node in workflow.nodes:
        seen: set[str] = set()
        stack = list(incoming[node.id])
        available = set(workflow.variables)
        while stack:
            current = stack.pop()
            if current in seen or current not in nodes:
                continue
            seen.add(current)
            available |= provided_vars(nodes[current])
            stack.extend(incoming[current])
        result[node.id] = available
    return result


def _templates(node: FlowNode) -> list[str]:
    d = node.data
    if node.type == "request":
        return [
            d.url or "",
            d.body or "",
            d.proxy or "",
            *d.params.keys(), *d.params.values(),
            *d.headers.values(), *d.cookies.values(), *d.form.values(),
        ]
    if node.type == "parser":
        return [f.selector for f in d.fields]
    return []


def check(workflow: Workflow) -> list[str]:
    problems: list[str] = []
    nodes = {n.id: n for n in workflow.nodes}
    incoming: dict[str, list[str]] = defaultdict(list)
    for edge in workflow.edges:
        for end in (edge.source, edge.target):
            if end not in nodes:
                problems.append(f"Edge {edge.id} references unknown node {end!r}")
        incoming[edge.target].append(edge.source)
    if not any(n.type == "input" for n in workflow.nodes):
        problems.append("Workflow has no Input node")
    if not any(n.type == "output" for n in workflow.nodes):
        problems.append("Workflow has no Output node; records will not be saved")

    available = upstream_vars(workflow)
    for node in workflow.nodes:
        name = node.data.label or node.id
        if node.type != "input" and not incoming[node.id]:
            problems.append(f"{name}: not connected to any upstream node")
        if node.type in ("parser", "pagination", "follow") and not node.data.source:
            if not _has_upstream_request(node.id, incoming, nodes):
                problems.append(f"{name}: needs a Request node upstream")
        if node.type == "request" and not node.data.url and "url" not in available[node.id]:
            problems.append(f"{name}: no URL configured and no {{{{url}}}} variable upstream")
        unknown = {
            var
            for template in _templates(node)
            for var in referenced(template)
            if var not in available[node.id] and var not in BUILTIN_VARS
        }
        if unknown:
            problems.append(f"{name}: references undefined variable(s) {', '.join(sorted(unknown))}")
    return problems


def _has_upstream_request(node_id: str, incoming: dict[str, list[str]], nodes: dict[str, FlowNode]) -> bool:
    seen: set[str] = set()
    stack = list(incoming[node_id])
    while stack:
        current = stack.pop()
        if current in seen or current not in nodes:
            continue
        seen.add(current)
        if nodes[current].type == "request":
            return True
        stack.extend(incoming[current])
    return False
