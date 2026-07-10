import { createContext } from "react";

// Consumed by ConnectionEdge to access label-editing and deletion callbacks
// without threading functions through edge data (which triggers excess rerenders).
export const EdgeActionsContext = createContext({
  editingEdgeId: null,
  startEdit: () => {},
  saveLabel: () => {},
  cancelEdit: () => {},
  deleteEdge: () => {},
});
