import { useState } from "react";
import { PanelLeft, PanelRight, Play, Settings, Trash2, Workflow } from "lucide-react";
import "@xyflow/react/dist/style.css";
import Inspector, { SettingsForm } from "./inspector/Inspector";
import ResultsPanel from "./results/ResultsPanel";
import FlowCanvas from "./components/FlowCanvas";
import Header from "./components/Header";
import Palette from "./components/Palette";
import { useWorkflowEditor } from "./hooks/useWorkflowEditor";
import { formScope } from "./ui";
import { RunContext } from "./canvas/nodes";

export default function App() {
  const editor = useWorkflowEditor();
  const [section, setSection] = useState<"flow" | "settings">("flow");
  const [showNodes, setShowNodes] = useState(true);
  const [showInspector, setShowInspector] = useState(true);

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
          <div className={`shrink-0 overflow-hidden transition-[width] duration-200 ease-out ${section === "flow" && showNodes ? "w-[248px]" : "w-0"}`}>
            <Palette onAdd={editor.addNode} onCollapse={() => setShowNodes(false)} />
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
                  <button type="button" className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-coral px-4 py-2 text-sm font-bold text-[#1a0a08] hover:bg-[#ff8575] disabled:opacity-60" disabled={!!editor.busy} onClick={() => void editor.run(false)}>
                    <Play size={14} /> {editor.busy === "run" ? "Running…" : "Test workflow"}
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
              <div className={`shrink-0 overflow-hidden transition-[width] duration-200 ease-out ${showInspector ? "w-[360px]" : "w-0"}`}>
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
        {editor.showResults ? (
          <ResultsPanel
            report={editor.report}
            error={editor.runError}
            labels={editor.labels}
            onClose={() => editor.setShowResults(false)}
          />
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
