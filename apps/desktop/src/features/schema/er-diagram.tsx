import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  useNodesState,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  KeyRound,
  Link2,
  Maximize,
  Network,
  RotateCcw,
  Table2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { TableInfo } from "@/shared/desktop-api";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const NODE_WIDTH = 276;
const HEADER_HEIGHT = 38;
const ROW_HEIGHT = 22;
const X_GAP = 132;
const Y_GAP = 64;
const HANDLE_SIZE = 8;

const TABLE_ACCENTS = [
  "var(--er-1)",
  "var(--er-2)",
  "var(--er-3)",
  "var(--er-4)",
  "var(--er-5)",
  "var(--er-6)",
  "var(--er-7)",
  "var(--er-8)",
];

type CardinalityKind = "1:1" | "1:N" | "M:N";

interface ErDiagramProps {
  tables: TableInfo[];
  highlightTable?: string | null;
  onTableClick?: (table: string) => void;
}

interface ColumnData {
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  source: boolean;
  target: boolean;
}

interface TableData extends Record<string, unknown> {
  label: string;
  accentColor: string;
  order: number;
  columns: ColumnData[];
  dimmed: boolean;
  focused: boolean;
  hoveredColumn: string | null;
  onColumnHover?: (column: string | null) => void;
}

type TableNode = Node<TableData, "erTable">;

interface RelationData extends Record<string, unknown> {
  childTable: string;
  childColumn: string;
  parentTable: string;
  parentColumn: string;
  accentColor: string;
  cardinality: CardinalityKind;
  isSelf: boolean;
  active: boolean;
  showInfo: boolean;
  dimmed: boolean;
  onHoverChange?: (hovering: boolean) => void;
}

type RelationEdgeType = Edge<RelationData, "relation">;

interface Relation {
  child: string;
  childColumn: string;
  parent: string;
  parentColumn: string;
  cardinality: CardinalityKind;
}

const edgeTypes = { relation: RelationEdge };
const nodeTypes = { erTable: TableCard };

export function ErDiagram({
  tables,
  highlightTable,
  onTableClick,
}: ErDiagramProps): React.ReactElement {
  const graph = useMemo(() => buildGraph(tables), [tables]);

  if (tables.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <span className="flex size-10 items-center justify-center border border-border bg-surface-alt">
          <Network className="size-4 text-muted-dim" />
        </span>
        <p className="text-[13px] font-medium text-muted">No schema loaded</p>
        <p className="text-[11.5px] text-muted-dim">
          Activate a database or create tables to inspect relationships.
        </p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <ErCanvas
        initialNodes={graph.nodes}
        initialEdges={graph.edges}
        highlightTable={highlightTable ?? null}
        onTableClick={onTableClick}
      />
    </ReactFlowProvider>
  );
}

