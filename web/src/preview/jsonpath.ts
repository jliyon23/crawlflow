// JSONPath subset mirroring crawlflow/jsonpath.py:
// $, .key, ['key'], [0], [-1], [*], .*, ..key, [a:b]. Paths without `$` are relative.

export type Segment = string | number;

type Token =
  | { kind: "key"; key: string }
  | { kind: "index"; index: number }
  | { kind: "wild" }
  | { kind: "slice"; start: number | null; end: number | null }
  | { kind: "recurse"; key: string };

const TOKEN_RE =
  /^(?:\.\.([A-Za-z_$][\w$-]*|\*)|\.([A-Za-z_$@][\w$\-@]*|\*)|\[\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*\]|\[\s*(-?\d+)\s*\]|\[\s*(\*)\s*\]|\[\s*(-?\d*\s*:\s*-?\d*)\s*\])/;

export function parse(path: string): Token[] {
  let expr = (path || "").trim();
  if (!expr || expr === "$") return [];
  if (expr.startsWith("$") || expr.startsWith("@")) expr = expr.slice(1);
  else if (!expr.startsWith(".") && !expr.startsWith("[")) expr = "." + expr;
  const tokens: Token[] = [];
  while (expr.length) {
    const m = TOKEN_RE.exec(expr);
    if (!m) throw new Error(`Unsupported JSONPath near "${expr}"`);
    if (m[1] !== undefined) tokens.push({ kind: "recurse", key: m[1] });
    else if (m[2] !== undefined) tokens.push(m[2] === "*" ? { kind: "wild" } : { kind: "key", key: m[2] });
    else if (m[3] !== undefined) tokens.push({ kind: "key", key: m[3].slice(1, -1).replace(/\\(.)/g, "$1") });
    else if (m[4] !== undefined) tokens.push({ kind: "index", index: Number(m[4]) });
    else if (m[5] !== undefined) tokens.push({ kind: "wild" });
    else {
      const [a, b] = m[6].split(":").map((s) => s.trim());
      tokens.push({ kind: "slice", start: a ? Number(a) : null, end: b ? Number(b) : null });
    }
    expr = expr.slice(m[0].length);
  }
  return tokens;
}

export type Match = { value: unknown; path: Segment[] };

function children(m: Match): Match[] {
  const v = m.value;
  if (Array.isArray(v)) return v.map((x, i) => ({ value: x, path: [...m.path, i] }));
  if (v && typeof v === "object")
    return Object.entries(v as Record<string, unknown>).map(([k, x]) => ({ value: x, path: [...m.path, k] }));
  return [];
}

function descendants(m: Match): Match[] {
  return [m, ...children(m).flatMap(descendants)];
}

export function findWithPaths(data: unknown, path: string): Match[] {
  let current: Match[] = [{ value: data, path: [] }];
  for (const tok of parse(path)) {
    const next: Match[] = [];
    for (const m of current) {
      const v = m.value;
      if (tok.kind === "key") {
        if (v && typeof v === "object" && !Array.isArray(v) && tok.key in (v as object))
          next.push({ value: (v as Record<string, unknown>)[tok.key], path: [...m.path, tok.key] });
      } else if (tok.kind === "index") {
        if (Array.isArray(v) && tok.index >= -v.length && tok.index < v.length) {
          const i = tok.index < 0 ? v.length + tok.index : tok.index;
          next.push({ value: v[i], path: [...m.path, i] });
        }
      } else if (tok.kind === "wild") {
        next.push(...children(m));
      } else if (tok.kind === "slice") {
        if (Array.isArray(v)) {
          const len = v.length;
          const norm = (n: number | null, d: number) => (n === null ? d : n < 0 ? Math.max(len + n, 0) : Math.min(n, len));
          for (let i = norm(tok.start, 0); i < norm(tok.end, len); i++) next.push({ value: v[i], path: [...m.path, i] });
        }
      } else {
        for (const d of descendants(m)) {
          if (tok.key === "*") next.push(...children(d));
          else if (d.value && typeof d.value === "object" && !Array.isArray(d.value) && tok.key in (d.value as object))
            next.push({ value: (d.value as Record<string, unknown>)[tok.key], path: [...d.path, tok.key] });
        }
      }
    }
    current = next;
  }
  return current;
}

export function find(data: unknown, path: string): unknown[] {
  return findWithPaths(data, path).map((m) => m.value);
}

export function tryFind(data: unknown, path: string): { values: unknown[]; error?: string } {
  try {
    return { values: find(data, path) };
  } catch (err) {
    return { values: [], error: (err as Error).message };
  }
}

export function toPath(segments: Segment[]): string {
  return (
    "$" +
    segments
      .map((s) =>
        typeof s === "number" ? `[${s}]` : /^[A-Za-z_$][\w$-]*$/.test(s) ? `.${s}` : `['${s.replace(/'/g, "\\'")}']`,
      )
      .join("")
  );
}

export function samePath(a: Segment[], b: Segment[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

/** Path of the record containing `segments`, if it is inside one of `records`. */
export function recordFor(segments: Segment[], records: Match[]): Match | undefined {
  return records
    .filter((r) => r.path.length <= segments.length && r.path.every((s, i) => s === segments[i]))
    .sort((a, b) => b.path.length - a.path.length)[0];
}

/** Turn a clicked node into a record selector: arrays → [*], array items → their siblings. */
export function asRecordSelector(segments: Segment[], value: unknown): string {
  if (Array.isArray(value)) return toPath(segments) + "[*]";
  const last = segments[segments.length - 1];
  if (typeof last === "number") return toPath(segments.slice(0, -1)) + "[*]";
  return toPath(segments);
}
