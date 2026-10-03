import type { NodeData, NodeType, WorkflowEdge } from "./types";

type GraphNode = { id: string; type?: string; data: unknown };

export type Variable = { name: string; from: string; nodeId: string };

export const TEMPLATE_RE = /\{\{\s*([A-Za-z_][\w.-]*)\s*(\|[^}]*)?\}\}/g;

export function tableHeader(table: string | undefined): string[] {
  const first = (table || "").split("\n").find((l) => l.trim());
  if (!first) return [];
  const delim = first.includes("\t") ? "\t" : first.includes(";") && !first.includes(",") ? ";" : ",";
  return first
    .split(delim)
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

export function providedVars(type: NodeType, d: NodeData): string[] {
  const statics = Object.keys(d.variables || {});
  switch (type) {
    case "input": {
      const mode = d.input_mode || "single";
      if (mode === "single") return ["url", ...statics];
      if (mode === "list") return [d.list_var || "value", ...statics];
      if (mode === "table") return [...tableHeader(d.table), ...statics];
      return [d.range_var || "page", ...statics];
    }
    case "parser":
      return (d.fields || []).map((f) => f.name).filter(Boolean);
    case "loop": {
      const v = d.item_var || "item";
      return [v, `${v}_index`];
    }
    case "pagination":
      if (d.pagination_type === "increment") return [d.page_var || "page"];
      if (d.pagination_type === "json_next" && d.cursor_var) return [d.cursor_var];
      return [];
    case "follow":
      return ["link"];
    default:
      return [];
  }
}

export function upstreamVariables(
  nodeId: string,
  nodes: GraphNode[],
  edges: WorkflowEdge[],
  globals: Record<string, string>,
): Variable[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const incoming = new Map<string, string[]>();
  for (const e of edges) incoming.set(e.target, [...(incoming.get(e.target) || []), e.source]);
  const seen = new Set<string>();
  const out = new Map<string, Variable>();
  for (const name of Object.keys(globals)) out.set(name, { name, from: "workflow", nodeId: "" });
  const stack = [...(incoming.get(nodeId) || [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (!node) continue;
    const data = node.data as NodeData;
    for (const name of providedVars(node.type as NodeType, data)) {
      if (!out.has(name)) out.set(name, { name, from: data.label || node.type || id, nodeId: id });
    }
    stack.push(...(incoming.get(id) || []));
  }
  return [...out.values()];
}

export function hasUpstream(nodeId: string, type: NodeType, nodes: GraphNode[], edges: WorkflowEdge[]): string | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const incoming = new Map<string, string[]>();
  for (const e of edges) incoming.set(e.target, [...(incoming.get(e.target) || []), e.source]);
  const stack = [...(incoming.get(nodeId) || [])];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    if (byId.get(id)?.type === type) return id;
    stack.push(...(incoming.get(id) || []));
  }
  return null;
}

export function referencedVars(...templates: Array<string | undefined | null>): string[] {
  const names = new Set<string>();
  for (const t of templates) {
    for (const m of (t || "").matchAll(TEMPLATE_RE)) {
      if (!m[2]) names.add(m[1].split(".")[0]);
    }
  }
  return [...names];
}

export function requestTemplates(d: NodeData): string[] {
  const kv = (o?: Record<string, string>) => Object.entries(o || {}).flat();
  return [d.url || "", d.body || "", d.proxy || "", ...kv(d.params), ...kv(d.headers), ...kv(d.cookies), ...kv(d.form)];
}
