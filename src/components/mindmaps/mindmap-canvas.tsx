"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
  ReactFlowProvider,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng, toSvg } from 'html-to-image';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useMindmapStore, type MindmapNodeData } from '@/lib/mindmaps/mindmap-store';
import { applyDagreLayout, getLayoutDirection } from '@/lib/mindmaps/mindmap-layout';
import MindmapNodeComponent from './mindmap-node-component';
import MindmapToolbar from './mindmap-toolbar';
import MindmapShortcutsPanel from './mindmap-shortcuts-panel';
import MindmapAiPanel, {
  type AiPanelMode,
  type AiExpandResult,
  type AiSummarizeResult,
  type AiConvertResult,
} from './mindmap-ai-panel';
import MindmapContextMenu from './mindmap-context-menu';

const nodeTypes = { mindmapNode: MindmapNodeComponent };

type DbNode = {
  id: string;
  mindmapId: string;
  parentNodeId: string | null;
  label: string;
  content: string | null;
  color: string;
  positionX: number;
  positionY: number;
  nodeOrder: number;
  linkedTaskId?: string | null;
  styleJsonb?: Record<string, unknown>;
  collapsedByJsonb?: string[];
  orderInParent?: number;
};

type DbEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  styleJsonb?: Record<string, unknown>;
};

type Props = {
  mindmapId: string;
  workspaceSlug: string;
  projectId: string;
  initialNodes: DbNode[];
  initialEdges: DbEdge[];
  canEdit: boolean;
  currentUserId: string;
};

const THEME_CLASSES: Record<string, string> = {
  light: 'bg-white',
  dark: 'bg-gray-950 [&_.react-flow\_\_node]:text-white',
  blueprint: 'bg-blue-950',
  sepia: 'bg-amber-50',
};

const SAVE_DEBOUNCE_MS = 800;

function dbNodesToFlow(dbNodes: DbNode[]): Node<MindmapNodeData>[] {
  const roots = dbNodes.filter((n) => !n.parentNodeId);
  const isRoot = (id: string) => roots.some((r) => r.id === id);

  function nodeType(n: DbNode): 'root' | 'child' | 'leaf' {
    if (isRoot(n.id)) return 'root';
    const hasChildren = dbNodes.some((c) => c.parentNodeId === n.id);
    return hasChildren ? 'child' : 'leaf';
  }

  return dbNodes.map((n) => ({
    id: n.id,
    type: 'mindmapNode',
    position: { x: n.positionX, y: n.positionY },
    data: {
      label: n.label,
      contentMd: n.content ?? undefined,
      color: n.color,
      parentNodeId: n.parentNodeId,
      linkedTaskId: n.linkedTaskId ?? null,
      styleJsonb: n.styleJsonb as MindmapNodeData['styleJsonb'],
      collapsedByJsonb: n.collapsedByJsonb ?? [],
      isCollapsed: false,
      isEditing: false,
      nodeType: nodeType(n),
      orderInParent: n.orderInParent ?? 0,
    },
  }));
}

function dbEdgesToFlow(dbEdges: DbEdge[], dbNodes: DbNode[]): Edge[] {
  // Build edges from parent relationships if no explicit edges
  const fromParents: Edge[] = dbNodes
    .filter((n) => n.parentNodeId)
    .map((n) => ({
      id: `e-${n.parentNodeId}-${n.id}`,
      source: n.parentNodeId!,
      target: n.id,
      type: 'smoothstep',
      style: { stroke: 'var(--color-border, #e2e8f0)', strokeWidth: 2 },
    }));

  const explicit: Edge[] = dbEdges
    .filter((e) => !dbNodes.some((n) => n.parentNodeId && `e-${n.parentNodeId}-${n.id}` === e.id))
    .map((e) => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      type: 'smoothstep',
      style: { stroke: 'var(--color-border, #e2e8f0)', strokeWidth: 2 },
    }));

  return [...fromParents, ...explicit];
}

