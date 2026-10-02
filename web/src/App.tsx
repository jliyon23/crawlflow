import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  PALETTE,
  defaultData,
  defaultSettings,
  type CrawlSettings,
  type KeyValues,
  type NodeData,
  type NodeType,
  type RunReport,
  type Workflow,
  type WorkflowEdge,
} from "./types";
import { RunContext, nodeTypes } from "./nodes";
import Inspector from "./Inspector";
import ResultsPanel from "./ResultsPanel";
import { hasUpstream, upstreamVariables } from "./variables";

const DRAFT_KEY = "crawlflow:draft";
const DEFAULT_EXAMPLE = "store_locator";

const blankWorkflow = (): Workflow => ({
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
});

function toRf(wf: Workflow): { nodes: Node[]; edges: Edge[] } {
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

function slug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 60) || "workflow"
  );
}

function withDefaults(wf: Partial<Workflow>): Workflow {
  return {
    id: wf.id || "workflow",
    name: wf.name || "Untitled",
    settings: { ...defaultSettings(), ...(wf.settings || {}) },
    variables: wf.variables || {},
    nodes: (wf.nodes || []).map((n) => ({ ...n, position: n.position || { x: 0, y: 0 }, data: n.data || {} })),
    edges: wf.edges || [],
  };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail || body));
  return body as T;
}

