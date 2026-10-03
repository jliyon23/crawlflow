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
    <div className="h-full min-h-0">
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
        defaultEdgeOptions={{
          style: { stroke: "#3dd68c", strokeWidth: 2 },
          labelStyle: { fill: "#a1a1a1", fontSize: 10 },
          labelBgStyle: { fill: "#1c1c1c" },
          labelBgPadding: [4, 2],
          labelBgBorderRadius: 4,
        }}
      >
        <Background gap={20} size={1.4} color="#333333" />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
