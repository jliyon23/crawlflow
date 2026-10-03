import { useState } from "react";
import { samePath, toPath, type Segment } from "./jsonpath";
import { cx, jsonTree } from "../ui";

type Props = {
  data: unknown;
  records: Segment[][];
  selected: Segment[][];
  onPick: (path: Segment[], value: unknown) => void;
};

const PAGE = 50;

export default function JsonTree({ data, records, selected, onPick }: Props) {
  return (
    <div className={jsonTree}>
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
        className={cx(
          "flex items-center gap-0.5 whitespace-nowrap pr-1.5 leading-[19px] hover:bg-hover",
          isRecord && "bg-[#111]",
          isSelected && "bg-[#1c1c1c]",
        )}
        style={{ paddingLeft: depth * 12 }}
        title={toPath(path)}
      >
        {isObj ? (
          <button type="button" className="inline-block w-3.5 cursor-pointer border-0 bg-transparent p-0 text-[10px] text-muted" onClick={() => setOpen(!open)}>
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="inline-block w-3.5" />
        )}
        <span className="cursor-pointer text-text hover:underline" onClick={pick}>
          {label}
        </span>
        <span className="mr-1 text-muted">:</span>
        <span className={cx("cursor-pointer overflow-hidden text-ellipsis hover:underline", valueTone(value))} onClick={pick}>
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
              className="cursor-pointer border-0 bg-transparent p-0.5 text-[11px] text-text"
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

function valueTone(v: unknown) {
  const kind = typeOf(v);
  if (kind === "string") return "text-soft";
  if (kind === "number") return "text-text";
  return "text-muted";
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