type Listing = { id: string; name: string; source: "saved" | "example" };

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [settings, setSettings] = useState<CrawlSettings>(defaultSettings());
  const [globals, setGlobals] = useState<KeyValues>({});
  const [name, setName] = useState("Untitled pipeline");
  const [workflowId, setWorkflowId] = useState("untitled");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"run" | "preview" | null>(null);
  const [report, setReport] = useState<RunReport | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(true);
  const [problems, setProblems] = useState<string[]>([]);
  const [listing, setListing] = useState<Listing[]>([]);
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [fitKey, setFitKey] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    (raw: Partial<Workflow>) => {
      const wf = withDefaults(raw);
      const rf = toRf(wf);
      setNodes(rf.nodes);
      setEdges(rf.edges);
      setSettings(wf.settings);
      setGlobals(wf.variables);
      setName(wf.name);
      setWorkflowId(wf.id);
      setSelectedId(null);
      setReport(null);
      setRunError(null);
      setFitKey((k) => k + 1);
      setLoaded(true);
    },
    [setNodes, setEdges],
  );

  const refreshListing = useCallback(() => {
    api<Listing[]>("/api/workflows").then(setListing).catch(() => setListing([]));
  }, []);

  useEffect(() => {
    refreshListing();
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        load(JSON.parse(draft));
        return;
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
    api<Workflow>(`/api/examples/${DEFAULT_EXAMPLE}`)
      .then(load)
      .catch(() => load(blankWorkflow()));
  }, [load, refreshListing]);

  const workflow = useMemo<Workflow>(
    () => ({
      id: workflowId,
      name,
      settings,
      variables: globals,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: (n.type || "request") as NodeType,
        position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
        data: n.data as NodeData,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
      })),
    }),
    [workflowId, name, settings, globals, nodes, edges],
  );

  useEffect(() => {
    if (!loaded) return;
    const handle = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(workflow));
      api<{ problems: string[] }>("/api/validate", { method: "POST", body: JSON.stringify({ workflow }) })
        .then((r) => setProblems(r.problems || []))
        .catch((err: Error) => setProblems([err.message]));
    }, 600);
    return () => clearTimeout(handle);
  }, [workflow, loaded]);

  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...c,
            id: `e-${Date.now()}`,
            label: c.sourceHandle && c.sourceHandle !== "default" ? c.sourceHandle : undefined,
            animated: c.sourceHandle === "next",
          },
          eds,
        ),
      ),
    [setEdges],
  );

  const addNode = (type: NodeType) => {
    const id = `${type}-${Date.now().toString(36)}`;
    const anchor = nodes.find((n) => n.id === selectedId);
    const position = anchor
      ? { x: anchor.position.x + 260, y: anchor.position.y }
      : { x: 140 + nodes.length * 24, y: 80 + nodes.length * 16 };
    setNodes((ns) => [...ns, { id, type, position, data: defaultData(type) }]);
    if (anchor) setEdges((es) => [...es, { id: `e-${Date.now()}`, source: anchor.id, target: id }]);
    setSelectedId(id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setNodes((ns) => ns.filter((n) => n.id !== selectedId));
    setEdges((es) => es.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  };

  const run = async (preview: boolean) => {
    setBusy(preview ? "preview" : "run");
    setRunError(null);
    setShowResults(true);
    try {
      const result = await api<RunReport>("/api/run", {
        method: "POST",
        body: JSON.stringify({ workflow, preview }),
      });
      setReport({ ...result, preview });
    } catch (err) {
      setRunError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    const id = workflowId && workflowId !== "untitled" && workflowId !== "workflow" ? workflowId : slug(name);
    try {
      await api(`/api/workflows/${id}`, { method: "PUT", body: JSON.stringify({ workflow: { ...workflow, id } }) });
      setWorkflowId(id);
      setStatus(`Saved to workflows/${id}.json`);
      refreshListing();
    } catch (err) {
      setStatus(`Save failed: ${(err as Error).message}`);
    }
    setTimeout(() => setStatus(""), 3000);
  };

  const open = async (entry: string) => {
    if (!entry) return;
    if (entry === "__new") return load(blankWorkflow());
    const [source, id] = entry.split(":");
    const path = source === "example" ? `/api/examples/${id}` : `/api/workflows/${id}`;
    try {
      load(await api<Workflow>(path));
    } catch (err) {
      setStatus(`Open failed: ${(err as Error).message}`);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug(name)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      load(await api<Workflow>("/api/normalize", { method: "POST", body: JSON.stringify({ workflow: raw }) }));
    } catch (err) {
      setStatus(`Import failed: ${(err as Error).message}`);
    }
  };

  const selected = useMemo(() => {
    const node = nodes.find((n) => n.id === selectedId);
    if (!node) return null;
    const graphEdges = workflow.edges as WorkflowEdge[];
    const type = node.type as NodeType;
    const reports = report?.nodes || {};
    const upstreamRequest = hasUpstream(node.id, "request", nodes, graphEdges);
    const firstSource = graphEdges.find((e) => e.target === node.id)?.source;
    return {
      id: node.id,
      type,
      data: node.data as NodeData,
      vars: upstreamVariables(node.id, nodes, graphEdges, globals),
      report: reports[node.id],
      sampleResponse: upstreamRequest ? reports[upstreamRequest]?.response : undefined,
      sampleScope: firstSource ? reports[firstSource]?.samples?.[0] : undefined,
    };
  }, [nodes, selectedId, workflow.edges, report, globals]);

  return (
    <RunContext.Provider value={report?.nodes || {}}>
      <div className="app">
        <header>
          <div className="brand">Crawlflow</div>
          <select className="open" value="" onChange={(e) => void open(e.target.value)}>
            <option value="">Open…</option>
            <option value="__new">New blank pipeline</option>
            {listing.some((l) => l.source === "saved") && (
              <optgroup label="Saved">
                {listing
                  .filter((l) => l.source === "saved")
                  .map((l) => (
                    <option key={`s-${l.id}`} value={`saved:${l.id}`}>
                      {l.name}
                    </option>
                  ))}
              </optgroup>
            )}
            <optgroup label="Examples">
              {listing
                .filter((l) => l.source === "example")
                .map((l) => (
                  <option key={`e-${l.id}`} value={`example:${l.id}`}>
                    {l.name}
                  </option>
                ))}
            </optgroup>
          </select>
          <input className="name" value={name} onChange={(e) => setName(e.target.value)} />
          {status && <span className="status">{status}</span>}
          <button type="button" className="secondary" onClick={save}>
            Save
          </button>
          <button type="button" className="secondary" onClick={() => importRef.current?.click()}>
            Import
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            hidden
            onChange={(e) => {
              if (e.target.files?.[0]) void importJson(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <button type="button" className="secondary" onClick={exportJson}>
            Export
          </button>
          <button
            type="button"
            className="secondary accent"
            disabled={!!busy}
            title="Small capped run to fill node samples"
            onClick={() => run(true)}
          >
            {busy === "preview" ? "Previewing…" : "Preview"}
          </button>
          <button type="button" className="run" disabled={!!busy} onClick={() => run(false)}>
            {busy === "run" ? "Running…" : "Run"}
          </button>
        </header>
        <div className="body">
          <aside className="palette">
            {PALETTE.map((p) => (
              <button key={p.type} type="button" onClick={() => addNode(p.type)}>
                <strong>{p.title}</strong>
                <span>{p.hint}</span>
              </button>
            ))}
            <p className="hint palette-hint">
              With a node selected, new nodes are added and connected after it.
            </p>
          </aside>
          <div className="canvas">
            <ReactFlow
              key={fitKey}
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              onNodeClick={(_, n) => setSelectedId(n.id)}
              onPaneClick={() => setSelectedId(null)}
              onNodesDelete={(deleted) => deleted.some((n) => n.id === selectedId) && setSelectedId(null)}
              colorMode="dark"
              fitView
            >
              <Background />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </div>
          <Inspector
            settings={settings}
            onSettings={setSettings}
            globals={globals}
            onGlobals={setGlobals}
            problems={problems}
            selected={selected}
            onNodeData={(data) => setNodes((ns) => ns.map((n) => (n.id === selectedId ? { ...n, data } : n)))}
            onDelete={deleteSelected}
          />
        </div>
        {showResults ? (
          <ResultsPanel
            report={report}
            error={runError}
            labels={Object.fromEntries(nodes.map((n) => [n.id, (n.data as NodeData).label || n.id]))}
            onClose={() => setShowResults(false)}
          />
        ) : (
          (report || runError) && (
            <button type="button" className="results-toggle" onClick={() => setShowResults(true)}>
              Show results
            </button>
          )
        )}
      </div>
    </RunContext.Provider>
  );
}