function ErCanvas({
  initialNodes,
  initialEdges,
  highlightTable,
  onTableClick,
}: {
  initialNodes: TableNode[];
  initialEdges: RelationEdgeType[];
  highlightTable: string | null;
  onTableClick?: (table: string) => void;
}): React.ReactElement {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<{
    table: string;
    column: string;
  } | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const focus = hovered ?? highlightTable;

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  const matchingColumnEdgeIds = useMemo(() => {
    if (hoveredColumn === null) return null;
    const matched = new Set<string>();
    for (const edge of initialEdges) {
      const data = edge.data;
      if (!data) continue;
      const hitSource =
        data.childTable === hoveredColumn.table &&
        data.childColumn === hoveredColumn.column;
      const hitTarget =
        data.parentTable === hoveredColumn.table &&
        data.parentColumn === hoveredColumn.column;
      if (hitSource || hitTarget) {
        matched.add(edge.id);
      }
    }
    return matched.size > 0 ? matched : null;
  }, [initialEdges, hoveredColumn]);

  const neighbors = useMemo(() => {
    if (matchingColumnEdgeIds !== null) {
      const set = new Set<string>();
      for (const edge of initialEdges) {
        if (matchingColumnEdgeIds.has(edge.id)) {
          set.add(edge.source);
          set.add(edge.target);
        }
      }
      return set;
    }
    if (focus !== null) {
      const set = new Set<string>([focus]);
      for (const edge of initialEdges) {
        if (edge.source === focus) set.add(edge.target);
        if (edge.target === focus) set.add(edge.source);
      }
      return set;
    }
    if (hoveredEdge !== null) {
      const edge = initialEdges.find((item) => item.id === hoveredEdge);
      if (edge) {
        return new Set<string>([edge.source, edge.target]);
      }
    }
    return null;
  }, [initialEdges, focus, hoveredEdge, matchingColumnEdgeIds]);

  const fit = useCallback(
    (duration = 200) => {
      void fitView({ padding: 0.14, maxZoom: 1, duration });
    },
    [fitView],
  );

  const resetLayout = useCallback(() => {
    setNodes(initialNodes);
    window.requestAnimationFrame(() => fit(220));
  }, [initialNodes, setNodes, fit]);

  const styledNodes = useMemo<TableNode[]>(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          dimmed: neighbors !== null && !neighbors.has(node.id),
          focused:
            focus === node.id || (neighbors !== null && neighbors.has(node.id)),
          hoveredColumn:
            hoveredColumn?.table === node.id ? hoveredColumn.column : null,
          onColumnHover: (col: string | null) =>
            setHoveredColumn(col === null ? null : { table: node.id, column: col }),
        },
      })),
    [nodes, neighbors, focus, hoveredColumn],
  );

  const styledEdges = useMemo<RelationEdgeType[]>(
    () =>
      initialEdges.map((edge) => {
        const hitColumn = matchingColumnEdgeIds?.has(edge.id) ?? false;
        const edgeMatchesHover =
          hovered !== null &&
          (edge.source === hovered || edge.target === hovered);
        const showInfo =
          hitColumn || edgeMatchesHover || hoveredEdge === edge.id;
        const active =
          hitColumn ||
          (matchingColumnEdgeIds === null &&
            ((focus !== null &&
              (edge.source === focus || edge.target === focus)) ||
              hoveredEdge === edge.id));
        const dimmed =
          (matchingColumnEdgeIds !== null && !hitColumn) ||
          (matchingColumnEdgeIds === null && focus !== null && !active) ||
          (matchingColumnEdgeIds === null &&
            focus === null &&
            hoveredEdge !== null &&
            hoveredEdge !== edge.id);
        return {
          ...edge,
          data: {
            childTable: edge.data?.childTable ?? "",
            childColumn: edge.data?.childColumn ?? "",
            parentTable: edge.data?.parentTable ?? "",
            parentColumn: edge.data?.parentColumn ?? "",
            accentColor: edge.data?.accentColor ?? "var(--primary)",
            cardinality: edge.data?.cardinality ?? "1:N",
            isSelf: edge.data?.isSelf ?? false,
            active,
            showInfo,
            dimmed,
            onHoverChange: (hovering: boolean) =>
              setHoveredEdge((current) =>
                hovering ? edge.id : current === edge.id ? null : current,
              ),
          },
          zIndex: showInfo ? 20 : active ? 10 : dimmed ? 0 : 1,
        };
      }),
    [initialEdges, focus, hovered, hoveredEdge, matchingColumnEdgeIds],
  );

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onNodeMouseEnter={(_, node) => setHovered(node.id)}
        onNodeMouseLeave={() => {
          setHovered(null);
          setHoveredColumn(null);
        }}
        onEdgeMouseEnter={(_, edge) => setHoveredEdge(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdge(null)}
        onNodeClick={(_, node) => onTableClick?.(node.id)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
          gap={24}
          size={1.1}
          color="color-mix(in oklab, var(--muted-foreground) 22%, transparent)"
        />
        <MiniMap
          pannable
          zoomable
          className="bottom-3! right-3!"
          style={{
            width: 156,
            height: 106,
            background: "var(--surface-alt)",
            border: "1px solid var(--border)",
          }}
          maskColor="color-mix(in oklab, var(--background) 62%, transparent)"
          nodeColor={(node) => {
            const data = node.data as TableData | undefined;
            return data?.accentColor ?? "var(--primary)";
          }}
          nodeStrokeColor={(node) => {
            const data = node.data as TableData | undefined;
            return data?.accentColor ?? "var(--border)";
          }}
          nodeStrokeWidth={1}
        />
      </ReactFlow>

      <div className="pointer-events-auto absolute left-3 top-3 flex flex-wrap items-center gap-2 border border-border bg-surface/95 px-2.5 py-1.5 text-[10.5px] text-muted-dim backdrop-blur-xs">
        <span className="flex items-center gap-1.5">
          <Table2 className="size-3 text-primary" />
          <span className="numeric font-medium text-foreground">
            {initialNodes.length} tables
          </span>
        </span>
        <span className="text-border">·</span>
        <span className="numeric">{initialEdges.length} relations</span>
        <span className="text-border">·</span>
        <span className="flex items-center gap-1">
          <KeyRound className="size-2.5 text-warning" />
          <span>PK</span>
        </span>
        <span className="flex items-center gap-1">
          <Link2 className="size-2.5 text-primary" />
          <span>FK → PK</span>
        </span>
        <span className="text-border">·</span>
        <span className="font-mono text-success">1:1</span>
        <span className="font-mono text-primary">1:N</span>
        <span className="font-mono text-warning">M:N</span>
        <span className="text-border">·</span>
        <span className="text-muted">
          {hoveredColumn
            ? `${hoveredColumn.table}.${hoveredColumn.column}`
            : hovered
              ? `Relations for ${hovered}`
              : "Hover a table, column or edge"}
        </span>
      </div>

      <div className="absolute right-3 top-3 z-10 flex flex-col border border-border bg-surface">
        <FlowButton
          aria-label="Fit view"
          tooltip="Fit all tables in view"
          onClick={() => fit()}
        >
          <Maximize className="size-3" />
        </FlowButton>
        <FlowButton
          aria-label="Reset layout"
          tooltip="Reset table layout"
          className="border-t border-border"
          onClick={resetLayout}
        >
          <RotateCcw className="size-3" />
        </FlowButton>
        <FlowButton
          aria-label="Zoom in"
          tooltip="Zoom in diagram"
          className="border-t border-border"
          onClick={() => void zoomIn({ duration: 150 })}
        >
          <ZoomIn className="size-3" />
        </FlowButton>
        <FlowButton
          aria-label="Zoom out"
          tooltip="Zoom out diagram"
          className="border-t border-border"
          onClick={() => void zoomOut({ duration: 150 })}
        >
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
  tooltip,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  onClick: () => void;
  tooltip: string;
  "aria-label": string;
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={onClick}
          className={cn(
            "flex size-7 items-center justify-center text-muted-dim transition-colors hover:bg-surface-hover hover:text-foreground",
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function RowHandle({
  side,
  id,
  color,
}: {
  side: "left" | "right";
  id: string;
  color: string;
}): React.ReactElement {
  return (
    <Handle
      type={id.includes("-in-") ? "target" : "source"}
      id={id}
      position={side === "left" ? Position.Left : Position.Right}
      isConnectable={false}
      style={{
        top: "50%",
        transform: "translateY(-50%)",
        [side]: -HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        background: color,
        border: "1.5px solid var(--surface)",
        borderRadius: 0,
      }}
    />
  );
}

function TableCard({
  data,
  selected,
}: NodeProps<TableNode>): React.ReactElement {
  const accent = data.accentColor;
  const activeBorder = selected || data.focused;

  return (
    <div
      className={cn(
        "animate-rise-in bg-surface transition-[opacity,transform,box-shadow,outline-color] duration-200",
        data.dimmed ? "opacity-25" : "hover:-translate-y-0.5",
      )}
      style={{
        width: NODE_WIDTH,
        animationDelay: `${Math.min(data.order * 35, 280)}ms`,
        outline: activeBorder
          ? `1.5px solid ${accent}`
          : `1px solid color-mix(in oklab, ${accent} 34%, var(--border))`,
        boxShadow: activeBorder
          ? `0 0 0 1px color-mix(in oklab, ${accent} 25%, transparent), 0 8px 20px -10px color-mix(in oklab, ${accent} 40%, transparent)`
          : "var(--shadow-panel)",
      }}
    >
      <div
        className="h-[3px] w-full"
        style={{ background: accent }}
        aria-hidden="true"
      />
      <div
        className="flex h-[34px] items-center gap-2 border-b border-border px-2.5"
        style={{
          background: `color-mix(in oklab, ${accent} 10%, var(--surface-alt))`,
        }}
      >
        <span
          className="size-2 shrink-0"
          style={{ background: accent }}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] font-semibold text-foreground">
          {data.label}
        </span>
        <span
          className="numeric border px-1.5 py-px font-mono text-[9px] font-medium"
          style={{
            borderColor: `color-mix(in oklab, ${accent} 42%, var(--border))`,
            background: "var(--surface)",
            color: accent,
          }}
        >
          {data.columns.length}
        </span>
      </div>
      <div>
        {data.columns.map((column) => {
          const isHoveredCol = data.hoveredColumn === column.name;
          return (
            <div
              key={column.name}
              onMouseEnter={() => data.onColumnHover?.(column.name)}
              onMouseLeave={() => data.onColumnHover?.(null)}
              className={cn(
                "relative flex h-[22px] items-center gap-1.5 border-b border-border/40 px-2.5 transition-colors last:border-b-0",
                isHoveredCol ? "bg-surface-hover" : "hover:bg-surface-hover/70",
              )}
              style={
                isHoveredCol
                  ? {
                      boxShadow: `inset 2px 0 0 ${accent}`,
                    }
                  : undefined
              }
            >
              {column.source ? (
                <>
                  <RowHandle
                    side="left"
                    id={`l-out-${column.name}`}
                    color={accent}
                  />
                  <RowHandle
                    side="right"
                    id={`r-out-${column.name}`}
                    color={accent}
                  />
                </>
              ) : null}
              {column.target ? (
                <>
                  <RowHandle
                    side="left"
                    id={`l-in-${column.name}`}
                    color={
                      column.pk ? "var(--warning)" : "var(--muted-foreground)"
                    }
                  />
                  <RowHandle
                    side="right"
                    id={`r-in-${column.name}`}
                    color={
                      column.pk ? "var(--warning)" : "var(--muted-foreground)"
                    }
                  />
                </>
              ) : null}
              <span className="flex w-3 shrink-0 justify-center">
                {column.pk ? (
                  <KeyRound className="size-2.5 text-warning" />
                ) : column.fk ? (
                  <Link2 className="size-2.5" style={{ color: accent }} />
                ) : null}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate font-mono text-[10.5px]",
                  column.pk
                    ? "font-semibold text-foreground"
                    : column.fk
                      ? "font-medium text-foreground/95"
                      : "text-foreground/85",
                )}
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

function edgeStrokeColor(
  cardinality: CardinalityKind,
  active: boolean,
  accentColor: string,
): string {
  if (!active) {
    return `color-mix(in oklab, ${accentColor} 48%, var(--muted-foreground))`;
  }
  if (cardinality === "1:1") return "var(--success)";
  if (cardinality === "M:N") return "var(--warning)";
  return accentColor;
}

function directionalArrowPath(
  targetX: number,
  targetY: number,
  targetPosition: Position,
): string {
  const dir = targetPosition === Position.Left ? -1 : 1;
  const tipX = targetX + dir * 2;
  const backX = targetX + dir * 10;
  return `M ${backX} ${targetY - 4} L ${tipX} ${targetY} L ${backX} ${targetY + 4} Z`;
}

function selfLoopPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): [string, number, number] {
  const loopX = Math.max(sourceX, targetX) + 52;
  const path = `M ${sourceX} ${sourceY} L ${loopX} ${sourceY} L ${loopX} ${targetY} L ${targetX} ${targetY}`;
  return [path, loopX, (sourceY + targetY) / 2];
}

function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<RelationEdgeType>): React.ReactElement {
  const edgeData = data ?? {
    childTable: "",
    childColumn: "",
    parentTable: "",
    parentColumn: "",
    accentColor: "var(--primary)",
    cardinality: "1:N" as CardinalityKind,
    isSelf: false,
    active: false,
    showInfo: false,
    dimmed: false,
  };

  const [path, labelX, labelY] = edgeData.isSelf
    ? selfLoopPath(sourceX, sourceY, targetX, targetY)
    : getSmoothStepPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        borderRadius: 0,
        offset: 26,
      });

  const showInfo = edgeData.showInfo || selected === true;
  const active = edgeData.active || showInfo;
  const opacity = edgeData.dimmed ? 0.14 : active ? 1 : 0.82;
  const stroke = edgeStrokeColor(
    edgeData.cardinality,
    active,
    edgeData.accentColor,
  );
  const strokeWidth = active ? 2 : 1.35;
  const spread = 5;
  const reach = 11;
  const sourceOut = sourcePosition === Position.Right ? 1 : -1;
  const targetOut = targetPosition === Position.Left ? -1 : 1;

  const foot = `M ${sourceX} ${sourceY - spread} L ${sourceX + sourceOut * reach} ${sourceY} L ${sourceX} ${sourceY + spread}`;
  const oneBar = `M ${targetX + targetOut * reach} ${targetY - spread} L ${targetX + targetOut * reach} ${targetY + spread}`;
  const arrowHead = directionalArrowPath(targetX, targetY, targetPosition);

  return (
    <>
      {active ? (
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={6}
          opacity={0.2}
          className="pointer-events-none"
        />
      ) : null}
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={18}
        style={{
          stroke,
          strokeWidth,
          opacity,
          fill: "none",
          strokeDasharray: active ? "6 4" : undefined,
          animation: active ? "edge-flow 1.1s linear infinite" : undefined,
          transition: "opacity 180ms ease, stroke-width 180ms ease",
        }}
      />
      <path
        d={arrowHead}
        fill={stroke}
        opacity={edgeData.dimmed ? 0.14 : active ? 1 : 0.88}
        className="pointer-events-none transition-opacity duration-150"
      />
      {!edgeData.dimmed ? (
        <circle
          r={active ? 3 : 2}
          fill={stroke}
          className="animate-edge-dot pointer-events-none"
          style={{
            offsetPath: `path("${path}")`,
            opacity: active ? 1 : 0.45,
          }}
        />
      ) : null}
      {showInfo ? (
        <>
          <path
            d={
              edgeData.cardinality === "1:1"
                ? `M ${sourceX + sourceOut * reach} ${sourceY - spread} L ${sourceX + sourceOut * reach} ${sourceY + spread}`
                : foot
            }
            stroke={stroke}
            strokeWidth={strokeWidth}
            fill="none"
            opacity={opacity}
          />
          <path
            d={oneBar}
            stroke={stroke}
            strokeWidth={strokeWidth}
            fill="none"
            opacity={opacity}
          />
          <EdgeLabelRenderer>
            <Cardinality
              x={sourceX + sourceOut * (reach + 14)}
              y={sourceY - 12}
              label={
                edgeData.cardinality === "1:1"
                  ? "1"
                  : edgeData.cardinality === "M:N"
                    ? "M"
                    : "N"
              }
              color={stroke}
              opacity={1}
            />
            <Cardinality
              x={targetX + targetOut * (reach + 14)}
              y={targetY - 12}
              label={edgeData.cardinality === "M:N" ? "N" : "1"}
              color={stroke}
              opacity={1}
            />
            <div
              className="nodrag nopan absolute whitespace-nowrap"
              onMouseEnter={() => edgeData.onHoverChange?.(true)}
              onMouseLeave={() => edgeData.onHoverChange?.(false)}
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                pointerEvents: "auto",
                zIndex: 30,
              }}
            >
              <div
                className="animate-rise-in flex select-none items-center gap-1.5 border bg-surface px-2 py-0.5 font-mono text-[10px] text-foreground shadow-sm"
                style={{ borderColor: stroke }}
              >
                <span className="font-semibold" style={{ color: stroke }}>
                  {edgeData.childTable}.{edgeData.childColumn}
                </span>
                <span
                  className={cn(
                    "px-1 py-px text-[9px] font-semibold",
                    edgeData.cardinality === "1:1"
                      ? "bg-success/15 text-success"
                      : edgeData.cardinality === "M:N"
                        ? "bg-warning/15 text-warning"
                        : "bg-primary/15 text-primary",
                  )}
                >
                  {edgeData.cardinality}
                </span>
                <span className="font-semibold text-warning">
                  {edgeData.parentTable}.{edgeData.parentColumn}
                </span>
              </div>
            </div>
          </EdgeLabelRenderer>
        </>
      ) : null}
    </>
  );
}

function Cardinality({
  x,
  y,
  label,
  color,
  opacity,
}: {
  x: number;
  y: number;
  label: string;
  color: string;
  opacity: number;
}): React.ReactElement {
  return (
    <div
      className="nodrag nopan absolute text-center font-semibold"
      style={{
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        pointerEvents: "none",
        width: 14,
        fontSize: 9,
        lineHeight: "14px",
        fontFamily: "var(--font-mono)",
        color,
        opacity,
      }}
    >
      {label}
    </div>
  );
}

function inferCardinality(child: TableInfo, childColumn: string): CardinalityKind {
  const pkCols =
    child.primaryKey ??
    child.columns.filter((c) => c.primaryKey).map((c) => c.name);
  if (child.foreignKeys.length >= 2 && pkCols.includes(childColumn)) {
    return "M:N";
  }
  if (pkCols.length === 1 && pkCols[0] === childColumn) {
    return "1:1";
  }
  return "1:N";
}

function buildGraph(tables: TableInfo[]): {
  nodes: TableNode[];
  edges: RelationEdgeType[];
} {
  const byName = new Map(
    tables.map((table) => [table.name.toLowerCase(), table]),
  );
  const accentByName = new Map<string, string>();
  const sortedForPalette = [...tables].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  sortedForPalette.forEach((table, idx) => {
    accentByName.set(
      table.name,
      TABLE_ACCENTS[idx % TABLE_ACCENTS.length]!,
    );
  });

  const heights = new Map<string, number>();
  for (const table of tables) {
    heights.set(
      table.name,
      HEADER_HEIGHT + ROW_HEIGHT * table.columns.length + 1,
    );
  }

  const relations: Relation[] = [];
  const seen = new Set<string>();
  for (const table of tables) {
    for (const key of table.foreignKeys) {
      const parent = byName.get(key.table.toLowerCase());
      if (parent === undefined) continue;
      if (parent.columns.some((column) => column.name === key.to) === false)
        continue;
      const dedupe = `${table.name}.${key.from}>${parent.name}.${key.to}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      relations.push({
        child: table.name,
        childColumn: key.from,
        parent: parent.name,
        parentColumn: key.to,
        cardinality: inferCardinality(table, key.from),
      });
    }
    for (const column of table.columns) {
      if (!column.name.endsWith("_id")) continue;
      const targetBase = column.name.slice(0, -3).toLowerCase();
      const parent =
        byName.get(targetBase) ??
        byName.get(`${targetBase}s`) ??
        byName.get(`${targetBase}es`);
      if (parent === undefined || parent.name === table.name) continue;
      const pkCol =
        parent.primaryKey?.[0] ??
        parent.columns.find((c) => c.primaryKey || c.name === "id")?.name;
      if (!pkCol) continue;
      const dedupe = `${table.name}.${column.name}>${parent.name}.${pkCol}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      relations.push({
        child: table.name,
        childColumn: column.name,
        parent: parent.name,
        parentColumn: pkCol,
        cardinality: inferCardinality(table, column.name),
      });
    }
  }

  const parentsOf = new Map<string, Relation[]>();
  for (const relation of relations) {
    if (relation.child === relation.parent) continue;
    parentsOf.set(relation.child, [
      ...(parentsOf.get(relation.child) ?? []),
      relation,
    ]);
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
      parents.length === 0
        ? 0
        : Math.max(...parents.map((parent) => depth(parent.parent) + 1));
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
    for (const name of layerBuckets.get(layer) ?? [])
      layerIndex.set(name, layer);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const layer of layers) {
    const names = (layerBuckets.get(layer) ?? []).sort((a, b) =>
      a.localeCompare(b),
    );
    let y = 0;
    for (const name of names) {
      positions.set(name, {
        x: (layerIndex.get(name) ?? 0) * (NODE_WIDTH + X_GAP),
        y,
      });
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
            relation.child !== relation.parent &&
            ((relation.child === name && positions.has(relation.parent)) ||
              (relation.parent === name && positions.has(relation.child))),
        );
        if (related.length === 0) {
          centers.set(name, positions.get(name)?.y ?? 0);
          continue;
        }
        const sum = related.reduce((total, relation) => {
          const other =
            relation.child === name ? relation.parent : relation.child;
          const position = positions.get(other);
          const height = heights.get(other) ?? 0;
          return total + (position?.y ?? 0) + height / 2;
        }, 0);
        centers.set(
          name,
          sum / related.length - (heights.get(name) ?? 0) / 2,
        );
      }
      const ordered = [...names].sort(
        (a, b) => (centers.get(a) ?? 0) - (centers.get(b) ?? 0),
      );
      let cursor = Number.NEGATIVE_INFINITY;
      for (const name of ordered) {
        const desired = centers.get(name) ?? 0;
        const y = Math.max(desired, cursor);
        positions.set(name, { x: positions.get(name)?.x ?? 0, y });
        cursor = y + (heights.get(name) ?? 0) + Y_GAP;
      }
    }
  }

  const sourceSet = new Set(
    relations.map((relation) => `${relation.child}:${relation.childColumn}`),
  );
  const targetSet = new Set(
    relations.map((relation) => `${relation.parent}:${relation.parentColumn}`),
  );

  const nodes: TableNode[] = tables.map((table, index) => {
    const pkSet = new Set(table.primaryKey ?? []);
    const fkSet = new Set(table.foreignKeys.map((key) => key.from));
    const accentColor = accentByName.get(table.name) ?? "var(--primary)";
    return {
      id: table.name,
      type: "erTable",
      position: positions.get(table.name) ?? { x: 0, y: 0 },
      data: {
        label: table.name,
        accentColor,
        order: index,
        dimmed: false,
        focused: false,
        hoveredColumn: null,
        columns: table.columns.map((column) => ({
          name: column.name,
          type: column.type || "text",
          pk: column.primaryKey || pkSet.has(column.name),
          fk: fkSet.has(column.name),
          source: sourceSet.has(`${table.name}:${column.name}`),
          target: targetSet.has(`${table.name}:${column.name}`),
        })),
      },
    };
  });

  const edges: RelationEdgeType[] = relations.map((relation) => {
    const isSelf = relation.child === relation.parent;
    const childX = positions.get(relation.child)?.x ?? 0;
    const parentX = positions.get(relation.parent)?.x ?? 0;
    const childLeft = isSelf ? false : childX <= parentX;
    const accentColor =
      accentByName.get(relation.child) ?? "var(--primary)";
    return {
      id: `${relation.child}.${relation.childColumn}->${relation.parent}.${relation.parentColumn}`,
      type: "relation",
      source: relation.child,
      target: relation.parent,
      sourceHandle: isSelf
        ? `r-out-${relation.childColumn}`
        : `${childLeft ? "r" : "l"}-out-${relation.childColumn}`,
      targetHandle: isSelf
        ? `r-in-${relation.parentColumn}`
        : `${childLeft ? "l" : "r"}-in-${relation.parentColumn}`,
      data: {
        childTable: relation.child,
        childColumn: relation.childColumn,
        parentTable: relation.parent,
        parentColumn: relation.parentColumn,
        accentColor,
        cardinality: relation.cardinality,
        isSelf,
        active: false,
        showInfo: false,
        dimmed: false,
      },
    };
  });

  return { nodes, edges };
}
