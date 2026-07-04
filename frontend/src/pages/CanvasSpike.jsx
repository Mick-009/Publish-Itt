import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const initialNodes = [
  {
    id: "1",
    position: { x: 200, y: 200 },
    data: { label: "Character: Protagonist" },
  },
  {
    id: "2",
    position: { x: 500, y: 350 },
    data: { label: "Place: The Old Library" },
  },
];

const initialEdges = [{ id: "e1-2", source: "1", target: "2" }];

export default function CanvasSpike() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    // h-full fills <main className="flex-1 overflow-auto">
    // overflow-hidden prevents the canvas from triggering main's scroll
    <div className="h-full overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background variant="dots" gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
