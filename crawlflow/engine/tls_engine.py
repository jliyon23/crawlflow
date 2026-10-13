"""TLS engine: Chrome-like client for sites that block the standard crawler."""

from __future__ import annotations

import asyncio
import random
import time
from collections import defaultdict
from typing import Any, Awaitable, Callable
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

from curl_cffi.const import CurlHttpVersion
from curl_cffi.requests import AsyncSession

from crawlflow.engine.http import Fetch, Page
from crawlflow.engine.spider import OutputItem, WorkflowSpider, static_hosts
from crawlflow.models.workflow import CrawlSettings, Workflow

RETRY_STATUSES = {429, 500, 502, 503, 520}
Fetcher = Callable[[Fetch], Awaitable[Page]]


def session_options(settings: CrawlSettings) -> dict[str, Any]:
    version = CurlHttpVersion.V2_0 if settings.tls_http_version == "h2" else CurlHttpVersion.V1_1
    return {
        "impersonate": settings.tls_impersonate,
        "default_headers": settings.tls_default_headers,
        "verify": settings.tls_verify,
        "http_version": version,
    }


def _allowed(workflow: Workflow, url: str) -> bool:
    domains = workflow.settings.allowed_domains or static_hosts(workflow) or []
    if not domains:
        return True
    host = (urlparse(url).hostname or "").lower()
    return any(host == domain or host.endswith("." + domain) for domain in domains)


