import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { KeyRound, Link2 } from "lucide-react";
import type { TableInfo } from "@logixzen/shared/sql-engine";
import { cn } from "@/lib/utils";

const NODE_WIDTH = 224;
const HEADER_HEIGHT = 30;
const ROW_HEIGHT = 22;
const X_GAP = 90;
const Y_GAP = 48;

export interface ErDiagramProps {
  tables: TableInfo[];
}

interface TableData extends Record<string, unknown> {
  label: string;
  columns: Array<{ name: string; type: string; pk: boolean; fk: boolean }>;
}

type TableNode = Node<TableData, "erTable">;

export function ErDiagram({ tables }: ErDiagramProps): React.ReactElement {
  const graph = useMemo(() => buildGraph(tables), [tables]);
  return (
    <ReactFlowProvider>
      <ErFlow nodes={graph.nodes} edges={graph.edges} />
    </ReactFlowProvider>
  );
}

function ErFlow({
  nodes: initialNodes,
  edges: initialEdges,
}: {
  nodes: TableNode[];
  edges: Edge[];
}): React.ReactElement {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const { fitView } = useReactFlow();

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={{ erTable: TableCard }}
      fitView
      fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
      minZoom={0.2}
      maxZoom={1.6}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
      className="bg-background"
      onInit={() => window.setTimeout(() => fitView({ padding: 0.12, maxZoom: 1, duration: 150 }), 50)}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="color-mix(in oklab, var(--muted-foreground) 30%, transparent)" />
    </ReactFlow>
  );
}

function TableCard({ data, selected }: NodeProps<TableNode>): React.ReactElement {
  return (
    <div
      className={cn(
        "border bg-surface transition-colors",
        selected ? "border-primary shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_45%,transparent)]" : "border-border",
      )}
      style={{ width: NODE_WIDTH }}
    >
      <div className="flex h-[30px] items-center justify-between border-b border-border bg-surface-alt px-2">
        <span className="truncate font-mono text-[11px] font-semibold text-foreground" title={data.label}>
          {data.label}
        </span>
        <span className="numeric text-[9px] text-muted-dim">{data.columns.length}</span>
      </div>
      <div className="py-0.5">
        {data.columns.map((column, index) => {
          const center = HEADER_HEIGHT + ROW_HEIGHT * index + ROW_HEIGHT / 2;
          return (
            <div key={column.name} className="relative">
              {column.fk ? (
                <Handle
                  type="source"
                  id={`out-${column.name}`}
                  position={Position.Right}
                  isConnectable={false}
                  style={{ top: center, right: -4, width: 6, height: 6, background: "var(--primary)", border: "none", borderRadius: 0 }}
                />
              ) : null}
              <Handle
                type="target"
                id={`in-${column.name}`}
                position={Position.Left}
                isConnectable={false}
                style={{ top: center, left: -4, width: 6, height: 6, background: "var(--muted-foreground)", border: "none", borderRadius: 0 }}
              />
              <div
                className="flex h-[22px] items-center justify-between px-2 text-[10.5px]"
                title={`${column.name} ${column.type}`}
              >
                <span className="flex min-w-0 items-center gap-1">
                  {column.pk ? <KeyRound className="size-2.5 shrink-0 text-warning" /> : null}
                  {column.fk ? <Link2 className="size-2.5 shrink-0 text-primary" /> : null}
                  <span className={cn("truncate font-mono", column.pk ? "font-semibold text-foreground" : "text-foreground/85")}>
                    {column.name}
                  </span>
                </span>
                <span className="ml-2 shrink-0 font-mono text-[9px] uppercase text-muted-dim">{column.type}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildGraph(tables: TableInfo[]): { nodes: TableNode[]; edges: Edge[] } {
  const heights = new Map<string, number>();
  for (const table of tables) {
    heights.set(table.name, HEADER_HEIGHT + ROW_HEIGHT * table.columns.length + 4);
  }

  const parentOf = new Map<string, Array<{ table: string; from: string; to: string }>>();
  for (const table of tables) {
    const relations = table.foreignKeys
      .filter((key) => key.table !== table.name && tables.some((t) => t.name === key.table))
      .map((key) => ({ table: key.table, from: key.from, to: key.to }));
    parentOf.set(table.name, relations);
  }

  const depthCache = new Map<string, number>();
  const visiting = new Set<string>();
  const depth = (name: string): number => {
    const cached = depthCache.get(name);
    if (cached !== undefined) return cached;
    if (visiting.has(name)) return 0;
    visiting.add(name);
    const parents = parentOf.get(name) ?? [];
    const value = parents.length === 0 ? 0 : Math.max(...parents.map((parent) => depth(parent.table) + 1));
    visiting.delete(name);
    depthCache.set(name, value);
    return value;
  };
  for (const table of tables) depth(table.name);

  const columns = new Map<string, number>();
  for (const table of tables) columns.set(table.name, table.columns.length);

  const layerBuckets = new Map<number, string[]>();
  for (const table of tables) {
    const level = depthCache.get(table.name) ?? 0;
    layerBuckets.set(level, [...(layerBuckets.get(level) ?? []), table.name]);
  }

  const positions = new Map<string, { x: number; y: number }>();
  const layers = Array.from(layerBuckets.keys()).sort((a, b) => a - b);
  const maxRowsInLayer = Math.max(
    ...layers.map((layer) => layerBuckets.get(layer)!.reduce((sum, name) => sum + heights.get(name)!, 0) + Y_GAP * (layerBuckets.get(layer)!.length - 1)),
    0,
  );
  for (const layer of layers) {
    const names = (layerBuckets.get(layer) ?? []).sort();
    const layerHeight = names.reduce((sum, name) => sum + heights.get(name)!, 0) + Y_GAP * (names.length - 1);
    let y = (maxRowsInLayer - layerHeight) / 2;
    for (const name of names) {
      positions.set(name, { x: layer * (NODE_WIDTH + X_GAP), y: Math.max(0, y) });
      y += (heights.get(name) ?? 0) + Y_GAP;
    }
  }

  const nodes: TableNode[] = tables.map((table) => {
    const pkColumns = new Set(table.primaryKey ?? []);
    const fkColumns = new Set(table.foreignKeys.map((key) => key.from));
    return {
      id: table.name,
      type: "erTable" as const,
      position: positions.get(table.name) ?? { x: 0, y: 0 },
      data: {
        label: table.name,
        columns: table.columns.map((column) => ({
          name: column.name,
          type: column.type,
          pk: pkColumns.has(column.name),
          fk: fkColumns.has(column.name),
        })),
      },
    };
  });

  const edges: Edge[] = [];
  for (const table of tables) {
    for (const relation of parentOf.get(table.name) ?? []) {
      edges.push({
        id: `fk-${table.name}-${relation.from}-${relation.table}-${relation.to}`,
        source: table.name,
        sourceHandle: `out-${relation.from}`,
        target: relation.table,
        targetHandle: `in-${relation.to}`,
        type: "smoothstep",
        animated: false,
        style: { stroke: "color-mix(in oklab, var(--primary) 55%, var(--border))", strokeWidth: 1.4 },
        markerEnd: { type: "arrowclosed", width: 12, height: 12, color: "color-mix(in oklab, var(--primary) 55%, var(--border))" },
      });
    }
  }

  return { nodes, edges };
}
