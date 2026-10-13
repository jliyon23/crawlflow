import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { PanelLeft, PanelRight, Play, Settings, Square, Trash2, Workflow } from "lucide-react";
import "@xyflow/react/dist/style.css";
import Inspector, { SettingsForm } from "./inspector/Inspector";
import ResultsPanel from "./results/ResultsPanel";
import FlowCanvas from "./components/FlowCanvas";
import Header from "./components/Header";
import Palette from "./components/Palette";
import { useWorkflowEditor } from "./hooks/useWorkflowEditor";
import { PANEL_WIDTH_KEY } from "./constants";
import { formScope } from "./ui";
import { RunContext } from "./canvas/nodes";

type Panels = { nodes: number; inspector: number; results: number };

const DEFAULT_PANELS: Panels = { nodes: 248, inspector: 360, results: 280 };

function loadPanels(): Panels {
  try {
    const raw = JSON.parse(localStorage.getItem(PANEL_WIDTH_KEY) || "");
    return {
      nodes: clamp(raw.nodes, 180, 520, DEFAULT_PANELS.nodes),
      inspector: clamp(raw.inspector, 280, 720, DEFAULT_PANELS.inspector),
      results: clamp(raw.results, 120, 800, DEFAULT_PANELS.results),
    };
  } catch {
    return DEFAULT_PANELS;
  }
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function startResize(
  event: ReactPointerEvent<HTMLElement>,
  current: number,
  min: number,
  max: number,
  invert: boolean,
  apply: (next: number) => void,
) {
  event.preventDefault();
  const axis = event.currentTarget.getAttribute("aria-orientation") === "horizontal" ? "y" : "x";
  const origin = axis === "x" ? event.clientX : event.clientY;
  const move = (e: PointerEvent) => {
    const delta = (axis === "x" ? e.clientX : e.clientY) - origin;
    apply(clamp(current + (invert ? -delta : delta), min, max, current));
  };
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop);
}