class TlsCrawl:
    def __init__(self, workflow: Workflow, status_path: str | None = None):
        self.workflow = workflow
        self.settings = workflow.settings
        self.spider = WorkflowSpider(workflow=workflow)
        self.results: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self.pages = 0
        self.items = 0
        self.reason = "finished"
        self._status_path = status_path
        self._seen: set[str] = set()
        self._robots: dict[str, RobotFileParser | None] = {}
        self._host_locks: dict[str, asyncio.Lock] = {}
        self._last_fetch: dict[str, float] = {}
        self._queue: asyncio.Queue[Fetch | None] = asyncio.Queue()
        self._pending = 0
        self._worker_count = 1
        self._global = asyncio.Semaphore(max(1, self.settings.concurrent_requests))
        self._domains: dict[str, asyncio.Semaphore] = defaultdict(
            lambda: asyncio.Semaphore(max(1, self.settings.concurrent_requests_per_domain))
        )

    def publish(self) -> None:
        if not self._status_path:
            return
        from pathlib import Path
        import json

        Path(self._status_path).write_text(json.dumps({"pages": self.pages, "items": self.items}))

    def _accept(self, fetch: Fetch) -> bool:
        if self.settings.max_pages and self.pages >= self.settings.max_pages:
            self.reason = "closespider_pagecount"
            return False
        if self.settings.max_items and self.items >= self.settings.max_items:
            self.reason = "closespider_itemcount"
            return False
        if self.settings.max_depth is not None and fetch.depth > self.settings.max_depth:
            return False
        if not _allowed(self.workflow, fetch.url):
            self.spider._note(fetch.node_id, "warnings", f"Skipped {fetch.url}: outside allowed domains")
            return False
        if not fetch.dont_filter and fetch.url in self._seen:
            return False
        self._seen.add(fetch.url)
        return True

    def enqueue(self, fetch: Fetch) -> None:
        if not self._accept(fetch):
            return
        self._pending += 1
        self._queue.put_nowait(fetch)

    def _collect(self, item: Any) -> None:
        if isinstance(item, Fetch):
            self.enqueue(item)
            return
        if isinstance(item, OutputItem):
            payload = dict(item)
            node_id = payload.pop("_cf_output", None)
            self.results[node_id or "_default"].append(payload)
            self.items += 1
            self.publish()

    def seed(self) -> None:
        for node in self.workflow.nodes:
            if node.type != "input":
                continue
            for item in self.spider._enter(node, {}, None):
                self._collect(item)
    async def _pause(self, host: str) -> None:
        delay = self.settings.download_delay or 0
        if delay <= 0:
            return
        if self.settings.randomize_download_delay:
            delay = random.uniform(delay * 0.5, delay * 1.5)
        lock = self._host_locks.setdefault(host, asyncio.Lock())
        async with lock:
            wait = delay - (time.monotonic() - self._last_fetch.get(host, 0))
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_fetch[host] = time.monotonic()

    async def _robots_allow(self, session: AsyncSession, url: str, headers: dict[str, str]) -> bool:
        if not self.settings.robots_txt:
            return True
        host = urlparse(url).hostname or ""
        if host not in self._robots:
            parsed = urlparse(url)
            robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
            parser = RobotFileParser()
            try:
                response = await session.get(robots_url, headers=headers, timeout=self.settings.download_timeout)
                parser.parse(response.text.splitlines())
                self._robots[host] = parser
            except Exception:
                self._robots[host] = None
        parser = self._robots[host]
        if parser is None:
            return True
        return parser.can_fetch(self.settings.user_agent or "*", url)

    async def _download(self, session: AsyncSession, fetch: Fetch) -> Page | None:
        headers = dict(fetch.headers)
        if self.settings.user_agent:
            headers.setdefault("User-Agent", self.settings.user_agent)
        host = urlparse(fetch.url).hostname or ""
        if not await self._robots_allow(session, fetch.url, headers):
            self.spider._note(fetch.node_id, "warnings", f"Skipped {fetch.url}: disallowed by robots.txt")
            return None
        await self._pause(host)
        last_error = "request failed"
        for attempt in range(self.settings.retry_times + 1):
            try:
                response = await session.request(
                    fetch.method,
                    fetch.url,
                    headers=headers or None,
                    cookies=(fetch.cookies or None) if self.settings.cookies_enabled else None,
                    data=fetch.body,
                    proxy=fetch.proxy,
                    timeout=self.settings.download_timeout,
                )
            except Exception as exc:
                last_error = f"{type(exc).__name__}: {exc}"
                continue
            if not self.settings.cookies_enabled:
                session.cookies.clear()
            if response.status_code in RETRY_STATUSES and attempt < self.settings.retry_times:
                last_error = f"HTTP {response.status_code}"
                continue
            page = Page(
                url=str(response.url),
                status=response.status_code,
                text=response.text,
                headers={k: v for k, v in response.headers.items()},
            )
            self.pages += 1
            self.publish()
            if page.status == 404:
                self.spider._note(fetch.node_id, "errors", f"{fetch.method} {fetch.url}: HTTP 404")
                return None
            if page.status != 200:
                self.spider._note(fetch.node_id, "errors", f"{fetch.method} {fetch.url}: HTTP {page.status}")
                return None
            return page
        self.spider._note(fetch.node_id, "errors", f"{fetch.method} {fetch.url}: {last_error}")
        return None

    async def _worker(self, session: AsyncSession) -> None:
        while True:
            fetch = await self._queue.get()
            if fetch is None:
                return
            host = urlparse(fetch.url).hostname or ""
            try:
                async with self._global, self._domains[host]:
                    page = await self._download(session, fetch)
                if page is not None:
                    for item in self.spider.continue_after(fetch.node_id, fetch.ctx, page):
                        self._collect(item)
            finally:
                self._pending -= 1
                if self._pending == 0:
                    for _ in range(self._worker_count):
                        self._queue.put_nowait(None)

    async def run(self) -> None:
        self.publish()
        self.seed()
        self._worker_count = max(1, self.settings.concurrent_requests)
        if self._pending == 0:
            for _ in range(self._worker_count):
                self._queue.put_nowait(None)
        options = session_options(self.settings)
        async with AsyncSession(**options) as session:
            workers = [asyncio.create_task(self._worker(session)) for _ in range(self._worker_count)]
            await asyncio.gather(*workers)


def run_tls(workflow: Workflow, status_path: str | None = None) -> tuple[dict[str, list[dict[str, Any]]], dict, str]:
    crawl = TlsCrawl(workflow, status_path)
    asyncio.run(crawl.run())
    return crawl.results, crawl.spider.report, crawl.reason
