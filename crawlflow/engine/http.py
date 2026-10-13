"""Request spec shared by the Standard and TLS engines."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from parsel import Selector


@dataclass
class Fetch:
    method: str
    url: str
    headers: dict[str, str]
    cookies: dict[str, str]
    body: str | None
    proxy: str | None
    node_id: str
    ctx: dict[str, Any]
    dont_filter: bool = False
    depth: int = 0


@dataclass
class Page:
    """HTML or JSON body with the attributes parsers already use."""

    url: str
    status: int
    text: str
    headers: dict[str, str] = field(default_factory=dict)
    _selector: Selector | None = field(default=None, repr=False)

    def css(self, query: str):
        return self.selector.css(query)

    def xpath(self, query: str):
        return self.selector.xpath(query)

    @property
    def selector(self) -> Selector:
        if self._selector is None:
            self._selector = Selector(text=self.text, base_url=self.url)
        return self._selector
