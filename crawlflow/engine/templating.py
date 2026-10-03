"""`{{variable}}` substitution used by every configurable string in a workflow.

Supported forms:
  {{zipcode}}            plain variable
  {{store.address.city}} dotted lookup into nested dicts / lists
  {{page|1}}             default when the variable is missing or empty
"""

from __future__ import annotations

import json
import re
from typing import Any, Iterable

TEMPLATE_RE = re.compile(r"\{\{\s*([A-Za-z_][\w.\-]*)\s*(?:\|\s*([^}]*?)\s*)?\}\}")

_MISSING = MISSING = object()


def is_missing(value: Any) -> bool:
    return value is _MISSING


def lookup(ctx: dict[str, Any], name: str) -> Any:
    if name in ctx:
        return ctx[name]
    current: Any = ctx
    for part in name.split("."):
        if isinstance(current, dict) and part in current:
            current = current[part]
        elif isinstance(current, list) and part.lstrip("-").isdigit():
            idx = int(part)
            if -len(current) <= idx < len(current):
                current = current[idx]
            else:
                return _MISSING
        else:
            return _MISSING
    return current


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def render(template: str | None, ctx: dict[str, Any], missing: set[str] | None = None) -> str:
    if not template:
        return ""
    if "{{" not in template:
        return template

    def sub(match: re.Match[str]) -> str:
        name, default = match.group(1), match.group(2)
        value = lookup(ctx, name)
        if value is _MISSING or value in (None, ""):
            if default is not None:
                return default
            if missing is not None:
                missing.add(name)
            return ""
        return _stringify(value)

    return TEMPLATE_RE.sub(sub, template)


def render_map(mapping: dict[str, str] | None, ctx: dict[str, Any], missing: set[str] | None = None) -> dict[str, str]:
    out: dict[str, str] = {}
    for key, value in (mapping or {}).items():
        k = render(key, ctx, missing).strip()
        if k:
            out[k] = render(value, ctx, missing)
    return out


def referenced(template: str | None) -> Iterable[str]:
    for match in TEMPLATE_RE.finditer(template or ""):
        if match.group(2) is None:
            yield match.group(1).split(".")[0]


def is_template(value: str | None) -> bool:
    return bool(value) and TEMPLATE_RE.search(value or "") is not None
