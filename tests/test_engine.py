import json

from scrapy.http import HtmlResponse, Request, TextResponse

from crawlflow import jsonpath
from crawlflow.graph import check
from crawlflow.schema import FlowNode, workflow_from_obj
from crawlflow.spider import WorkflowSpider, input_contexts, parse_records
from crawlflow.templating import render

DOC = {
    "data": {
        "stores": [
            {"id": 1, "address": {"city": "Austin"}, "tags": ["a", "b"]},
            {"id": 2, "address": {"city": "Denver"}, "tags": []},
        ]
    }
}


def test_jsonpath_subset():
    assert jsonpath.find(DOC, "$.data.stores[*].id") == [1, 2]
    assert jsonpath.find(DOC, "$.data.stores[-1].address.city") == ["Denver"]
    assert jsonpath.find(DOC, "$..city") == ["Austin", "Denver"]
    assert jsonpath.find(DOC, "$['data']['stores'][0:1].id") == [1]
    assert jsonpath.find(DOC["data"]["stores"][0], "address.city") == ["Austin"]
    assert jsonpath.find(DOC, "$") == [DOC]


def test_render_variables():
    ctx = {"zipcode": "10001", "store": {"geo": {"lat": 1.5}}, "empty": ""}
    assert render("/api/{{zipcode}}?p={{page|1}}", ctx) == "/api/10001?p=1"
    assert render("{{store.geo.lat}}", ctx) == "1.5"
    missing: set[str] = set()
    assert render("{{empty}}{{nope}}", ctx, missing) == ""
    assert missing == {"empty", "nope"}


def test_input_modes():
    table = FlowNode(id="i", type="input", data={"input_mode": "table", "table": "latitude,longitude\n1,2\n3,4"})
    assert input_contexts(table, {}) == [{"latitude": "1", "longitude": "2"}, {"latitude": "3", "longitude": "4"}]
    rng = FlowNode(id="r", type="input", data={"input_mode": "range", "range_var": "p", "range_start": 1, "range_end": 3})
    assert [c["p"] for c in input_contexts(rng, {})] == [1, 2, 3]
    lst = FlowNode(id="l", type="input", data={"input_mode": "list", "list_var": "zip", "values": ["1", " ", "2"]})
    assert input_contexts(lst, {"k": "v"}) == [{"k": "v", "zip": "1"}, {"k": "v", "zip": "2"}]


def test_json_parser_maps_records():
    node = FlowNode(
        id="p",
        type="parser",
        data={
            "parser_type": "json",
            "record_path": "$.data.stores[*]",
            "fields": [
                {"name": "StoreId", "selector": "$.id"},
                {"name": "City", "selector": "$.address.city"},
                {"name": "Tags", "selector": "$.tags[*]", "multiple": True},
                {"name": "Url", "selector": "https://x/{{StoreId}}?z={{zipcode}}"},
            ],
        },
    )
    response = TextResponse("https://x/api", body=json.dumps(DOC).encode(), encoding="utf-8")
    rows = parse_records(node, {"zipcode": "10001"}, response)
    assert rows[0] == {"StoreId": 1, "City": "Austin", "Tags": ["a", "b"], "Url": "https://x/1?z=10001"}
    assert rows[1]["Tags"] == []


def test_html_parser_fields_become_variables():
    html = b'<div class="s" data-id="A1"><b>One</b></div><div class="s" data-id="B2"><b>Two</b></div>'
    node = FlowNode(
        id="p",
        type="parser",
        data={
            "parser_type": "html",
            "item_selector": ".s",
            "fields": [
                {"name": "store_id", "selector": "./@data-id", "selector_type": "xpath"},
                {"name": "name", "selector": "b"},
                {"name": "attr", "selector": "", "extract": "attr", "attr": "data-id"},
            ],
        },
    )
    rows = parse_records(node, {}, HtmlResponse("https://x/", body=html, encoding="utf-8"))
    assert rows == [
        {"store_id": "A1", "name": "One", "attr": "A1"},
        {"store_id": "B2", "name": "Two", "attr": "B2"},
    ]


