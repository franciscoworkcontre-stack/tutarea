import * as dagre from 'dagre';
import { type Node, type Edge } from '@xyflow/react';

export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' | 'RL' | 'BT' = 'LR',
  nodeWidth = 172,
  nodeHeight = 40
): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes, edges };

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) return node;
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export function getLayoutDirection(mode: 'radial' | 'tree-h' | 'tree-v'): 'TB' | 'LR' {
  switch (mode) {
    case 'tree-h':
      return 'LR';
    case 'tree-v':
      return 'TB';
    case 'radial':
      return 'LR'; // dagre fallback for radial
    default:
      return 'LR';
  }
}
