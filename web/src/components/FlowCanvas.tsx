import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node, type OnEdgesChange, type OnNodesChange, type Connection } from "@xyflow/react";
import { nodeTypes } from "../canvas/nodes";

type Props = {
  fitKey: number;
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange<Node>;
  onEdgesChange: OnEdgesChange<Edge>;
  onConnect: (c: Connection) => void;
  onSelect: (id: string | null) => void;
  selectedId: string | null;
};

export default function FlowCanvas({
  fitKey,
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onSelect,
  selectedId,
}: Props) {
  return (
    <div className="canvas">
      <ReactFlow
        key={fitKey}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n) => onSelect(n.id)}
        onPaneClick={() => onSelect(null)}
        onNodesDelete={(deleted) => deleted.some((n) => n.id === selectedId) && onSelect(null)}
        colorMode="dark"
        fitView
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