export default function App() {
  const editor = useWorkflowEditor();
  const [section, setSection] = useState<"flow" | "settings">("flow");
  const [showNodes, setShowNodes] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [panels, setPanels] = useState<Panels>(loadPanels);

  const resize = (key: keyof Panels, min: number, max: number, invert: boolean) => (event: ReactPointerEvent<HTMLElement>) => {
    startResize(event, panels[key], min, max, invert, (next) => {
      setPanels((prev) => {
        const value = { ...prev, [key]: next };
        localStorage.setItem(PANEL_WIDTH_KEY, JSON.stringify(value));
        return value;
      });
    });
  };

  return (
    <RunContext.Provider value={editor.report?.nodes || {}}>
      <div className="flex h-full flex-col">
        <Header
          name={editor.name}
          status={editor.status}
          busy={editor.busy}
          listing={editor.listing}
          nodeCount={editor.nodes.length}
          problemCount={editor.problems.length}
          itemCount={editor.report ? editor.report.count : null}
          importRef={editor.importRef}
          onName={editor.setName}
          onOpen={(entry) => void editor.open(entry)}
          onSave={() => void editor.save()}
          onExport={editor.exportJson}
          onImport={(file) => void editor.importJson(file)}
          onRun={(preview) => void editor.run(preview)}
          onStop={() => void editor.cancelRun()}
        />
        <div className="flex min-h-0 flex-1">
          <nav className="flex w-[52px] shrink-0 flex-col items-center gap-1.5 border-r border-line bg-[#101010] py-2.5" aria-label="Sections">
            <button
              type="button"
              className={`grid h-9 w-9 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 text-muted hover:bg-hover hover:text-text ${section === "flow" ? "bg-hover text-text shadow-[inset_2px_0_0_#ff6d5a]" : ""}`}
              title="Flow editor"
              aria-pressed={section === "flow"}
              onClick={() => setSection("flow")}
            >
              <Workflow size={18} />
            </button>
            <button
              type="button"
              className={`grid h-9 w-9 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 text-muted hover:bg-hover hover:text-text ${section === "settings" ? "bg-hover text-text shadow-[inset_2px_0_0_#ff6d5a]" : ""}`}
              title="Settings"
              aria-pressed={section === "settings"}
              onClick={() => setSection("settings")}
            >
              <Settings size={18} />
            </button>
          </nav>
          <div
            className="relative shrink-0 overflow-hidden"
            style={{ width: section === "flow" && showNodes ? panels.nodes : 0 }}
          >
            <Palette onAdd={editor.addNode} onCollapse={() => setShowNodes(false)} />
            {section === "flow" && showNodes && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize nodes"
                className="absolute inset-y-0 right-0 z-20 w-1.5 cursor-col-resize hover:bg-coral/50"
                onPointerDown={resize("nodes", 180, 520, false)}
              />
            )}
          </div>
          {section === "flow" ? (
            <>
              {!showNodes && (
                <button type="button" className="grid h-12 w-[22px] shrink-0 cursor-pointer place-items-center self-center rounded-r-lg border border-l-0 border-line bg-panel p-0 text-muted hover:bg-hover hover:text-text" title="Show nodes" onClick={() => setShowNodes(true)}>
                  <PanelLeft size={15} />
                </button>
              )}
              <div className="relative min-h-0 min-w-0 flex-1">
                <div className="absolute bottom-[18px] left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
                  <button type="button" className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-coral px-4 py-2 text-sm font-bold text-[#1a0a08] hover:bg-[#ff8575]" onClick={() => void (editor.busy ? editor.cancelRun() : editor.run(false))}>
                    {editor.busy ? <Square size={14} /> : <Play size={14} />} {editor.busy ? "Stop" : "Test workflow"}
                  </button>
                  {editor.selectedId && (
                    <button type="button" className="inline-flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-lg border border-field-line bg-elevated text-soft" title="Delete node" onClick={editor.deleteSelected}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <FlowCanvas
                  fitKey={editor.fitKey}
                  nodes={editor.nodes}
                  edges={editor.edges}
                  onNodesChange={editor.onNodesChange}
                  onEdgesChange={editor.onEdgesChange}
                  onConnect={editor.onConnect}
                  onSelect={editor.setSelectedId}
                  selectedId={editor.selectedId}
                />
              </div>
              {!showInspector && (
                <button type="button" className="grid h-12 w-[22px] shrink-0 cursor-pointer place-items-center self-center rounded-l-lg border border-r-0 border-line bg-panel p-0 text-muted hover:bg-hover hover:text-text" title="Show inspector" onClick={() => setShowInspector(true)}>
                  <PanelRight size={15} />
                </button>
              )}
              <div className="relative shrink-0 overflow-hidden" style={{ width: showInspector ? panels.inspector : 0 }}>
                {showInspector && (
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize inspector"
                    className="absolute inset-y-0 left-0 z-20 w-1.5 cursor-col-resize hover:bg-coral/50"
                    onPointerDown={resize("inspector", 280, 720, true)}
                  />
                )}
                <Inspector
                  onCollapse={() => setShowInspector(false)}
                  selected={editor.selected}
                  onNodeData={(data) =>
                    editor.setNodes((ns) => ns.map((n) => (n.id === editor.selectedId ? { ...n, data } : n)))
                  }
                  onDelete={editor.deleteSelected}
                />
              </div>
            </>
          ) : (
            <main className={`min-w-0 flex-1 overflow-auto bg-bg px-5 pb-8 pt-4 [&_h2]:text-base [&>*]:max-w-[720px] ${formScope}`}>
              <SettingsForm
                settings={editor.settings}
                onChange={editor.setSettings}
                globals={editor.globals}
                onGlobals={editor.setGlobals}
                problems={editor.problems}
              />
            </main>
          )}
        </div>
        {editor.showResults && (editor.report || editor.runError) ? (
          <div className="relative shrink-0" style={{ height: panels.results }}>
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize results"
              className="absolute inset-x-0 top-0 z-20 h-1.5 cursor-row-resize hover:bg-coral/50"
              onPointerDown={resize("results", 120, Math.round(window.innerHeight * 0.75), true)}
            />
            <ResultsPanel
              report={editor.report}
              error={editor.runError}
              labels={editor.labels}
              onClose={() => editor.setShowResults(false)}
            />
          </div>
        ) : (
          (editor.report || editor.runError) && (
            <button type="button" className="fixed bottom-3 left-1/2 z-10 -translate-x-1/2 cursor-pointer rounded-md border border-field-line bg-elevated px-2.5 py-1 text-xs text-soft" onClick={() => editor.setShowResults(true)}>
              Show results
            </button>
          )
        )}
      </div>
    </RunContext.Provider>
  );
}
