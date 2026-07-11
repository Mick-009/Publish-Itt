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
import { worldbuildingApi, aiApi } from "@/lib/api";
import { gridLayout } from "@/lib/canvasLayout";
import CanvasToolbar from "./CanvasToolbar";
import CardNode from "./CardNode";
import CardEditorPanel from "./CardEditorPanel";
import ConnectionEdge from "./ConnectionEdge";
import ChapterPickerModal from "./ChapterPickerModal";
import { EdgeActionsContext } from "./EdgeActionsContext";

// Stable references — must live outside the component so React Flow doesn't
// recreate renderers on every render, which collapses all nodes/edges to zero height.
const NODE_TYPES = { card: CardNode };
const EDGE_TYPES = { connection: ConnectionEdge };

export default function WorldbuildingCanvas({ projectId, project }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editingEdgeId, setEditingEdgeId] = useState(null);

  const [thadWorking, setThadWorking] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerFlowCenterRef = useRef({ x: 0, y: 0 });

  const selectedNodeIdsRef = useRef([]);
  const selectedEdgeIdsRef = useRef([]);
  const wrapperRef = useRef(null);

  // Keep a ref to current edges for stable label-save callback (avoids stale closure)
  const edgesRef = useRef(edges);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

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
        const [itemsRes, connsRes] = await Promise.all([
          worldbuildingApi.getItems(projectId),
          worldbuildingApi.getConnections(projectId),
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

        setEdges(
          connsRes.data.map((conn) => ({
            id: conn.id,
            type: "connection",
            source: conn.source_id,
            target: conn.target_id,
            data: { label: conn.label },
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
  }, [projectId, setNodes, setEdges]);

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

  // Called by CardEditorPanel after a successful delete API call.
  // alsoDeletedCount comes from the backend's also_deleted_connections field.
  const handleDeleteItem = useCallback(
    (itemId, alsoDeletedCount = 0) => {
      setNodes((nds) => nds.filter((n) => n.id !== itemId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== itemId && e.target !== itemId),
      );
      if (alsoDeletedCount > 0) {
        const noun = alsoDeletedCount === 1 ? "connection" : "connections";
        toast(`Card deleted. ${alsoDeletedCount} ${noun} went with it.`);
      } else {
        toast("Card deleted.");
      }
    },
    [setNodes, setEdges],
  );

  // ── Card creation (called by toolbar) ─────────────────────────────────────

  const handleCardCreated = useCallback(
    (newItem) => {
      setNodes((nds) => [
        ...nds,
        {
          id: newItem.id,
          type: "card",
          position: newItem.position,
          data: { item: newItem },
        },
      ]);
      setSelectedNodeId(newItem.id);
      setPanelOpen(true);
    },
    [setNodes],
  );

  // ── Connection creation ────────────────────────────────────────────────────

  const isValidConnection = useCallback(
    (conn) => conn.source !== conn.target,
    [],
  );

  const handleConnect = useCallback(
    async ({ source, target }) => {
      const tempId = `temp-${Date.now()}`;
      setEdges((eds) => [
        ...eds,
        {
          id: tempId,
          type: "connection",
          source,
          target,
          data: { label: null },
        },
      ]);

      try {
        const res = await worldbuildingApi.createConnection({
          projectId,
          sourceId: source,
          targetId: target,
        });
        const conn = res.data;
        setEdges((eds) =>
          eds.map((e) =>
            e.id === tempId
              ? { ...e, id: conn.id, data: { label: conn.label } }
              : e,
          ),
        );
      } catch (err) {
        setEdges((eds) => eds.filter((e) => e.id !== tempId));
        if (err.response?.status === 409) {
          toast("These cards are already connected.");
        } else {
          toast.error("Couldn't add that connection. Try again?");
        }
      }
    },
    [projectId, setEdges],
  );

  // ── Edge label editing ─────────────────────────────────────────────────────

  const handleSaveEdgeLabel = useCallback(
    async (edgeId, newLabel) => {
      // Capture previous label for revert (read from ref to avoid stale closure)
      const prevLabel =
        edgesRef.current.find((e) => e.id === edgeId)?.data?.label ?? null;

      setEdges((eds) =>
        eds.map((e) =>
          e.id === edgeId ? { ...e, data: { ...e.data, label: newLabel } } : e,
        ),
      );

      try {
        const res = await worldbuildingApi.updateConnection(edgeId, {
          label: newLabel,
        });
        setEdges((eds) =>
          eds.map((e) =>
            e.id === edgeId
              ? { ...e, data: { label: res.data.label } }
              : e,
          ),
        );
      } catch {
        setEdges((eds) =>
          eds.map((e) =>
            e.id === edgeId
              ? { ...e, data: { ...e.data, label: prevLabel } }
              : e,
          ),
        );
        toast.error("Couldn't save that label. Try again?");
      }
    },
    [setEdges],
  );

  // ── Edge deletion ──────────────────────────────────────────────────────────

  const handleDeleteEdge = useCallback(
    async (edgeId) => {
      const confirmed = window.confirm("Remove this connection?");
      if (!confirmed) return;
      try {
        await worldbuildingApi.deleteConnection(edgeId);
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
        setEditingEdgeId((cur) => (cur === edgeId ? null : cur));
      } catch {
        toast.error("Couldn't remove that connection. Try again?");
      }
    },
    [setEdges],
  );

  // ── Edge actions context value (stable — no `edges` dep) ──────────────────

  const edgeActionsValue = useMemo(
    () => ({
      editingEdgeId,
      startEdit: (id) => setEditingEdgeId(id),
      saveLabel: handleSaveEdgeLabel,
      cancelEdit: () => setEditingEdgeId(null),
      deleteEdge: handleDeleteEdge,
    }),
    [editingEdgeId, handleSaveEdgeLabel, handleDeleteEdge],
  );

  // ── Drag ──────────────────────────────────────────────────────────────────

  const handleNodeDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleNodeDragStop = useCallback(async (_event, node) => {
    setIsDragging(false);
    try {
      await worldbuildingApi.updateItem(node.id, { position: node.position });
    } catch {
      // Don't snap back — a jumping card is worse than an unsynced position.
      toast.error("Couldn't save that position.");
    }
  }, []);

  // ── Selection tracking (for keyboard delete) ───────────────────────────────

  const handleSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }) => {
    selectedNodeIdsRef.current = selNodes.map((n) => n.id);
    selectedEdgeIdsRef.current = (selEdges ?? []).map((e) => e.id);
  }, []);

  // ── Panel open/close ──────────────────────────────────────────────────────

  const handleNodeClick = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
    setPanelOpen(true);
    setEditingEdgeId(null);
  }, []);

  const handleEdgeClick = useCallback((_event, edge) => {
    setEditingEdgeId(edge.id);
  }, []);

  const handlePaneClick = useCallback(() => {
    setPanelOpen(false);
    setSelectedNodeId(null);
    setEditingEdgeId(null);
  }, []);

  const handlePanelClose = useCallback(() => {
    setPanelOpen(false);
    setSelectedNodeId(null);
  }, []);

  // ── Keyboard delete (nodes + edges) ───────────────────────────────────────

  const handleKeyDown = useCallback(
    async (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const nodeIds = selectedNodeIdsRef.current;
      const edgeIds = selectedEdgeIdsRef.current;

      if (nodeIds.length === 0 && edgeIds.length === 0) return;
      e.preventDefault();

      // Edges are lighter — handle first if selected
      if (edgeIds.length > 0) {
        const confirmed = window.confirm("Remove this connection?");
        if (!confirmed) return;
        for (const edgeId of edgeIds) {
          try {
            await worldbuildingApi.deleteConnection(edgeId);
          } catch {
            toast.error("Couldn't remove that connection. Try again?");
            return;
          }
        }
        setEdges((eds) => eds.filter((e) => !edgeIds.includes(e.id)));
        selectedEdgeIdsRef.current = [];
        return;
      }

      // Nodes
      if (nodeIds.length > 0) {
        const confirmed = window.confirm(
          "Delete this card? Gone for good — can't undo.",
        );
        if (!confirmed) return;

        let totalConnections = 0;
        const failed = [];
        for (const nodeId of nodeIds) {
          try {
            const res = await worldbuildingApi.deleteItem(nodeId);
            totalConnections += res.data.also_deleted_connections ?? 0;
          } catch {
            failed.push(nodeId);
          }
        }

        if (failed.length > 0) {
          toast.error("Couldn't delete that card. Try again?");
          return;
        }

        setNodes((nds) => nds.filter((n) => !nodeIds.includes(n.id)));
        setEdges((eds) =>
          eds.filter(
            (e) => !nodeIds.includes(e.source) && !nodeIds.includes(e.target),
          ),
        );
        selectedNodeIdsRef.current = [];

        if (panelOpen && nodeIds.includes(selectedNodeId)) {
          setPanelOpen(false);
          setSelectedNodeId(null);
        }

        if (totalConnections > 0) {
          const noun = totalConnections === 1 ? "connection" : "connections";
          toast(`Card deleted. ${totalConnections} ${noun} went with it.`);
        }
      }
    },
    [panelOpen, selectedNodeId, setNodes, setEdges],
  );

  // ── Canvas center (for toolbar card placement) ────────────────────────────

  const getCanvasCenter = useCallback(() => {
    if (!wrapperRef.current) return { x: 400, y: 300 };
    const rect = wrapperRef.current.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, []);

  // ── Thad extraction helpers ───────────────────────────────────────────────

  // Add a batch of canvas_items from the AI to the canvas, centered at
  // the given flow coordinate. Marks each node justArrived for the fade-in.
  const addBatchToCanvas = useCallback(
    async (canvasItems, flowCenter) => {
      if (!canvasItems?.length) return;
      const positioned = gridLayout(
        canvasItems,
        flowCenter.x,
        flowCenter.y,
      );
      try {
        const res = await worldbuildingApi.createItemsBatch(projectId, positioned);
        const created = res.data?.created ?? [];
        setNodes((nds) => [
          ...nds,
          ...created.map((item) => ({
            id: item.id,
            type: "card",
            position: item.position,
            data: { item, justArrived: true },
          })),
        ]);
        toast(`${created.length} ${created.length === 1 ? "card" : "cards"} on the canvas.`);
      } catch {
        toast.error("Couldn't add those cards. Try again?");
      }
    },
    [projectId, setNodes],
  );

  // "Summarize a chapter" — opens the chapter picker; confirmation triggers
  // the actual API call so we don't hold the server busy while the modal is open.
  const handleThadSummarize = useCallback((flowCenter) => {
    pickerFlowCenterRef.current = flowCenter;
    setPickerOpen(true);
  }, []);

  const handlePickerConfirm = useCallback(
    async (chapter) => {
      setPickerOpen(false);
      setThadWorking(true);
      const center = pickerFlowCenterRef.current;
      try {
        const res = await aiApi.summarize(
          chapter.content,
          chapter.title,
          chapter.id,
        );
        await addBatchToCanvas(res.data?.canvas_items, center);
      } catch {
        toast.error("Thad couldn't read that chapter. Try again?");
      } finally {
        setThadWorking(false);
      }
    },
    [addBatchToCanvas],
  );

  // "Outline the book" — whole-project, no picker needed.
  const handleThadOutline = useCallback(
    async (flowCenter) => {
      if (!project) {
        toast.error("No project loaded.");
        return;
      }
      setThadWorking(true);
      try {
        const res = await aiApi.generateOutline(
          project.title,
          project.summary ?? "",
          10,
        );
        await addBatchToCanvas(res.data?.canvas_items, flowCenter);
      } catch {
        toast.error("Thad couldn't outline the book. Try again?");
      } finally {
        setThadWorking(false);
      }
    },
    [project, addBatchToCanvas],
  );

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
    <ReactFlowProvider>
      <EdgeActionsContext.Provider value={edgeActionsValue}>
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
            edgeTypes={EDGE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onPaneClick={handlePaneClick}
            onNodeDragStart={handleNodeDragStart}
            onNodeDragStop={handleNodeDragStop}
            onSelectionChange={handleSelectionChange}
            isValidConnection={isValidConnection}
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

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-muted-foreground select-none">
                This is where your world lives. Add a card, or ask Thad to read
                a chapter.
              </p>
            </div>
          )}

          <CanvasToolbar
            projectId={projectId}
            onCardCreated={handleCardCreated}
            isDragging={isDragging}
            getCanvasCenter={getCanvasCenter}
            thadWorking={thadWorking}
            onSummarize={handleThadSummarize}
            onOutline={handleThadOutline}
          />

          <ChapterPickerModal
            open={pickerOpen}
            projectId={projectId}
            onConfirm={handlePickerConfirm}
            onClose={() => setPickerOpen(false)}
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
      </EdgeActionsContext.Provider>
    </ReactFlowProvider>
  );
}
