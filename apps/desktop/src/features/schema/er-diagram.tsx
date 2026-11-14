import { useCallback, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { KeyRound, Link2, Maximize, Network, Table2, ZoomIn, ZoomOut } from "lucide-react";
import type { TableInfo } from "@/shared/desktop-api";
import { cn } from "@/lib/utils";

const NODE_WIDTH = 272;
const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 22;
const X_GAP = 96;
const Y_GAP = 52;

export interface ErDiagramProps {
  tables: TableInfo[];
  highlightTable?: string | null;
  onTableClick?: (table: string) => void;
}

interface ColumnData {
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
}

interface TableData extends Record<string, unknown> {
  label: string;
  columns: ColumnData[];
  dimmed: boolean;
}

type TableNode = Node<TableData, "erTable">;

interface Relation {
  child: string;
  childColumn: string;
  parent: string;
  parentColumn: string;
}

export function ErDiagram({ tables, highlightTable, onTableClick }: ErDiagramProps): React.ReactElement {
  const graph = useMemo(() => buildGraph(tables), [tables]);
  if (tables.length === 0) {
    return <ErEmptyState />;
  }
  return (
    <ReactFlowProvider>
      <ErFlow
        key={graph.nodes.map((node) => node.id).join("|")}
        nodes={graph.nodes}
        edges={graph.edges}
        highlightTable={highlightTable ?? null}
        onTableClick={onTableClick}
      />
    </ReactFlowProvider>
  );
}

function ErEmptyState(): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <Network className="size-8 text-muted-dim" />
      <p className="text-[13px] font-medium">Nothing to diagram yet</p>
      <p className="max-w-xs text-[11.5px] leading-relaxed text-muted-dim">
        Activate a database with tables to see its entity relationships.
      </p>
    </div>
  );
}

function ErFlow({
  nodes: initialNodes,
  edges: initialEdges,
  highlightTable,
  onTableClick,
}: {
  nodes: TableNode[];
  edges: Edge[];
  highlightTable: string | null;
  onTableClick?: (table: string) => void;
}): React.ReactElement {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [hovered, setHovered] = useState<string | null>(null);
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const focus = hovered ?? highlightTable;

  const neighbors = useMemo(() => {
    if (focus === null) return null;
    const set = new Set<string>([focus]);
    for (const edge of initialEdges) {
      if (edge.source === focus) set.add(edge.target);
      if (edge.target === focus) set.add(edge.source);
    }
    return set;
  }, [initialEdges, focus]);

  const fit = useCallback(
    (duration = 180) => {
      void fitView({ padding: 0.14, maxZoom: 1, duration });
    },
    [fitView],
  );

  const styledNodes = useMemo<TableNode[]>(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          dimmed: neighbors !== null && !neighbors.has(node.id),
        },
      })),
    [nodes, neighbors],
  );

  const styledEdges = useMemo<Edge[]>(
    () =>
      initialEdges.map((edge) => {
        const active = focus !== null && (edge.source === focus || edge.target === focus);
        const dimmed = focus !== null && !active;
        const label = (edge.data as { label?: string } | undefined)?.label;
        return {
          ...edge,
          animated: false,
          zIndex: active ? 10 : dimmed ? 0 : 1,
          style: {
            ...(edge.style ?? {}),
            stroke: active ? "var(--primary)" : "color-mix(in oklab, var(--primary) 40%, var(--border))",
            strokeWidth: active ? 1.8 : 1.1,
            opacity: dimmed ? 0.1 : 1,
          },
          markerEnd: {
            type: "arrowclosed",
            width: 7,
            height: 7,
            color: active ? "var(--primary)" : "color-mix(in oklab, var(--primary) 55%, var(--border))",
          },
          label: active && typeof label === "string" ? label : undefined,
          labelShowBg: true,
          labelBgPadding: [5, 2] as [number, number],
          labelBgBorderRadius: 0,
          labelBgStyle: { fill: "var(--surface)", fillOpacity: 0.94, stroke: "var(--border)", strokeWidth: 0.5 },
          labelStyle: { fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)", fontSize: 9 },
        };
      }),
    [initialEdges, focus],
  );

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onNodeMouseEnter={(_, node) => setHovered(node.id)}
        onNodeMouseLeave={() => setHovered(null)}
        onNodeClick={(_, node) => onTableClick?.(node.id)}
        nodeTypes={{ erTable: TableCard }}
        fitView
        fitViewOptions={{ padding: 0.14, maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        deleteKeyCode={null}
        className="bg-background"
        onInit={() => fit(0)}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={26}
          size={1.1}
          color="color-mix(in oklab, var(--muted-foreground) 22%, transparent)"
        />
        <MiniMap
          pannable
          zoomable
          className="bottom-3! right-3!"
          style={{ width: 152, height: 104, background: "var(--surface-alt)", border: "1px solid var(--border)" }}
          maskColor="color-mix(in oklab, var(--background) 55%, transparent)"
          nodeColor={() => "var(--border)"}
          nodeStrokeColor={() => "var(--muted-foreground)"}
          nodeStrokeWidth={1}
        />
      </ReactFlow>

      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 border border-border bg-surface px-2.5 py-1.5 text-[10.5px] text-muted-dim">
        <span className="flex items-center gap-1.5">
          <Table2 className="size-3 text-primary" />
          <span className="numeric">{initialNodes.length} tables</span>
        </span>
        <span className="text-border">·</span>
        <span className="numeric">{initialEdges.length} relations</span>
        <span className="text-border">·</span>
        <span className="flex items-center gap-1">
          <KeyRound className="size-2.5 text-warning" />
          <span>pk</span>
        </span>
        <span className="flex items-center gap-1">
          <Link2 className="size-2.5 text-primary" />
          <span>fk</span>
        </span>
      </div>

      <div className="absolute right-3 top-3 z-10 flex flex-col border border-border bg-surface">
        <FlowButton aria-label="Fit view" title="Fit view" onClick={() => fit()}>
          <Maximize className="size-3" />
        </FlowButton>
        <FlowButton
          aria-label="Zoom in"
          title="Zoom in"
          className="border-b border-border"
          onClick={() => void zoomIn({ duration: 100 })}
        >
          <ZoomIn className="size-3" />
        </FlowButton>
        <FlowButton aria-label="Zoom out" title="Zoom out" onClick={() => void zoomOut({ duration: 100 })}>
          <ZoomOut className="size-3" />
        </FlowButton>
      </div>
    </div>
  );
}