function collectDescendantIds(nodeId: string, nodes: Node<MindmapNodeData>[]): string[] {
  const children = nodes.filter((n) => n.data.parentNodeId === nodeId);
  return children.flatMap((c) => [c.id, ...collectDescendantIds(c.id, nodes)]);
}

function nodesToMarkdown(nodes: Node<MindmapNodeData>[], edges: Edge[]): string {
  const childMap = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!childMap.has(e.source)) childMap.set(e.source, []);
    childMap.get(e.source)!.push(e.target);
  });

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const roots = nodes.filter((n) => !n.data.parentNodeId);

  function walk(id: string, depth: number): string {
    const node = nodeMap.get(id);
    if (!node) return '';
    const prefix = '#'.repeat(Math.min(depth + 1, 6));
    const line = `${prefix} ${node.data.label}`;
    const children = childMap.get(id) ?? [];
    return [line, ...children.map((c) => walk(c, depth + 1))].join('\n');
  }

  return roots.map((r) => walk(r.id, 0)).join('\n\n');
}

function nodesToOpml(nodes: Node<MindmapNodeData>[], edges: Edge[]): string {
  const childMap = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!childMap.has(e.source)) childMap.set(e.source, []);
    childMap.get(e.source)!.push(e.target);
  });

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const roots = nodes.filter((n) => !n.data.parentNodeId);

  function walk(id: string): string {
    const node = nodeMap.get(id);
    if (!node) return '';
    const children = childMap.get(id) ?? [];
    const text = node.data.label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (children.length === 0) return `<outline text="${text}"/>`;
    return `<outline text="${text}">\n${children.map(walk).join('\n')}\n</outline>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n<head><title>Mindmap</title></head>\n<body>\n${roots.map((r) => walk(r.id)).join('\n')}\n</body>\n</opml>`;
}

