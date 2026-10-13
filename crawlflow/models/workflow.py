from __future__ import annotations

import copy
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


NodeType = Literal[
    "input",
    "request",
    "parser",
    "pagination",
    "loop",
    "follow",
    "branch",
    "output",
]

LEGACY_TYPES = {"start": "input", "extract": "parser", "store": "output"}


class Position(BaseModel):
    x: float = 0
    y: float = 0


class ExtractField(BaseModel):
    """One named output of a parser.

    For HTML parsers `selector` is CSS/XPath; for JSON parsers it is a JSONPath
    relative to the record. Either may instead be a `{{template}}`.
    """

    name: str
    selector: str = ""
    selector_type: Literal["css", "xpath", "jsonpath"] = "css"
    extract: Literal["text", "attr", "html"] = "text"
    attr: str | None = None
    multiple: bool = False
    regex: str | None = None
    default: str | None = None


class NodeData(BaseModel):
    model_config = ConfigDict(extra="allow")

    label: str | None = None

    # input
    input_mode: Literal["single", "list", "table", "range"] = "single"
    variables: dict[str, str] = Field(default_factory=dict)
    list_var: str = "value"
    values: list[str] = Field(default_factory=list)
    table: str = ""
    range_var: str = "page"
    range_start: int = 1
    range_end: int = 1
    range_step: int = 1
    urls: list[str] = Field(default_factory=list)

    # request
    url: str | None = None
    method: str = "GET"
    params: dict[str, str] = Field(default_factory=dict)
    headers: dict[str, str] = Field(default_factory=dict)
    cookies: dict[str, str] = Field(default_factory=dict)
    body_type: Literal["none", "raw", "json", "form"] = "none"
    body: str | None = None
    form: dict[str, str] = Field(default_factory=dict)
    proxy: str | None = None
    dont_filter: bool = False

    # parser
    parser_type: Literal["html", "json"] = "html"
    source: str | None = None
    item_selector: str | None = None
    item_selector_type: Literal["css", "xpath"] = "css"
    record_path: str | None = None
    fields: list[ExtractField] = Field(default_factory=list)
    keep_empty: bool = False
    sample: str | None = None

    # follow
    link_selector: str = "a"
    link_attr: str = "href"
    allow: str | None = None
    deny: str | None = None

    # pagination
    pagination_type: Literal["next_link", "page_param", "json_next", "increment"] = "next_link"
    next_selector: str | None = ".next a"
    next_selector_type: Literal["css", "xpath"] = "css"
    next_path: str | None = None
    cursor_var: str | None = None
    page_param: str = "page"
    page_var: str = "page"
    page_start: int = 1
    page_step: int = 1
    page_end: int | None = None
    max_pages: int | None = 20
    stop_selector: str | None = None
    stop_selector_type: Literal["css", "xpath", "jsonpath"] = "css"

    # loop
    loop_var: str = ""
    item_var: str = "item"

    # branch
    field: str | None = None
    operator: Literal["exists", "equals", "contains", "gt", "lt", "regex"] = "exists"
    value: str | None = None

    # output
    format: Literal["jsonl", "json", "csv"] = "jsonl"
    path: str = "output/output.jsonl"
    columns: list[str] = Field(default_factory=list)
    dedupe_key: str | None = None


class FlowNode(BaseModel):
    id: str
    type: NodeType
    position: Position = Field(default_factory=Position)
    data: NodeData = Field(default_factory=NodeData)


class FlowEdge(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    source: str
    target: str
    source_handle: str | None = Field(default=None, alias="sourceHandle")
    target_handle: str | None = Field(default=None, alias="targetHandle")


class CrawlSettings(BaseModel):
    engine: Literal["standard", "tls"] = "standard"
    tls_impersonate: Literal["chrome", "safari", "firefox", "edge"] = "chrome"
    tls_default_headers: bool = True
    tls_http_version: Literal["h2", "h1"] = "h2"
    tls_verify: bool = True
    user_agent: str = "Crawlflow/0.1 (+https://github.com/local/crawlflow)"
    headers: dict[str, str] = Field(default_factory=dict)
    cookies: dict[str, str] = Field(default_factory=dict)
    proxy: str | None = None
    concurrent_requests: int = 8
    concurrent_requests_per_domain: int = 4
    download_delay: float = 0.5
    randomize_download_delay: bool = True
    robots_txt: bool = True
    cookies_enabled: bool = True
    retry_times: int = 2
    download_timeout: int = 30
    autothrottle: bool = False
    http_cache: bool = False
    allowed_domains: list[str] = Field(default_factory=list)
    max_pages: int | None = 50
    max_items: int | None = 500
    max_depth: int | None = None
    dont_filter: bool = False


class Workflow(BaseModel):
    id: str = "workflow"
    name: str = "Untitled"
    settings: CrawlSettings = Field(default_factory=CrawlSettings)
    variables: dict[str, str] = Field(default_factory=dict)
    nodes: list[FlowNode]
    edges: list[FlowEdge]


def migrate_legacy(payload: dict[str, Any]) -> dict[str, Any]:
    """Rewrite pre-pipeline node types (start/extract/store) into the current model."""
    data = copy.deepcopy(payload)
    for node in data.get("nodes", []):
        old = node.get("type")
        if old not in LEGACY_TYPES:
            continue
        node["type"] = LEGACY_TYPES[old]
        nd = node.setdefault("data", {})
        if old == "start":
            urls = [u for u in nd.pop("urls", []) if u]
            if len(urls) == 1:
                nd.update(input_mode="single", url=urls[0])
            else:
                nd.update(input_mode="list", list_var="url", values=urls)
        elif old == "extract":
            nd.setdefault("parser_type", "html")
    return data


def workflow_from_obj(payload: dict[str, Any]) -> Workflow:
    return Workflow.model_validate(migrate_legacy(payload))
