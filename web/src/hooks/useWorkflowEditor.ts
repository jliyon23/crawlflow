import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addEdge, useEdgesState, useNodesState, type Connection, type Edge, type Node } from "@xyflow/react";
import { api, type Listing } from "../api/client";
import { AUTOSAVE_MS, DEFAULT_EXAMPLE, DRAFT_KEY, JOB_KEY, NEW_PIPELINE_VALUE, POLL_MS, STATUS_CLEAR_MS } from "../constants";
import type { CrawlSettings, JobSnapshot, KeyValues, NodeData, NodeType, RunReport, Workflow, WorkflowEdge } from "../model/types";
import { defaultSettings } from "../model/types";
import { hasUpstream, upstreamVariables } from "../model/variables";
import {
  blankWorkflow,
  edgeFromConnection,
  newNode,
  nextNodePosition,
  slug,
  toRf,
  withDefaults,
  workflowFromGraph,
} from "../workflow/helpers";

export function useWorkflowEditor() {
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
  const pollRef = useRef<number | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current !== null) window.clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const applyJob = useCallback(
    (job: JobSnapshot) => {
      setReport(job);
      if (job.status === "running") {
        setBusy(job.preview ? "preview" : "run");
        return;
      }
      stopPoll();
      sessionStorage.removeItem(JOB_KEY);
      setBusy(null);
      setRunError(job.status === "failed" ? job.log || job.error || "run failed" : null);
    },
    [stopPoll],
  );

  const watch = useCallback(
    (id: string) => {
      stopPoll();
      const tick = () => {
        api<JobSnapshot>(`/api/runs/${id}`)
          .then(applyJob)
          .catch((err: Error) => {
            stopPoll();
            sessionStorage.removeItem(JOB_KEY);
            setBusy(null);
            setRunError(err.message);
          });
      };
      tick();
      pollRef.current = window.setInterval(tick, POLL_MS);
    },
    [applyJob, stopPoll],
  );

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

  useEffect(() => {
    const jobId = sessionStorage.getItem(JOB_KEY);
    if (jobId) watch(jobId);
    return stopPoll;
  }, [stopPoll, watch]);

  const workflow = useMemo(
    () => workflowFromGraph({ workflowId, name, settings, variables: globals, nodes, edges }),
    [workflowId, name, settings, globals, nodes, edges],
  );

  useEffect(() => {
    if (!loaded) return;
    const handle = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(workflow));
      api<{ problems: string[] }>("/api/validate", { method: "POST", body: JSON.stringify({ workflow }) })
        .then((r) => setProblems(r.problems || []))
        .catch((err: Error) => setProblems([err.message]));
    }, AUTOSAVE_MS);
    return () => clearTimeout(handle);
  }, [workflow, loaded]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge(edgeFromConnection(c), eds)),
    [setEdges],
  );

  const addNode = (type: NodeType) => {
    const { anchor, position } = nextNodePosition(nodes, selectedId);
    const node = newNode(type, position);
    setNodes((ns) => [...ns, node]);
    if (anchor) setEdges((es) => [...es, { id: `e-${Date.now()}`, source: anchor.id, target: node.id }]);
    setSelectedId(node.id);
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
      const created = await api<{ id: string }>("/api/runs", {
        method: "POST",
        body: JSON.stringify({ workflow, preview }),
      });
      sessionStorage.setItem(JOB_KEY, created.id);
      watch(created.id);
    } catch (err) {
      setBusy(null);
      setRunError((err as Error).message);
    }
  };

  const cancelRun = async () => {
    const id = sessionStorage.getItem(JOB_KEY);
    if (!id) return;
    try {
      applyJob(await api<JobSnapshot>(`/api/runs/${id}/cancel`, { method: "POST" }));
    } catch (err) {
      setRunError((err as Error).message);
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
    setTimeout(() => setStatus(""), STATUS_CLEAR_MS);
  };

  const open = async (entry: string) => {
    if (!entry) return;
    if (entry === NEW_PIPELINE_VALUE) return load(blankWorkflow());
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

  const labels = Object.fromEntries(nodes.map((n) => [n.id, (n.data as NodeData).label || n.id]));

  return {
    nodes,
    edges,
    settings,
    globals,
    name,
    selectedId,
    busy,
    report,
    runError,
    showResults,
    problems,
    listing,
    status,
    fitKey,
    importRef,
    selected,
    labels,
    setName,
    setSettings,
    setGlobals,
    setSelectedId,
    setShowResults,
    setNodes,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    deleteSelected,
    run,
    cancelRun,
    save,
    open,
    exportJson,
    importJson,
  };
}
