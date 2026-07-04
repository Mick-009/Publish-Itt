import { useState, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import LoadingState from "@/components/LoadingState";
import { worldbuildingApi } from "@/lib/api";
import CanvasToolbar from "./CanvasToolbar";

export default function WorldbuildingCanvas({ projectId }) {
  const [nodes, , onNodesChange] = useNodesState([]);
  const [edges, , onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        // Parallel fetch — visit 4 will map itemsRes.data → nodes,
        // visit 5 will map connsRes.data → edges.
        await Promise.all([
          worldbuildingApi.getItems(projectId),
          worldbuildingApi.getConnections(projectId),
        ]);
      } catch {
        if (!cancelled) toast.error("Couldn't load the canvas. Try again?");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return (
      <LoadingState
        size="page"
        title="Opening the canvas."
        testId="loading-worldbuilding-canvas"
      />
    );
  }

  return (
    // ReactFlowProvider makes useReactFlow() and useViewport() available
    // to CanvasToolbar, which is a sibling to <ReactFlow> in this tree.
    <ReactFlowProvider>
      <div className="relative h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          zoomOnScroll={false}
          panOnScroll={true}
          proOptions={{ hideAttribution: false }}
          fitView
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="hsl(var(--border))"
          />
        </ReactFlow>

        {/* Empty-canvas hint — pointer-events-none so it never blocks pan/drag */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-muted-foreground select-none">
              This is where your world lives. Add a card, or ask Thad to read a chapter.
            </p>
          </div>
        )}

        <CanvasToolbar />
      </div>
    </ReactFlowProvider>
  );
}
