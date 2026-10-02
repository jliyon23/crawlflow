# Crawlflow

n8n-style **visual crawler workflows**, executed by **Scrapy**.

You draw a graph (Start → Request → Extract → Pagination / Follow → Store). Crawlflow validates that graph, then runs it as a Scrapy spider: concurrent downloads, robots.txt, cookies, headers, retries, delays, proxies.

## Node palette

| Node | Role |
| --- | --- |
| **Start** | Seed URLs |
| **Request** | HTTP method, per-request headers/cookies/body |
| **Extract** | CSS / XPath item + field selectors |
| **Follow** | Link extractor (allow/deny regex) |
| **Pagination** | Next-link or `?page=` loop |
| **Branch** | Route items true/false |
| **Store** | JSON / JSONL / CSV |

Global crawl settings (user-agent, default headers & cookies, proxy, concurrency, download delay, robots.txt, retries, timeouts, autothrottle, HTTP cache, depth/page/item caps) map onto Scrapy settings.

## Quick start

```bash
cd ~/Projects/crawlflow
python3 -m venv .venv
source .venv/bin/activate
pip install -e .

crawlflow validate examples/quotes.json
crawlflow run examples/quotes.json -o output/quotes.jsonl
```

Editor + API:

```bash
crawlflow serve          # http://127.0.0.1:8000
cd web && npm install && npm run dev   # http://127.0.0.1:5173
```

The sample workflow crawls [quotes.toscrape.com](https://quotes.toscrape.com/) (a public scraping sandbox). Honor `robots.txt`, rate limits, and the site’s terms for anything else.

## How it maps to Scrapy

The canvas is **not** a chain of isolated HTTP nodes like a generic n8n scenario. It is a **spider program**:

1. Start URLs become `start_requests`.
2. Request nodes become `scrapy.Request` (headers, cookies, method, proxy via meta).
3. Extract / Follow / Pagination / Branch run in `parse` against the same response.
4. Store nodes yield items into Scrapy feeds + an in-process collector.
5. Pagination and Follow enqueue more Requests (the crawl loop).

That is why Scrapy is the engine: Twisted concurrency, middleware, robots, retries, and crawl-specific primitives instead of one HTTP call per n8n node.

## Workflow JSON

See `examples/quotes.json`. Edges may set `sourceHandle` (`next`, `true`, `false`) for pagination and branches.

## Layout

```
crawlflow/          Python package (schema, spider, CLI, FastAPI)
examples/           Sample graphs
web/                React Flow editor
```