function FlowButton({
  children,
  className,
  onClick,
  title,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  onClick: () => void;
  title: string;
  "aria-label": string;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center text-muted-dim transition-colors hover:bg-surface-hover hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function RowHandle({
  side,
  id,
  color,
  top,
}: {
  side: "left" | "right";
  id: string;
  color: string;
  top: number;
}): React.ReactElement {
  return (
    <Handle
      type={id.endsWith("-in") ? "target" : "source"}
      id={id}
      position={side === "left" ? Position.Left : Position.Right}
      isConnectable={false}
      style={{
        top,
        [side]: -5,
        width: 8,
        height: 8,
        background: color,
        border: "1.5px solid var(--surface)",
        borderRadius: 2,
      }}
    />
  );
}

function TableCard({ data, selected }: NodeProps<TableNode>): React.ReactElement {
  return (
    <div
      className={cn(
        "overflow-hidden bg-surface transition-opacity",
        selected
          ? "outline outline-1 outline-primary"
          : "outline outline-1 outline-border hover:outline-primary/60",
        data.dimmed && "opacity-25",
      )}
      style={{ width: NODE_WIDTH }}
    >
      <div className="flex h-[36px] items-center gap-2 border-b border-border bg-surface-alt px-2.5">
        <span className="h-3.5 w-[2px] shrink-0 bg-primary" aria-hidden="true" />
        <span
          className="min-w-0 flex-1 truncate font-mono text-[12px] font-semibold text-foreground"
          title={data.label}
        >
          {data.label}
        </span>
        <span className="numeric border border-border bg-surface px-1 text-[9px] text-muted-dim">
          {data.columns.length}
        </span>
      </div>
      <div>
        {data.columns.map((column, index) => {
          const top = HEADER_HEIGHT + ROW_HEIGHT * index + ROW_HEIGHT / 2;
          return (
            <div
              key={column.name}
              className="relative flex h-[22px] items-center gap-1.5 border-b border-border/30 px-2.5 last:border-b-0 hover:bg-surface-hover"
            >
              {column.fk ? (
                <>
                  <RowHandle side="left" id={`l-out-${column.name}`} color="var(--primary)" top={top} />
                  <RowHandle side="right" id={`r-out-${column.name}`} color="var(--primary)" top={top} />
                </>
              ) : null}
              <RowHandle side="left" id={`l-in-${column.name}`} color="var(--muted-foreground)" top={top} />
              <RowHandle side="right" id={`r-in-${column.name}`} color="var(--muted-foreground)" top={top} />
              <span className="flex w-3 shrink-0 justify-center">
                {column.pk ? (
                  <KeyRound className="size-2.5 text-warning" />
                ) : column.fk ? (
                  <Link2 className="size-2.5 text-primary" />
                ) : null}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate font-mono text-[10.5px]",
                  column.pk ? "font-semibold text-foreground" : "text-foreground/85",
                )}
                title={`${column.name} ${column.type}`}
              >
                {column.name}
              </span>
              <span className="shrink-0 font-mono text-[9px] uppercase text-muted-dim">
                {column.type}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildGraph(tables: TableInfo[]): { nodes: TableNode[]; edges: Edge[] } {
  const byName = new Map(tables.map((table) => [table.name.toLowerCase(), table]));
  const heights = new Map<string, number>();
  for (const table of tables) {
    heights.set(table.name, HEADER_HEIGHT + ROW_HEIGHT * table.columns.length + 1);
  }

  const relations: Relation[] = [];
  for (const table of tables) {
    for (const key of table.foreignKeys) {
      const parent = byName.get(key.table.toLowerCase());
      if (parent === undefined) continue;
      const parentColumn = parent.columns.find((column) => column.name === key.to);
      if (parentColumn === undefined) continue;
      if (parent.name === table.name) continue;
      relations.push({
        child: table.name,
        childColumn: key.from,
        parent: parent.name,
        parentColumn: key.to,
      });
    }
  }

  const parentsOf = new Map<string, Relation[]>();
  for (const relation of relations) {
    parentsOf.set(relation.child, [...(parentsOf.get(relation.child) ?? []), relation]);
  }

  const depthCache = new Map<string, number>();
  const visiting = new Set<string>();
  const depth = (name: string): number => {
    const cached = depthCache.get(name);
    if (cached !== undefined) return cached;
    if (visiting.has(name)) return 0;
    visiting.add(name);
    const parents = parentsOf.get(name) ?? [];
    const value =
      parents.length === 0 ? 0 : Math.max(...parents.map((parent) => depth(parent.parent) + 1));
    visiting.delete(name);
    depthCache.set(name, value);
    return value;
  };
  for (const table of tables) depth(table.name);

  const layerBuckets = new Map<number, string[]>();
  for (const table of tables) {
    const level = depthCache.get(table.name) ?? 0;
    layerBuckets.set(level, [...(layerBuckets.get(level) ?? []), table.name]);
  }
  const layers = Array.from(layerBuckets.keys()).sort((a, b) => a - b);

  const layerIndex = new Map<string, number>();
  for (const layer of layers) {
    for (const name of layerBuckets.get(layer) ?? []) layerIndex.set(name, layer);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const layer of layers) {
    const names = (layerBuckets.get(layer) ?? []).sort((a, b) => a.localeCompare(b));
    let y = 0;
    for (const name of names) {
      positions.set(name, { x: (layerIndex.get(name) ?? 0) * (NODE_WIDTH + X_GAP), y });
      y += (heights.get(name) ?? 0) + Y_GAP;
    }
  }

  for (let pass = 0; pass < 4; pass += 1) {
    for (const layer of layers) {
      const names = layerBuckets.get(layer) ?? [];
      const centers = new Map<string, number>();
      for (const name of names) {
        const related = relations.filter(
          (relation) =>
            (relation.child === name && positions.has(relation.parent)) ||
            (relation.parent === name && positions.has(relation.child)),
        );
        if (related.length === 0) {
          centers.set(name, positions.get(name)?.y ?? 0);
          continue;
        }
        const sum = related.reduce((total, relation) => {
          const other = relation.child === name ? relation.parent : relation.child;
          const position = positions.get(other);
          const height = heights.get(other) ?? 0;
          return total + ((position?.y ?? 0) + height / 2);
        }, 0);
        centers.set(name, sum / related.length);
      }
      const ordered = names.slice().sort((a, b) => (centers.get(a) ?? 0) - (centers.get(b) ?? 0));
      const totalHeight =
        ordered.reduce((sum, name) => sum + (heights.get(name) ?? 0), 0) + Y_GAP * (ordered.length - 1);
      let y = -totalHeight / 2;
      for (const name of ordered) {
        positions.set(name, { x: (layerIndex.get(name) ?? 0) * (NODE_WIDTH + X_GAP), y });
        y += (heights.get(name) ?? 0) + Y_GAP;
      }
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
        dimmed: false,
        columns: table.columns.map((column) => ({
          name: column.name,
          type: column.type,
          pk: pkColumns.has(column.name),
          fk: fkColumns.has(column.name),
        })),
      },
    };
  });

  const edges: Edge[] = relations.map((relation, index) => {
    const childX = positions.get(relation.child)?.x ?? 0;
    const parentX = positions.get(relation.parent)?.x ?? 0;
    const childLeft = childX > parentX;
    const sourceHandle = `${childLeft ? "l" : "r"}-out-${relation.childColumn}`;
    const targetHandle = `${childLeft ? "r" : "l"}-in-${relation.parentColumn}`;
    return {
      id: `fk-${index}-${relation.child}-${relation.childColumn}`,
      source: relation.child,
      sourceHandle,
      target: relation.parent,
      targetHandle,
      type: "smoothstep",
      pathOptions: { borderRadius: 6 },
      animated: false,
      interactionWidth: 14,
      data: { label: `${relation.childColumn} 1 : N ${relation.parentColumn}` },
      style: { strokeWidth: 1.1 },
    };
  });

  return { nodes, edges };
}