function MindmapCanvasInner({
  mindmapId,
  workspaceSlug: _workspaceSlug,
  projectId: _projectId,
  initialNodes,
  initialEdges,
  canEdit,
  currentUserId: _currentUserId,
}: Props) {
  const store = useMindmapStore();
  const flowRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiMode, setAiMode] = useState<AiPanelMode>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [expandResult, setExpandResult] = useState<AiExpandResult | null>(null);
  const [summarizeResult, setSummarizeResult] = useState<AiSummarizeResult | null>(null);
  const [convertResult, setConvertResult] = useState<AiConvertResult | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);

  // Initialize store from props
  useEffect(() => {
    const flowNodes = dbNodesToFlow(initialNodes);
    const flowEdges = dbEdgesToFlow(initialEdges, initialNodes);

    const needsLayout =
      flowNodes.length > 0 &&
      flowNodes.every((n) => n.position.x === 0 && n.position.y === 0);

    if (needsLayout) {
      const dir = getLayoutDirection(store.layoutMode);
      const { nodes: ln, edges: le } = applyDagreLayout(flowNodes, flowEdges, dir);
      store.setNodes(ln as Node<MindmapNodeData>[]);
      store.setEdges(le);
    } else {
      store.setNodes(flowNodes as Node<MindmapNodeData>[]);
      store.setEdges(flowEdges);
    }
    store.setDirty(false);
    setSaveStatus('saved');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mindmapId]);

  // Custom event: label change from node component
  useEffect(() => {
    const handler = (e: Event) => {
      const { nodeId, label } = (e as CustomEvent).detail as { nodeId: string; label: string };
      store.updateNode(nodeId, { label });
      scheduleSave(nodeId, { label });
    };
    window.addEventListener('mindmap:node-label-change', handler);
    return () => window.removeEventListener('mindmap:node-label-change', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Custom event: node collapse toggle
  useEffect(() => {
    const handler = (e: Event) => {
      const { nodeId, collapsed } = (e as CustomEvent).detail as {
        nodeId: string;
        collapsed: boolean;
      };
      store.updateNode(nodeId, { isCollapsed: collapsed });

      const descendants = collectDescendantIds(nodeId, store.nodes);
      store.setNodes(
        store.nodes.map((n) =>
          descendants.includes(n.id) ? { ...n, hidden: collapsed } : n
        )
      );
    };
    window.addEventListener('mindmap:node-collapse', handler);
    return () => window.removeEventListener('mindmap:node-collapse', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.nodes]);

  const scheduleSave = useCallback(
    (nodeId: string, data: Partial<{ label: string; positionX: number; positionY: number }>) => {
      setSaveStatus('unsaved');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setSaveStatus('saving');
        try {
          const res = await fetch(`/api/mindmaps/${mindmapId}/nodes/${nodeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!res.ok) throw new Error('save failed');
          setSaveStatus('saved');
          store.setDirty(false);
        } catch {
          setSaveStatus('unsaved');
          toast.error('No se pudo guardar el nodo');
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [mindmapId, store]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<MindmapNodeData>>[]) => {
      const updated = applyNodeChanges(changes, store.nodes) as Node<MindmapNodeData>[];
      store.setNodes(updated);

      // Persist position changes
      const posChanges = changes.filter((c) => c.type === 'position' && !c.dragging);
      posChanges.forEach((c) => {
        if (c.type === 'position' && c.position) {
          scheduleSave(c.id, {
            positionX: Math.round(c.position.x),
            positionY: Math.round(c.position.y),
          });
        }
      });
    },
    [store, scheduleSave]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      store.setEdges(applyEdgeChanges(changes, store.edges));
    },
    [store]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      store.setEdges(
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            style: { stroke: 'var(--color-border, #e2e8f0)', strokeWidth: 2 },
          },
          store.edges
        )
      );
    },
    [store]
  );

  const onSelectionChange = useCallback(
    ({ nodes: selected }: { nodes: Node[] }) => {
      store.setSelectedNodeIds(selected.map((n) => n.id));
    },
    [store]
  );

  const handleAddNode = useCallback(
    async (parentId: string | null, opts?: { asSibling?: boolean }) => {
      let resolvedParentId = parentId;

      if (opts?.asSibling && parentId) {
        const parent = store.nodes.find((n) => n.id === parentId);
        resolvedParentId = parent?.data.parentNodeId ?? null;
      }

      const parentNode = resolvedParentId
        ? store.nodes.find((n) => n.id === resolvedParentId)
        : null;

      const siblings = store.nodes.filter(
        (n) => n.data.parentNodeId === resolvedParentId
      );
      const tempId = crypto.randomUUID();
      const position = {
        x: (parentNode?.position.x ?? 0) + 200,
        y: (parentNode?.position.y ?? 0) + siblings.length * 60,
      };

      const newNode: Node<MindmapNodeData> = {
        id: tempId,
        type: 'mindmapNode',
        position,
        data: {
          label: 'Nuevo nodo',
          parentNodeId: resolvedParentId,
          nodeType: resolvedParentId ? 'leaf' : 'root',
          color: parentNode?.data.color ?? '#94a3b8',
          isEditing: true,
        },
      };

      store.addNode(newNode);
      store.setSelectedNodeIds([tempId]);

      if (resolvedParentId) {
        const newEdge: Edge = {
          id: `e-${resolvedParentId}-${tempId}`,
          source: resolvedParentId,
          target: tempId,
          type: 'smoothstep',
          style: { stroke: 'var(--color-border, #e2e8f0)', strokeWidth: 2 },
        };
        store.setEdges([...store.edges, newEdge]);
      }

      try {
        const res = await fetch(`/api/mindmaps/${mindmapId}/nodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: 'Nuevo nodo',
            parentNodeId: resolvedParentId,
            orderInParent: siblings.length,
            positionX: Math.round(position.x),
            positionY: Math.round(position.y),
          }),
        });
        if (!res.ok) throw new Error('create failed');
        const { node: created } = (await res.json()) as { node: { id: string } };

        // Replace temp id with real id
        store.setNodes(
          store.nodes.map((n) =>
            n.id === tempId ? { ...n, id: created.id, data: { ...n.data, isEditing: false } } : n
          )
        );
        store.setEdges(
          store.edges.map((e) => ({
            ...e,
            id: e.id === `e-${resolvedParentId}-${tempId}` ? `e-${resolvedParentId}-${created.id}` : e.id,
            target: e.target === tempId ? created.id : e.target,
            source: e.source === tempId ? created.id : e.source,
          }))
        );
        store.setSelectedNodeIds([created.id]);
      } catch {
        toast.error('No se pudo crear el nodo');
        store.setNodes(store.nodes.filter((n) => n.id !== tempId));
        store.setEdges(store.edges.filter((e) => !e.id.includes(tempId)));
      }
    },
    [mindmapId, store]
  );

  const handleDeleteNode = useCallback(
    async (nodeId: string, withBranch = false) => {
      const node = store.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      if (!node.data.parentNodeId) {
        toast.error('No se puede eliminar el nodo raíz');
        return;
      }

      const toDelete = withBranch
        ? [nodeId, ...collectDescendantIds(nodeId, store.nodes)]
        : [nodeId];

      const hasChildren = store.nodes.some((n) => n.data.parentNodeId === nodeId);
      if (!withBranch && hasChildren) {
        const ok = window.confirm(
          'Este nodo tiene hijos. ¿Eliminar solo este nodo? Los hijos quedarán huérfanos.'
        );
        if (!ok) return;
      }

      store.setNodes(store.nodes.filter((n) => !toDelete.includes(n.id)));
      store.setEdges(
        store.edges.filter(
          (e) => !toDelete.includes(e.source) && !toDelete.includes(e.target)
        )
      );
      store.setSelectedNodeIds([]);

      try {
        const res = await fetch(`/api/mindmaps/${mindmapId}/nodes/${nodeId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('delete failed');
      } catch {
        toast.error('No se pudo eliminar el nodo');
      }
    },
    [mindmapId, store]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInput =
        active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
      if (isInput) return;

      const metaOrCtrl = e.metaKey || e.ctrlKey;
      const selectedId = store.selectedNodeIds[0] ?? null;

      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts((s) => !s);
        return;
      }

      if (metaOrCtrl && e.key === '0') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('mindmap:fitview'));
        return;
      }

      if (metaOrCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        store.undo();
        return;
      }

      if (metaOrCtrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        store.redo();
        return;
      }

      if (!selectedId) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        handleAddNode(selectedId);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddNode(selectedId, { asSibling: true });
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        store.updateNode(selectedId, { isEditing: true });
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteNode(selectedId);
        return;
      }

      if (e.key === 'Escape') {
        store.setSelectedNodeIds([]);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store, handleAddNode, handleDeleteNode]);

  // Fit view shortcut
  useEffect(() => {
    const handler = () => {
      window.dispatchEvent(new CustomEvent('reactflow:fitview'));
    };
    window.addEventListener('mindmap:fitview', handler);
    return () => window.removeEventListener('mindmap:fitview', handler);
  }, []);

  // Context menu
  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node<MindmapNodeData>) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
    },
    []
  );

  const handleContextChangeColor = useCallback(
    (nodeId: string, color: string) => {
      const newStyleJsonb = {
        ...(store.nodes.find((n) => n.id === nodeId)?.data.styleJsonb ?? {}),
        borderColor: color,
        fillColor: color,
      };
      store.updateNode(nodeId, { color, styleJsonb: newStyleJsonb });
      // Persist color + styleJsonb directly (scheduleSave only handles label/position)
      fetch(`/api/mindmaps/${mindmapId}/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color, styleJsonb: newStyleJsonb }),
      }).catch(() => toast.error('No se pudo guardar el color'));
    },
    [mindmapId, store]
  );

  const handleContextChangeShape = useCallback(
    (nodeId: string, shape: 'rounded' | 'circle' | 'diamond' | 'rect') => {
      const newStyleJsonb = {
        ...(store.nodes.find((n) => n.id === nodeId)?.data.styleJsonb ?? {}),
        shape,
      };
      store.updateNode(nodeId, { styleJsonb: newStyleJsonb });
      // Persist styleJsonb to server
      fetch(`/api/mindmaps/${mindmapId}/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ styleJsonb: newStyleJsonb }),
      }).catch(() => toast.error('No se pudo guardar la forma'));
    },
    [mindmapId, store]
  );

  const handleContextToggleCollapse = useCallback(
    (nodeId: string) => {
      const node = store.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const collapsed = !node.data.isCollapsed;
      window.dispatchEvent(
        new CustomEvent('mindmap:node-collapse', { detail: { nodeId, collapsed } })
      );
    },
    [store.nodes]
  );

  // Export
  const handleExport = useCallback(
    async (format: 'png' | 'svg' | 'markdown' | 'opml') => {
      if (format === 'markdown') {
        const md = nodesToMarkdown(store.nodes, store.edges);
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mindmap.md';
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      if (format === 'opml') {
        const opml = nodesToOpml(store.nodes, store.edges);
        const blob = new Blob([opml], { type: 'text/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mindmap.opml';
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      const el = flowRef.current?.querySelector('.react-flow__viewport') as HTMLElement;
      if (!el) {
        toast.error('No se pudo exportar');
        return;
      }

      try {
        if (format === 'png') {
          const dataUrl = await toPng(el, { backgroundColor: '#fff', pixelRatio: 2 });
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = 'mindmap.png';
          a.click();
        } else {
          const dataUrl = await toSvg(el, { backgroundColor: '#fff' });
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = 'mindmap.svg';
          a.click();
        }
      } catch {
        toast.error('No se pudo exportar la imagen');
      }
    },
    [store.nodes, store.edges]
  );

  // AI actions — each action maps to its own endpoint
  const handleAiAction = useCallback(
    async (action: 'expand' | 'summarize' | 'brainstorm' | 'convert-to-plan') => {
      setAiMode(action);
      setAiPanelOpen(true);
      setAiLoading(true);
      setExpandResult(null);
      setSummarizeResult(null);
      setConvertResult(null);

      const selectedId = store.selectedNodeIds[0] ?? null;

      try {
        if (action === 'expand') {
          // expand streams a JSON array as plain text
          const res = await fetch(`/api/mindmaps/${mindmapId}/ai/expand`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodeId: selectedId, count: 5 }),
          });
          if (!res.ok) throw new Error('AI request failed');
          const text = await res.text();
          // Parse streamed JSON array (may be wrapped in markdown code fence)
          const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\])/);
          const jsonText = jsonMatch?.[1] ? jsonMatch[1].trim() : text.trim();
          const suggestions = JSON.parse(jsonText) as string[];
          setExpandResult({
            suggestions: suggestions.map((s: string, i: number) => ({
              id: String(i),
              label: s,
              accepted: true,
            })),
          });
        } else if (action === 'summarize') {
          const res = await fetch(`/api/mindmaps/${mindmapId}/ai/summarize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodeId: selectedId }),
          });
          if (!res.ok) throw new Error('AI request failed');
          const data = (await res.json()) as { summary: string };
          setSummarizeResult({ text: data.summary });
        } else if (action === 'brainstorm') {
          const res = await fetch(`/api/mindmaps/${mindmapId}/ai/brainstorm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ objective: store.nodes.find((n) => n.id === selectedId)?.data.label ?? 'Ideas' }),
          });
          if (!res.ok) throw new Error('AI request failed');
          // brainstorm streams a JSON tree — consume but don't use result in panel
          await res.text();
        } else if (action === 'convert-to-plan') {
          const res = await fetch(`/api/mindmaps/${mindmapId}/ai/convert-to-plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          if (!res.ok) throw new Error('AI request failed');
          const data = (await res.json()) as { plan: { epics: { label: string; nodeId: string; tasks: { label: string; nodeId: string; subtasks: { label: string; nodeId: string }[] }[] }[] } };
          // Map plan epics → AiConvertResult tasks
          const tasks = (data.plan?.epics ?? []).map((epic, i) => ({
            id: epic.nodeId ?? String(i),
            title: epic.label,
            children: epic.tasks?.map((t) => ({ id: t.nodeId ?? t.label, title: t.label })) ?? [],
          }));
          setConvertResult({ tasks });
        }
      } catch {
        toast.error('No se pudo procesar la acción AI');
        setAiPanelOpen(false);
      } finally {
        setAiLoading(false);
      }
    },
    [mindmapId, store.selectedNodeIds, store.nodes]
  );

  const handleAcceptExpand = useCallback(
    async (labels: string[]) => {
      const parentId = store.selectedNodeIds[0] ?? null;
      for (const label of labels) {
        // Create each node via API directly with the correct label
        const siblings = store.nodes.filter((n) => n.data.parentNodeId === parentId);
        const parentNode = parentId ? store.nodes.find((n) => n.id === parentId) : null;
        const position = {
          x: (parentNode?.position.x ?? 0) + 200,
          y: (parentNode?.position.y ?? 0) + siblings.length * 60,
        };
        try {
          const res = await fetch(`/api/mindmaps/${mindmapId}/nodes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              label,
              parentNodeId: parentId,
              orderInParent: siblings.length,
              positionX: Math.round(position.x),
              positionY: Math.round(position.y),
            }),
          });
          if (!res.ok) throw new Error('create failed');
          const { node: created } = (await res.json()) as { node: { id: string } };
          const newNode: Node<MindmapNodeData> = {
            id: created.id,
            type: 'mindmapNode',
            position,
            data: {
              label,
              parentNodeId: parentId,
              nodeType: 'leaf',
              color: parentNode?.data.color ?? '#94a3b8',
              isEditing: false,
            },
          };
          store.addNode(newNode);
          if (parentId) {
            store.setEdges([...store.edges, {
              id: `e-${parentId}-${created.id}`,
              source: parentId,
              target: created.id,
              type: 'smoothstep',
              style: { stroke: 'var(--color-border, #e2e8f0)', strokeWidth: 2 },
            }]);
          }
        } catch {
          toast.error(`No se pudo crear el nodo: ${label}`);
        }
      }
      setAiPanelOpen(false);
    },
    [mindmapId, store]
  );

  const handleAcceptSummarize = useCallback(
    (text: string) => {
      const nodeId = store.selectedNodeIds[0];
      if (nodeId) {
        store.updateNode(nodeId, { contentMd: text });
        // Persist content to server (scheduleSave only handles label/position)
        fetch(`/api/mindmaps/${mindmapId}/nodes/${nodeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text || null }),
        }).catch(() => toast.error('No se pudo guardar el contenido'));
      }
      setAiPanelOpen(false);
    },
    [mindmapId, store]
  );

  const handleMaterializePlan = useCallback(
    async (tasks: AiConvertResult['tasks']) => {
      toast.info(`Materializando ${tasks.length} tareas...`);
      setAiPanelOpen(false);
    },
    []
  );

  const selectedNodeId = store.selectedNodeIds[0] ?? null;
  const selectedNode = selectedNodeId ? store.nodes.find((n) => n.id === selectedNodeId) : null;

  const themeClass = THEME_CLASSES[store.theme] ?? THEME_CLASSES.light;

  const bgVariant =
    store.theme === 'blueprint'
      ? BackgroundVariant.Lines
      : BackgroundVariant.Dots;

  const bgColor =
    store.theme === 'dark'
      ? '#1f2937'
      : store.theme === 'blueprint'
      ? '#1e40af'
      : store.theme === 'sepia'
      ? '#c2a06a'
      : '#e5e7eb';

  return (
    <div className="relative w-full h-full flex flex-col bg-surface overflow-hidden rounded-xl border border-border">
      <MindmapToolbar
        mindmapId={mindmapId}
        canEdit={canEdit}
        saveStatus={saveStatus}
        selectedNodeId={selectedNodeId}
        onAiAction={handleAiAction}
        onExport={handleExport}
      />

      <div ref={flowRef} className={cn('flex-1 relative', themeClass)}>
        <ReactFlow
          nodes={store.nodes}
          edges={store.edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={canEdit ? onConnect : undefined}
          onSelectionChange={onSelectionChange}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={() => {
            store.setSelectedNodeIds([]);
            setContextMenu(null);
          }}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={canEdit}
          nodesConnectable={canEdit}
          elementsSelectable={true}
          deleteKeyCode={null} // handled manually
          multiSelectionKeyCode="Shift"
          selectionKeyCode="Shift"
          panOnDrag={[1, 2]}
          zoomOnScroll
          minZoom={0.2}
          maxZoom={3}
          className="w-full h-full"
        >
          <Background variant={bgVariant} color={bgColor} gap={24} size={1} />
          <Controls showInteractive={false} className="!bottom-4 !left-4" />
          <MiniMap
            className="!bottom-4 !right-4"
            nodeColor={(n) => {
              const data = n.data as MindmapNodeData;
              return data.styleJsonb?.fillColor ?? data.color ?? '#94a3b8';
            }}
            maskColor={
              store.theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'
            }
          />
        </ReactFlow>

        {/* AI Panel */}
        <MindmapAiPanel
          open={aiPanelOpen}
          mode={aiMode}
          isLoading={aiLoading}
          expandResult={expandResult}
          summarizeResult={summarizeResult}
          convertResult={convertResult}
          onClose={() => setAiPanelOpen(false)}
          onAcceptExpand={handleAcceptExpand}
          onAcceptSummarize={handleAcceptSummarize}
          onMaterializePlan={handleMaterializePlan}
        />

        {/* Context menu */}
        {contextMenu && (
          <MindmapContextMenu
            position={{ x: contextMenu.x, y: contextMenu.y }}
            nodeId={contextMenu.nodeId}
            isRoot={
              !store.nodes.find((n) => n.id === contextMenu.nodeId)?.data.parentNodeId
            }
            isCollapsed={
              store.nodes.find((n) => n.id === contextMenu.nodeId)?.data.isCollapsed ?? false
            }
            onClose={() => setContextMenu(null)}
            onEdit={(nodeId) => store.updateNode(nodeId, { isEditing: true })}
            onAddChild={(nodeId) => handleAddNode(nodeId)}
            onAddSibling={(nodeId) => handleAddNode(nodeId, { asSibling: true })}
            onChangeColor={handleContextChangeColor}
            onChangeShape={handleContextChangeShape}
            onLinkTask={(nodeId) => toast.info(`Linkear tarea a ${nodeId} — próximamente`)}
            onConvertToTask={(nodeId) => toast.info(`Convertir ${nodeId} a tarea — próximamente`)}
            onToggleCollapse={handleContextToggleCollapse}
            onDeleteNode={(nodeId) => handleDeleteNode(nodeId, false)}
            onDeleteBranch={(nodeId) => handleDeleteNode(nodeId, true)}
          />
        )}

        {/* Empty state */}
        {store.nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted gap-3 pointer-events-none">
            <span className="text-sm">El mapa mental está vacío</span>
            {canEdit && (
              <button
                className="pointer-events-auto text-xs px-3 py-1.5 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                onClick={() => handleAddNode(null)}
              >
                + Crear nodo raíz
              </button>
            )}
          </div>
        )}
      </div>

      <MindmapShortcutsPanel
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* Keyboard hint */}
      {!showShortcuts && (
        <button
          onClick={() => setShowShortcuts(true)}
          className="absolute bottom-16 right-4 z-20 w-7 h-7 rounded-full bg-background border border-border text-text-muted hover:text-text text-xs flex items-center justify-center shadow-sm transition-colors"
          title="Atajos de teclado (?)"
        >
          ?
        </button>
      )}

      {/* Selected node info */}
      {selectedNode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-background/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 text-xs text-text-muted shadow-sm">
            {selectedNode.data.label}
            {selectedNode.data.linkedTaskId && (
              <span className="ml-2 text-accent">• Tarea linkeada</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MindmapCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <MindmapCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
