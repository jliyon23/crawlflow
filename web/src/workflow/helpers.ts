import type { Connection, Edge, Node } from "@xyflow/react";
import { PALETTE, defaultData, defaultSettings, type NodeData, type NodeType, type Workflow } from "../model/types";

export function blankWorkflow(): Workflow {
  return {
    id: "untitled",
    name: "Untitled pipeline",
    settings: defaultSettings(),
    variables: {},
    nodes: [
      { id: "input", type: "input", position: { x: 40, y: 160 }, data: defaultData("input") },
      { id: "request", type: "request", position: { x: 300, y: 160 }, data: { ...defaultData("request"), url: "{{url}}" } },
      { id: "parser", type: "parser", position: { x: 560, y: 160 }, data: defaultData("parser") },
      { id: "output", type: "output", position: { x: 820, y: 160 }, data: defaultData("output") },
    ],
    edges: [
      { id: "e1", source: "input", target: "request" },
      { id: "e2", source: "request", target: "parser" },
      { id: "e3", source: "parser", target: "output" },
    ],
  };
}

export function toRf(wf: Workflow): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: wf.nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
    edges: wf.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
      label: e.sourceHandle && e.sourceHandle !== "default" ? e.sourceHandle : undefined,
      animated: e.sourceHandle === "next",
    })),
  };
}

export function edgeFromConnection(c: Connection): Edge {
  return {
    ...c,
    id: `e-${Date.now()}`,
    source: c.source,
    target: c.target,
    label: c.sourceHandle && c.sourceHandle !== "default" ? c.sourceHandle : undefined,
    animated: c.sourceHandle === "next",
  };
}

export function groupPalette(items: typeof PALETTE) {
  const groups: Array<[string, typeof PALETTE]> = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last[0] === item.category) last[1].push(item);
    else groups.push([item.category, [item]]);
  }
  return groups;
}

export function slug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 60) || "workflow"
  );
}

export function withDefaults(wf: Partial<Workflow>): Workflow {
  return {
    id: wf.id || "workflow",
    name: wf.name || "Untitled",
    settings: { ...defaultSettings(), ...(wf.settings || {}) },
    variables: wf.variables || {},
    nodes: (wf.nodes || []).map((n) => ({ ...n, position: n.position || { x: 0, y: 0 }, data: n.data || {} })),
    edges: wf.edges || [],
  };
}

export function nextNodePosition(nodes: Node[], selectedId: string | null) {
  const anchor = nodes.find((n) => n.id === selectedId);
  const position = anchor
    ? { x: anchor.position.x + 260, y: anchor.position.y }
    : { x: 140 + nodes.length * 24, y: 80 + nodes.length * 16 };
  return { anchor, position };
}

export function newNode(type: NodeType, position: { x: number; y: number }): Node {
  return { id: `${type}-${Date.now().toString(36)}`, type, position, data: defaultData(type) };
}

export function workflowFromGraph(args: {
  workflowId: string;
  name: string;
  settings: Workflow["settings"];
  variables: Workflow["variables"];
  nodes: Node[];
  edges: Edge[];
}): Workflow {
  return {
    id: args.workflowId,
    name: args.name,
    settings: args.settings,
    variables: args.variables,
    nodes: args.nodes.map((n) => ({
      id: n.id,
      type: (n.type || "request") as NodeType,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      data: n.data as NodeData,
    })),
    edges: args.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    })),
  };
}
