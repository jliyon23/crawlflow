import { useState } from "react";
import { PanelLeft, PanelRight } from "lucide-react";
import "@xyflow/react/dist/style.css";
import Inspector from "./inspector/Inspector";
import ResultsPanel from "./results/ResultsPanel";
import FlowCanvas from "./components/FlowCanvas";
import Header from "./components/Header";
import Palette from "./components/Palette";
import { useWorkflowEditor } from "./hooks/useWorkflowEditor";
import { RunContext } from "./canvas/nodes";

export default function App() {
  const editor = useWorkflowEditor();
  const [showPalette, setShowPalette] = useState(true);
  const [showInspector, setShowInspector] = useState(true);

  return (
    <RunContext.Provider value={editor.report?.nodes || {}}>
      <div className="app">
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
        <div className={`body${showPalette ? "" : " hide-palette"}${showInspector ? "" : " hide-inspector"}`}>
          <Palette onAdd={editor.addNode} />
          <div className="canvas-wrap">
            <button
              type="button"
              className="sidebar-toggle left"
              aria-pressed={showPalette}
              title={showPalette ? "Hide nodes" : "Show nodes"}
              onClick={() => setShowPalette((v) => !v)}
            >
              <PanelLeft size={16} />
            </button>
            <button
              type="button"
              className="sidebar-toggle right"
              aria-pressed={showInspector}
              title={showInspector ? "Hide inspector" : "Show inspector"}
              onClick={() => setShowInspector((v) => !v)}
            >
              <PanelRight size={16} />
            </button>
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
          <Inspector
            settings={editor.settings}
            onSettings={editor.setSettings}
            globals={editor.globals}
            onGlobals={editor.setGlobals}
            problems={editor.problems}
            selected={editor.selected}
            onNodeData={(data) =>
              editor.setNodes((ns) => ns.map((n) => (n.id === editor.selectedId ? { ...n, data } : n)))
            }
            onDelete={editor.deleteSelected}
          />
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
            <button type="button" className="results-toggle" onClick={() => editor.setShowResults(true)}>
              Show results
            </button>
          )
        )}
      </div>
    </RunContext.Provider>
  );
}
