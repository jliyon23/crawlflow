import { createContext, useContext } from "react";
import type { NodeTypes } from "@xyflow/react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NodeData, NodeReport, NodeType } from "./types";
import { providedVars } from "./variables";

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

export const RunContext = createContext<Record<string, NodeReport>>({});

export function CrawlNode({ id, data, type, selected }: NodeProps) {
  const t = (type || "request") as NodeType;
  const d = data as NodeData;
  const report = useContext(RunContext)[id];
  const vars = providedVars(t, d);
  return (
    <div className={`cf-node${selected ? " selected" : ""}`} style={{ borderColor: COLORS[t] }}>
      {t !== "input" && <Handle type="target" position={Position.Left} />}
      <div className="cf-node-head">
        <span className="cf-node-kind" style={{ color: COLORS[t] }}>
          {t === "parser" ? `${d.parser_type || "html"} parser` : t}
        </span>
        {report && (
          <span className={`cf-badge${report.errors.length ? " bad" : ""}`} title={report.errors.join("\n")}>
            {report.errors.length ? `${report.errors.length} err · ` : ""}
            {report.in}→{report.out}
          </span>
        )}
      </div>
      <div className="cf-node-title">{d.label || t}</div>
      <div className="cf-node-sub">{subtitle(t, d)}</div>
      {vars.length > 0 && (
        <div className="cf-node-vars">
          {vars.slice(0, 6).map((v) => (
            <span key={v}>{v}</span>
          ))}
          {vars.length > 6 && <span>+{vars.length - 6}</span>}
        </div>
      )}
      {t === "branch" ? (
        <>
          <Handle type="source" position={Position.Right} id="true" style={{ top: "35%" }} />
          <span className="handle-label" style={{ top: "35%" }}>
            true
          </span>
          <Handle type="source" position={Position.Right} id="false" style={{ top: "70%" }} />
          <span className="handle-label" style={{ top: "70%" }}>
            false
          </span>
        </>
      ) : t === "pagination" ? (
        <>
          <Handle type="source" position={Position.Right} id="next" />
          <span className="handle-label" style={{ top: "50%" }}>
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
