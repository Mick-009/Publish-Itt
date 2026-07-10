import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import CardNode from "./CardNode";
import CardEditorPanel from "./CardEditorPanel";

// Stable reference — must live outside the component so React Flow doesn't
// recreate node renderers on every render, which collapses all nodes.
const NODE_TYPES = { card: CardNode };

export default function WorldbuildingCanvas({ projectId }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, , onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Track selected node ids via onSelectionChange for keyboard delete
  const selectedNodeIdsRef = useRef([]);

  const wrapperRef = useRef(null);

  // ── Data loading ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [itemsRes] = await Promise.all([
          worldbuildingApi.getItems(projectId),
          worldbuildingApi.getConnections(projectId), // visit 5: map connsRes → edges
        ]);
        if (cancelled) return;
        setNodes(
          itemsRes.data.map((item) => ({
            id: item.id,
            type: "card",
            position: item.position,
            data: { item },
          })),
        );
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
  }, [projectId, setNodes]);

  // ── Node state helpers ─────────────────────────────────────────────────────

  const handleUpdateItem = useCallback(
    (itemId, updatedItem) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === itemId ? { ...n, data: { item: updatedItem } } : n,
        ),
      );
    },
    [setNodes],
  );

  const handleDeleteItem = useCallback(
    (itemId) => {
      setNodes((nds) => nds.filter((n) => n.id !== itemId));
      // visit 5: also remove edges touching this node
    },
    [setNodes],
  );

  // ── Card creation (called by toolbar) ─────────────────────────────────────

  const handleCardCreated = useCallback(
    (newItem) => {
      const newNode = {
        id: newItem.id,
        type: "card",
        position: newItem.position,
        data: { item: newItem },
      };
      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeId(newItem.id);
      setPanelOpen(true);
    },
    [setNodes],
  );

  // ── Drag ──────────────────────────────────────────────────────────────────

  const handleNodeDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleNodeDragStop = useCallback(
    async (_event, node) => {
      setIsDragging(false);
      try {
        await worldbuildingApi.updateItem(node.id, {
          position: node.position,
        });
      } catch {
        // Don't snap back — a jumping card is worse than an unsynced position.
        toast.error("Couldn't save that position.");
      }
    },
    [],
  );

  // ── Selection ─────────────────────────────────────────────────────────────

  const handleSelectionChange = useCallback(({ nodes: selNodes }) => {
    selectedNodeIdsRef.current = selNodes.map((n) => n.id);
  }, []);

  // ── Panel open/close ──────────────────────────────────────────────────────

  const handleNodeClick = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
    setPanelOpen(true);
  }, []);

  const handlePaneClick = useCallback(() => {
    setPanelOpen(false);
    setSelectedNodeId(null);
  }, []);

  const handlePanelClose = useCallback(() => {
    setPanelOpen(false);
    setSelectedNodeId(null);
  }, []);

  // ── Keyboard delete ───────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    async (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const ids = selectedNodeIdsRef.current;
      if (ids.length === 0) return;

      e.preventDefault();
      const confirmed = window.confirm(
        "Delete this card? Gone for good — can't undo.",
      );
      if (!confirmed) return;

      const failed = [];
      for (const nodeId of ids) {
        try {
          await worldbuildingApi.deleteItem(nodeId);
        } catch {
          failed.push(nodeId);
        }
      }

      if (failed.length > 0) {
        toast.error("Couldn't delete that card. Try again?");
        return;
      }

      setNodes((nds) => nds.filter((n) => !ids.includes(n.id)));
      selectedNodeIdsRef.current = [];

      if (panelOpen && ids.includes(selectedNodeId)) {
        setPanelOpen(false);
        setSelectedNodeId(null);
      }
      // visit 5: also remove edges touching deleted nodes
    },
    [panelOpen, selectedNodeId, setNodes],
  );

  // ── Canvas center (passed to toolbar for card placement) ──────────────────

  const getCanvasCenter = useCallback(() => {
    if (!wrapperRef.current) return { x: 400, y: 300 };
    const rect = wrapperRef.current.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  // ── Render ────────────────────────────────────────────────────────────────

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
      <div
        ref={wrapperRef}
        className="relative h-full outline-none"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleNodeDragStop}
          onSelectionChange={handleSelectionChange}
          deleteKeyCode={null}
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

        {/* Empty-canvas hint — disappears once any card exists */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-muted-foreground select-none">
              This is where your world lives. Add a card, or ask Thad to read a
              chapter.
            </p>
          </div>
        )}

        <CanvasToolbar
          projectId={projectId}
          onCardCreated={handleCardCreated}
          isDragging={isDragging}
          getCanvasCenter={getCanvasCenter}
        />

        {panelOpen && selectedNode && (
          <CardEditorPanel
            node={selectedNode}
            onClose={handlePanelClose}
            onUpdate={handleUpdateItem}
            onDelete={handleDeleteItem}
          />
        )}
      </div>
    </ReactFlowProvider>
  );
}
