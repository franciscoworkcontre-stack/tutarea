import { create } from 'zustand';
import { type Node, type Edge } from '@xyflow/react';

export type MindmapNodeData = {
  label: string;
  contentMd?: string;
  styleJsonb?: {
    fillColor?: string;
    borderColor?: string;
    shape?: 'rounded' | 'circle' | 'diamond' | 'rect';
    icon?: string;
  };
  linkedTaskId?: string | null;
  collapsedByJsonb?: string[];
  isCollapsed?: boolean;
  isEditing?: boolean;
  nodeType?: 'root' | 'child' | 'leaf';
  color?: string;
  parentNodeId?: string | null;
  orderInParent?: number;
  [key: string]: unknown;
};

type HistoryEntry = {
  nodes: Node<MindmapNodeData>[];
  edges: Edge[];
};

interface MindmapStore {
  nodes: Node<MindmapNodeData>[];
  edges: Edge[];
  selectedNodeIds: string[];
  layoutMode: 'radial' | 'tree-h' | 'tree-v';
  theme: 'light' | 'dark' | 'blueprint' | 'sepia';
  isDirty: boolean;
  isAiLoading: boolean;
  aiLoadingNodeId: string | null;
  history: HistoryEntry[];
  historyIndex: number;

  setNodes: (nodes: Node<MindmapNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node<MindmapNodeData>) => void;
  updateNode: (id: string, data: Partial<MindmapNodeData>) => void;
  removeNode: (id: string) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setLayoutMode: (mode: 'radial' | 'tree-h' | 'tree-v') => void;
  setTheme: (theme: 'light' | 'dark' | 'blueprint' | 'sepia') => void;
  setDirty: (dirty: boolean) => void;
  setAiLoading: (loading: boolean, nodeId?: string) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  resetStore: () => void;
}

const initialState = {
  nodes: [] as Node<MindmapNodeData>[],
  edges: [] as Edge[],
  selectedNodeIds: [] as string[],
  layoutMode: 'tree-h' as const,
  theme: 'light' as const,
  isDirty: false,
  isAiLoading: false,
  aiLoadingNodeId: null as string | null,
  history: [] as HistoryEntry[],
  historyIndex: -1,
};

export const useMindmapStore = create<MindmapStore>((set, get) => ({
  ...initialState,

  setNodes: (nodes) => set({ nodes, isDirty: true }),

  setEdges: (edges) => set({ edges, isDirty: true }),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
      isDirty: true,
    })),

  updateNode: (id, data) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
      isDirty: true,
    })),

  removeNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      isDirty: true,
    })),

  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),

  setLayoutMode: (mode) => set({ layoutMode: mode }),

  setTheme: (theme) => set({ theme }),

  setDirty: (dirty) => set({ isDirty: dirty }),

  setAiLoading: (loading, nodeId) =>
    set({ isAiLoading: loading, aiLoadingNodeId: nodeId ?? null }),

  pushHistory: () => {
    const state = get();
    const entry: HistoryEntry = {
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      edges: JSON.parse(JSON.stringify(state.edges)),
    };
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(entry);
    // Cap history at 50 entries
    if (newHistory.length > 50) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex <= 0) return;
    const prevIndex = state.historyIndex - 1;
    const entry = state.history[prevIndex];
    if (!entry) return;
    set({
      nodes: entry.nodes,
      edges: entry.edges,
      historyIndex: prevIndex,
      isDirty: true,
    });
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) return;
    const nextIndex = state.historyIndex + 1;
    const entry = state.history[nextIndex];
    if (!entry) return;
    set({
      nodes: entry.nodes,
      edges: entry.edges,
      historyIndex: nextIndex,
      isDirty: true,
    });
  },

  resetStore: () => set(initialState),
}));
