import { createContext, useContext } from "react";
import type { NodeTypes } from "@xyflow/react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NodeData, NodeReport, NodeType } from "../model/types";

const SYMBOLS: Record<NodeType, string> = {
  input: "inbox",
  request: "language",
  parser: "data_object",
  pagination: "format_list_numbered",
  loop: "repeat",
  follow: "link",
  branch: "call_split",
  output: "download",
};

export const COLORS: Record<NodeType, string> = {
  input: "#3dd68c",
  request: "#6ea8fe",
  parser: "#f0c674",
  pagination: "#fb923c",
  loop: "#a3e635",
  follow: "#c084fc",
  branch: "#f472b6",
  output: "#22d3ee",
};

export function NodeGlyph({ type, box = 32, size = 20, tint = false }: { type: NodeType; box?: number; size?: number; tint?: boolean }) {
  const color = COLORS[type];
  return (
    <span
      className="grid shrink-0 place-items-center rounded-lg text-white"
      style={{ width: box, height: box, background: tint ? `${color}33` : "#242424" }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: size }} aria-hidden>
        {SYMBOLS[type]}
      </span>
    </span>
  );
}

export const RunContext = createContext<Record<string, NodeReport>>({});

export function CrawlNode({ id, data, type, selected }: NodeProps) {
  const t = (type || "request") as NodeType;
  const d = data as NodeData;
  const report = useContext(RunContext)[id];
  return (
    <div
      className={`relative min-w-[210px] max-w-[260px] rounded-[10px] border bg-[#2d2d2d] px-2.5 py-2 ${selected ? "border-white/60" : "border-[#3d3d3d]"}`}
      style={{ boxShadow: `inset 3px 0 0 ${COLORS[t]}, 0 8px 24px rgb(0 0 0 / 28%)` }}
    >
      {t !== "input" && <Handle type="target" position={Position.Left} />}
      <div className="flex items-center gap-2.5">
        <NodeGlyph type={t} box={34} tint />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] font-semibold leading-tight">{d.label || t}</span>
          <span className="truncate text-[11px] text-muted">{subtitle(t, d)}</span>
        </span>
        {report && (
          <span className={`rounded-lg px-1.5 text-[10px] ${report.errors.length ? "bg-[#1a0d0d] text-red-300" : "bg-hover text-soft"}`} title={report.errors.join("\n")}>
            {report.errors.length ? `${report.errors.length} err` : `${report.out}`}
          </span>
        )}
      </div>
      {t === "branch" ? (
        <>
          <Handle type="source" position={Position.Right} id="true" style={{ top: "35%" }} />
          <span className="pointer-events-none absolute right-[-34px] -translate-y-1/2 text-[9px] text-muted" style={{ top: "35%" }}>
            true
          </span>
          <Handle type="source" position={Position.Right} id="false" style={{ top: "70%" }} />
          <span className="pointer-events-none absolute right-[-34px] -translate-y-1/2 text-[9px] text-muted" style={{ top: "70%" }}>
            false
          </span>
        </>
      ) : t === "pagination" ? (
        <>
          <Handle type="source" position={Position.Right} id="next" />
          <span className="pointer-events-none absolute right-[-34px] -translate-y-1/2 text-[9px] text-muted" style={{ top: "50%" }}>
            next
          </span>
        </>
      ) : (
        <Handle type="source" position={Position.Right} />
      )}
    </div>
  );
}

function subtitle(type: NodeType, d: NodeData): string {
  switch (type) {
    case "input": {
      const mode = d.input_mode || "single";
      if (mode === "single") return d.url || "single run";
      if (mode === "list") return `${(d.values || []).filter((v) => v.trim()).length} × ${d.list_var || "value"}`;
      if (mode === "table") return `${Math.max(0, (d.table || "").split("\n").filter((l) => l.trim()).length - 1)} rows`;
      return `${d.range_var || "page"} ${d.range_start ?? 1}…${d.range_end ?? 1}`;
    }
    case "request":
      return `${(d.method || "GET").toUpperCase()} ${d.url || "{{url}}"}`;
    case "parser":
      return d.parser_type === "json" ? d.record_path || "$" : d.item_selector || "whole page";
    case "pagination":
      if (d.pagination_type === "increment") return `{{${d.page_var || "page"}}} += ${d.page_step ?? 1}`;
      if (d.pagination_type === "json_next") return d.next_path || "$.next";
      if (d.pagination_type === "page_param") return `?${d.page_param || "page"}=n+1`;
      return d.next_selector || "next link";
    case "loop":
      return `each ${d.loop_var || "?"} → {{${d.item_var || "item"}}}`;
    case "follow":
      return d.link_selector || "a";
    case "branch":
      return `${d.field || "field"} ${d.operator || "exists"} ${d.operator && d.operator !== "exists" ? d.value || "" : ""}`;
    case "output":
      return `${(d.format || "csv").toUpperCase()} · ${d.path || ""}`;
  }
}

export const nodeTypes: NodeTypes = Object.fromEntries(
  (Object.keys(COLORS) as NodeType[]).map((t) => [t, CrawlNode]),
) as NodeTypes;
