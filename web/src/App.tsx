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

  return (
    <RunContext.Provider value={editor.report?.nodes || {}}>
      <div className="app">
        <Header
          name={editor.name}
          status={editor.status}
          busy={editor.busy}
          listing={editor.listing}
          importRef={editor.importRef}
          onName={editor.setName}
          onOpen={(entry) => void editor.open(entry)}
          onSave={() => void editor.save()}
          onExport={editor.exportJson}
          onImport={(file) => void editor.importJson(file)}
          onRun={(preview) => void editor.run(preview)}
        />
        <div className="body">
          <Palette onAdd={editor.addNode} />
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