def _workflow(nodes, edges, **extra):
    return workflow_from_obj({"nodes": nodes, "edges": edges, **extra})


def test_downstream_request_iterates_parser_records():
    wf = _workflow(
        [
            {"id": "in", "type": "input", "data": {"input_mode": "single", "url": "https://shop.test/search"}},
            {"id": "search", "type": "request", "data": {}},
            {"id": "ids", "type": "parser", "data": {"item_selector": "li", "fields": [{"name": "store_id", "selector": "./@id", "selector_type": "xpath"}]}},
            {"id": "detail", "type": "request", "data": {"url": "/api/store/{{store_id}}", "method": "POST", "body_type": "json", "body": '{"id": "{{store_id}}"}'}},
        ],
        [
            {"id": "a", "source": "in", "target": "search"},
            {"id": "b", "source": "search", "target": "ids"},
            {"id": "c", "source": "ids", "target": "detail"},
        ],
    )
    spider = WorkflowSpider(workflow=wf)
    first = list(spider._enter(spider.nodes["in"], {}, None))
    assert [r.url for r in first] == ["https://shop.test/search"]
    response = HtmlResponse(
        "https://shop.test/search", body=b'<ul><li id="7"></li><li id="9"></li></ul>', request=first[0], encoding="utf-8"
    )
    response.meta.update(first[0].meta)
    detail = list(spider.parse(response))
    assert [r.url for r in detail] == ["https://shop.test/api/store/7", "https://shop.test/api/store/9"]
    assert json.loads(detail[1].body) == {"id": "9"}
    assert detail[1].headers[b"Content-Type"] == b"application/json"
    assert detail[1].meta["cf_ctx"]["store_id"] == "9"


def test_increment_pagination_stops_when_empty():
    wf = _workflow(
        [
            {"id": "in", "type": "input", "data": {"input_mode": "single"}},
            {"id": "req", "type": "request", "data": {"url": "https://api.test/s?page={{page|1}}"}},
            {"id": "pg", "type": "pagination", "data": {"pagination_type": "increment", "page_var": "page", "stop_selector": "$.items[*]", "stop_selector_type": "jsonpath"}},
        ],
        [
            {"id": "a", "source": "in", "target": "req"},
            {"id": "b", "source": "req", "target": "pg"},
            {"id": "c", "source": "pg", "target": "req", "sourceHandle": "next"},
        ],
    )
    spider = WorkflowSpider(workflow=wf)
    (req,) = list(spider._enter(spider.nodes["in"], {}, None))
    assert req.url.endswith("page=1")

    def respond(request, payload):
        response = TextResponse(request.url, body=json.dumps(payload).encode(), request=request, encoding="utf-8")
        return list(spider.parse(response))

    (page2,) = respond(req, {"items": [1]})
    assert page2.url.endswith("page=2")
    assert respond(page2, {"items": []}) == []


def test_check_reports_undefined_variables():
    wf = _workflow(
        [
            {"id": "in", "type": "input", "data": {"input_mode": "list", "list_var": "zipcode", "values": ["1"]}},
            {"id": "req", "type": "request", "data": {"url": "https://x/{{zipcode}}/{{store_id}}"}},
            {"id": "out", "type": "output", "data": {}},
        ],
        [{"id": "a", "source": "in", "target": "req"}, {"id": "b", "source": "req", "target": "out"}],
    )
    problems = check(wf)
    assert any("store_id" in p and "zipcode" not in p for p in problems)


def test_legacy_workflow_migrates():
    wf = workflow_from_obj(
        {
            "nodes": [
                {"id": "s", "type": "start", "data": {"urls": ["https://a.test/"]}},
                {"id": "e", "type": "extract", "data": {"fields": []}},
                {"id": "o", "type": "store", "data": {}},
            ],
            "edges": [],
        }
    )
    assert [n.type for n in wf.nodes] == ["input", "parser", "output"]
    assert wf.nodes[0].data.url == "https://a.test/"
