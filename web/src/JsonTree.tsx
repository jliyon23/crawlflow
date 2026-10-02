import { useState } from "react";
import { samePath, toPath, type Segment } from "./jsonpath";

type Props = {
  data: unknown;
  records: Segment[][];
  selected: Segment[][];
  onPick: (path: Segment[], value: unknown) => void;
};

const PAGE = 50;

export default function JsonTree({ data, records, selected, onPick }: Props) {
  return (
    <div className="json-tree">
      <TreeRow label="$" value={data} path={[]} depth={0} ctx={{ records, selected, onPick }} />
    </div>
  );
}

type Ctx = Omit<Props, "data">;

function isPrefix(prefix: Segment[], path: Segment[]) {
  return prefix.length < path.length && prefix.every((s, i) => s === path[i]);
}

function TreeRow({
  label,
  value,
  path,
  depth,
  ctx,
}: {
  label: string;
  value: unknown;
  path: Segment[];
  depth: number;
  ctx: Ctx;
}) {
  const isObj = value !== null && typeof value === "object";
  const leadsToSelection = ctx.selected.some((p) => isPrefix(path, p)) || ctx.records.some((p) => isPrefix(path, p));
  const [open, setOpen] = useState(depth < 2 || leadsToSelection);
  const [limit, setLimit] = useState(PAGE);
  const isRecord = ctx.records.some((p) => samePath(p, path));
  const isSelected = ctx.selected.some((p) => samePath(p, path));
  const entries: Array<[string, unknown, Segment]> = !isObj
    ? []
    : Array.isArray(value)
      ? value.map((v, i) => [String(i), v, i])
      : Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, v, k]);

  const pick = (e: React.MouseEvent) => {
    e.stopPropagation();
    ctx.onPick(path, value);
  };

  return (
    <div className="jt-node">
      <div
        className={`jt-row${isRecord ? " jt-record" : ""}${isSelected ? " jt-selected" : ""}`}
        style={{ paddingLeft: depth * 12 }}
        title={toPath(path)}
      >
        {isObj ? (
          <button type="button" className="jt-toggle" onClick={() => setOpen(!open)}>
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="jt-toggle" />
        )}
        <span className="jt-key" onClick={pick}>
          {label}
        </span>
        <span className="jt-colon">:</span>
        <span className={`jt-value jt-${typeOf(value)}`} onClick={pick}>
          {preview(value)}
        </span>
      </div>
      {isObj && open && (
        <>
          {entries.slice(0, limit).map(([k, v, seg]) => (
            <TreeRow key={k} label={k} value={v} path={[...path, seg]} depth={depth + 1} ctx={ctx} />
          ))}
          {entries.length > limit && (
            <button
              type="button"
              className="jt-more"
              style={{ marginLeft: (depth + 1) * 12 }}
              onClick={() => setLimit(limit + PAGE)}
            >
              show {Math.min(PAGE, entries.length - limit)} more of {entries.length - limit}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function typeOf(v: unknown) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function preview(v: unknown): string {
  if (Array.isArray(v)) return `[${v.length}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).length}}`;
  if (typeof v === "string") return JSON.stringify(v.length > 80 ? v.slice(0, 80) + "…" : v);
  return String(v);
}
