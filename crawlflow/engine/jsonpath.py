"""Small JSONPath subset shared (in behaviour) with web/src/jsonpath.ts.

Supported: $ root, .key, ['key'], ["key"], [0], [-1], [*], .*, ..key (recursive
descent), [start:end] slices. A path without a leading `$` is treated as relative
(`address.city` == `$.address.city`). Filter expressions are not supported.
"""

from __future__ import annotations

import re
from typing import Any

_TOKEN_RE = re.compile(
    r"""
    \.\.(?P<rec>[A-Za-z_$][\w$\-]*|\*)    # ..key / ..*
  | \.(?P<key>[A-Za-z_$@][\w$\-@]*|\*)    # .key / .*
  | \[\s*(?P<q>'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*\]  # ['key']
  | \[\s*(?P<idx>-?\d+)\s*\]              # [0]
  | \[\s*(?P<star>\*)\s*\]                # [*]
  | \[\s*(?P<slice>-?\d*\s*:\s*-?\d*)\s*\]  # [1:3]
    """,
    re.VERBOSE,
)


class JSONPathError(ValueError):
    pass


def parse(path: str) -> list[tuple[str, Any]]:
    expr = (path or "").strip()
    if not expr or expr == "$":
        return []
    if expr.startswith("$"):
        expr = expr[1:]
    elif expr.startswith("@"):
        expr = expr[1:]
    elif not expr.startswith((".", "[")):
        expr = "." + expr
    tokens: list[tuple[str, Any]] = []
    pos = 0
    while pos < len(expr):
        match = _TOKEN_RE.match(expr, pos)
        if not match:
            raise JSONPathError(f"Unsupported JSONPath near {expr[pos:]!r} in {path!r}")
        if match.group("rec") is not None:
            tokens.append(("recurse", match.group("rec")))
        elif match.group("key") is not None:
            key = match.group("key")
            tokens.append(("wild", None) if key == "*" else ("key", key))
        elif match.group("q") is not None:
            raw = match.group("q")[1:-1]
            tokens.append(("key", re.sub(r"\\(.)", r"\1", raw)))
        elif match.group("idx") is not None:
            tokens.append(("index", int(match.group("idx"))))
        elif match.group("star") is not None:
            tokens.append(("wild", None))
        else:
            start, _, end = match.group("slice").partition(":")
            tokens.append(("slice", (int(start) if start.strip() else None, int(end) if end.strip() else None)))
        pos = match.end()
    return tokens


def _children(value: Any) -> list[Any]:
    if isinstance(value, dict):
        return list(value.values())
    if isinstance(value, list):
        return list(value)
    return []


def _descendants(value: Any) -> list[Any]:
    out = [value]
    for child in _children(value):
        out.extend(_descendants(child))
    return out


def find(data: Any, path: str) -> list[Any]:
    current = [data]
    for kind, arg in parse(path):
        nxt: list[Any] = []
        for value in current:
            if kind == "key":
                if isinstance(value, dict) and arg in value:
                    nxt.append(value[arg])
            elif kind == "index":
                if isinstance(value, list) and -len(value) <= arg < len(value):
                    nxt.append(value[arg])
            elif kind == "wild":
                nxt.extend(_children(value))
            elif kind == "slice":
                if isinstance(value, list):
                    nxt.extend(value[arg[0] : arg[1]])
            elif kind == "recurse":
                for node in _descendants(value):
                    if arg == "*":
                        nxt.extend(_children(node))
                    elif isinstance(node, dict) and arg in node:
                        nxt.append(node[arg])
        current = nxt
    return current


def find_first(data: Any, path: str, default: Any = None) -> Any:
    found = find(data, path)
    return found[0] if found else default
