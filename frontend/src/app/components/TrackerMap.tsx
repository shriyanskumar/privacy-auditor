import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import * as d3 from "d3";

type TrackerNode = d3.SimulationNodeDatum & {
  id: string;
  label: string;
  type: "tracker" | "domain";
  category?: string;
  risk?: string;
  domainCount?: number;
  browser?: string;
};

type TrackerEdge = d3.SimulationLinkDatum<TrackerNode>;

type TrackerSummary = {
  totalTrackers: number;
  byCategory: Record<string, number>;
  byBrowser: Record<string, number>;
};

type TrackerData = {
  nodes: TrackerNode[];
  edges: TrackerEdge[];
  summary: TrackerSummary;
};

const riskColor = (risk?: string) => {
  if (risk === "high") return "#FF4444";
  if (risk === "medium") return "#F0A500";
  return "#00C48C";
};

const nodeRadius = (node: TrackerNode) => (node.type === "tracker" ? 18 : 8);

function buildGraph(
  svgEl: SVGSVGElement,
  containerEl: HTMLElement,
  nodes: TrackerNode[],
  edges: TrackerEdge[],
  tooltipEl: HTMLDivElement | null,
  opts: { zoom?: boolean; height?: number } = {},
) {
  const svg = d3.select(svgEl);
  svg.selectAll("*").remove();

  const width = containerEl.clientWidth;
  const height = opts.height ?? containerEl.clientHeight;
  const padding = 50;

  if (width <= 0 || height <= 0) return () => {};

  svg.attr("width", width).attr("height", height).style("overflow", "hidden");

  const root = svg.append("g").attr("class", "root-group");

  if (opts.zoom) {
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        root.attr("transform", event.transform);
      });
    svg.call(zoom);
  }

  const link = root
    .append("g")
    .attr("stroke", "#4A4A4A")
    .attr("stroke-opacity", 0.75)
    .selectAll("line")
    .data(edges)
    .join("line")
    .attr("stroke-width", 1);

  const simulation = d3
    .forceSimulation<TrackerNode>(nodes)
    .force(
      "link",
      d3
        .forceLink<TrackerNode, TrackerEdge>(edges)
        .id((d) => d.id)
        .distance(80),
    )
    .force("charge", d3.forceManyBody().strength(-42))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("x", d3.forceX(width / 2).strength(0.02))
    .force("y", d3.forceY(height / 2).strength(0.02))
    .force(
      "collision",
      d3
        .forceCollide<TrackerNode>()
        .radius((d) => (d.type === "tracker" ? 34 : 14)),
    );

  const node = root
    .append("g")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", (d) => nodeRadius(d))
    .attr("fill", (d) => (d.type === "tracker" ? riskColor(d.risk) : "#4A90D9"))
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 0.75)
    .call(
      d3
        .drag<any, any>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }),
    );

  const label = root
    .append("g")
    .selectAll("text")
    .data(nodes.filter((n) => n.type === "tracker"))
    .join("text")
    .attr("font-size", 11)
    .attr("fill", "#FFFFFF")
    .attr("text-anchor", "middle")
    .attr("dy", -26)
    .text((d) => d.label);

  if (tooltipEl) {
    const tooltip = d3.select(tooltipEl);

    function handleMouseOver(event: any, d: TrackerNode) {
      const lines = [];
      if (d.type === "tracker") {
        lines.push(`Company: ${d.label}`);
        lines.push(`Category: ${normalizeCategory(d.category)}`);
        lines.push(`Risk: ${d.risk || "low"}`);
        lines.push(`Domains: ${d.domainCount || 0}`);
      } else {
        lines.push(`Domain: ${d.label}`);
        lines.push(`Browser: ${d.browser || "unknown"}`);
      }
      tooltip.html(lines.join("<br />"));
      tooltip.style("display", "block");
      tooltip.style("left", `${event.offsetX + 18}px`);
      tooltip.style("top", `${event.offsetY + 18}px`);
    }

    function handleMouseOut() {
      tooltip.style("display", "none");
    }

    node
      .on("mouseover", handleMouseOver)
      .on("mousemove", handleMouseOver)
      .on("mouseout", handleMouseOut);
  }

  simulation.on("tick", () => {
    node.each((d) => {
      d.x = Math.max(padding, Math.min(width - padding, d.x || 0));
      d.y = Math.max(padding, Math.min(height - padding, d.y || 0));
    });
    link
      .attr("x1", (d) => (d.source as TrackerNode).x || 0)
      .attr("y1", (d) => (d.source as TrackerNode).y || 0)
      .attr("x2", (d) => (d.target as TrackerNode).x || 0)
      .attr("y2", (d) => (d.target as TrackerNode).y || 0);
    node.attr("cx", (d) => d.x || 0).attr("cy", (d) => d.y || 0);
    label.attr("x", (d) => d.x || 0).attr("y", (d) => d.y || 0);
  });

  return () => simulation.stop();
}

function normalizeCategory(category?: string) {
  if (!category) return "Other";
  const n = category.toLowerCase();
  if (n.includes("advertising")) return "Advertising";
  if (n.includes("analytics")) return "Analytics";
  if (n.includes("social")) return "Social";
  if (n.includes("email")) return "Email";
  if (n.includes("fingerprint")) return "Fingerprinting";
  return "Other";
}

const categoryColor = (category: string) => {
  switch (category) {
    case "Advertising":
      return "#FF8C00";
    case "Analytics":
      return "#00C48C";
    case "Social":
      return "#4C6EF5";
    case "Email":
      return "#C084FC";
    case "Fingerprinting":
      return "#FF4444";
    default:
      return "#6E7A8A";
  }
};

const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.035)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255,107,0,0.13)",
  borderRadius: "14px",
};

const tabBase: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: "8px",
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.06em",
  cursor: "pointer",
  border: "none",
  transition: "all 0.18s ease",
  whiteSpace: "nowrap",
};

export function TrackerMap({
  sessionId: propSessionId,
}: {
  sessionId?: string | null;
}) {
  const donutRef = useRef<SVGSVGElement | null>(null);
  const donutContainerRef = useRef<HTMLDivElement | null>(null);

  const previewSvgRef = useRef<SVGSVGElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const previewTooltipRef = useRef<HTMLDivElement | null>(null);

  const modalSvgRef = useRef<SVGSVGElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const modalTooltipRef = useRef<HTMLDivElement | null>(null);

  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphOpen, setGraphOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("companies");

  useEffect(() => {
    if (!propSessionId) {
      setData(null);
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    const API_BASE_URL =
      import.meta.env.VITE_API_URL || "http://localhost:3001";
    fetch(`${API_BASE_URL}/api/trackers/${propSessionId}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.error || `Server responded with status: ${res.status}`,
          );
        }
        return res.json();
      })
      .then((payload: TrackerData) => setData(payload))
      .catch((err) => {
        console.error("TrackerMap — FETCH ERROR:", err);
        setError(err.message || "Failed to fetch tracker data");
      })
      .finally(() => setLoading(false));
  }, [propSessionId]);

  // ── derived data
  const trackerNodes = data?.nodes.filter((n) => n.type === "tracker") ?? [];
  const total = trackerNodes.length;

  // ── FIX: drawDonutChart as reusable useCallback
  const drawDonutChart = useCallback(() => {
    if (!data || !donutRef.current || !donutContainerRef.current) return;

    const categories = [
      "Advertising",
      "Analytics",
      "Social",
      "Email",
      "Fingerprinting",
      "Other",
    ];

    const rawCounts = categories.map((category) => ({
      category,
      value: data.nodes.filter(
        (n) =>
          n.type === "tracker" && normalizeCategory(n.category) === category,
      ).length,
    }));

    // FIX: filter zero-value slices
    const counts = rawCounts.filter((d) => d.value > 0);

    const container = donutContainerRef.current;
    const svg = d3.select(donutRef.current);
    svg.selectAll("*").remove();

    const width = Math.max(container.clientWidth, 220);
    const height = Math.max(container.clientHeight, 220);
    const baseRadius = Math.min(width, height) / 2 - 20;
    const radius = baseRadius * 0.9;

    svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", width)
      .attr("height", height)
      .style("overflow", "visible");

    const chart = svg
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    const pie = d3
      .pie<{ category: string; value: number }>()
      .value((d) => d.value)(counts);

    const arc = d3
      .arc<d3.PieArcDatum<{ category: string; value: number }>>()
      .innerRadius(radius * 0.55)
      .outerRadius(radius);

    const colorScale = d3
      .scaleOrdinal<string, string>()
      .domain(categories)
      .range([
        "#FF8C00",
        "#00C48C",
        "#4C6EF5",
        "#C084FC",
        "#FF4444",
        "#6E7A8A",
      ]);

    // FIX: tooltip element
    const containerEl = donutContainerRef.current;
    let tooltipDiv = d3
      .select(containerEl)
      .select<HTMLDivElement>(".donut-tooltip");
    if (tooltipDiv.empty()) {
      tooltipDiv = d3
        .select(containerEl)
        .append("div")
        .attr("class", "donut-tooltip")
        .style("position", "absolute")
        .style("display", "none")
        .style("background", "rgba(10,10,10,0.92)")
        .style("border", "1px solid rgba(255,107,0,0.4)")
        .style("border-radius", "8px")
        .style("padding", "8px 12px")
        .style("font-size", "11px")
        .style("color", "#FFFFFF")
        .style("pointer-events", "none")
        .style("z-index", "100")
        .style("white-space", "nowrap");
    }

    chart
      .selectAll("path")
      .data(pie)
      .join("path")
      .attr("d", arc as any)
      .attr("fill", (d) => colorScale(d.data.category) || "#4A4A4A")
      .attr("stroke", "#0A0A0A")
      .attr("stroke-width", 2)
      // FIX: hover tooltip on slices
      .on("mouseenter", function (_event, d) {
        const percentage =
          total > 0 ? ((d.data.value / total) * 100).toFixed(0) : "0";
        tooltipDiv
          .style("display", "block")
          .html(
            `<strong style="color:#FF6B00">${d.data.category}</strong><br/>${d.data.value} trackers<br/>${percentage}%`,
          );
      })
      .on("mousemove", function (event) {
        const rect = containerEl.getBoundingClientRect();
        tooltipDiv
          .style("left", `${event.clientX - rect.left + 12}px`)
          .style("top", `${event.clientY - rect.top - 44}px`);
      })
      .on("mouseleave", function () {
        tooltipDiv.style("display", "none");
      });

    // FIX: center text — total count
    chart
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .attr("font-size", "22px")
      .attr("font-weight", "700")
      .attr("fill", "#FFFFFF")
      .text(total);

    // FIX: center text — label
    chart
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.2em")
      .attr("font-size", "9px")
      .attr("font-weight", "600")
      .attr("fill", "#8B8B8B")
      .attr("letter-spacing", "0.15em")
      .text("TRACKERS");
  }, [data, total]);

  // FIX: useLayoutEffect + delay so DOM is ready when tab switches
  useLayoutEffect(() => {
    if (activeTab !== "categories") return;
    const timer = setTimeout(() => {
      drawDonutChart();
    }, 50);
    return () => clearTimeout(timer);
  }, [activeTab, drawDonutChart]);

  // FIX: ResizeObserver to redraw on container size change
  useEffect(() => {
    if (!donutContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (activeTab === "categories") {
        drawDonutChart();
      }
    });
    observer.observe(donutContainerRef.current);
    return () => observer.disconnect();
  }, [activeTab, drawDonutChart]);

  // ── preview graph
  useEffect(() => {
    if (!data || !previewSvgRef.current || !previewContainerRef.current) return;
    if (data.nodes.length === 0) return;
    const clonedNodes: TrackerNode[] = data.nodes.map((n) => ({ ...n }));
    const idToCloned = new Map(clonedNodes.map((n) => [n.id, n]));
    const clonedEdges: TrackerEdge[] = data.edges.map((e) => ({
      source:
        idToCloned.get((e.source as TrackerNode).id ?? (e.source as string)) ??
        e.source,
      target:
        idToCloned.get((e.target as TrackerNode).id ?? (e.target as string)) ??
        e.target,
    }));
    const stop = buildGraph(
      previewSvgRef.current,
      previewContainerRef.current,
      clonedNodes,
      clonedEdges,
      previewTooltipRef.current,
      { height: 300 },
    );
    return stop;
  }, [data]);

  // ── modal graph
  useEffect(() => {
    if (
      !graphOpen ||
      !data ||
      !modalSvgRef.current ||
      !modalContainerRef.current
    )
      return;
    if (data.nodes.length === 0) return;
    const clonedNodes: TrackerNode[] = data.nodes.map((n) => ({ ...n }));
    const idToCloned = new Map(clonedNodes.map((n) => [n.id, n]));
    const clonedEdges: TrackerEdge[] = data.edges.map((e) => ({
      source:
        idToCloned.get((e.source as TrackerNode).id ?? (e.source as string)) ??
        e.source,
      target:
        idToCloned.get((e.target as TrackerNode).id ?? (e.target as string)) ??
        e.target,
    }));
    const stop = buildGraph(
      modalSvgRef.current,
      modalContainerRef.current,
      clonedNodes,
      clonedEdges,
      modalTooltipRef.current,
      { zoom: true },
    );
    return stop;
  }, [graphOpen, data]);

  // ── ESC closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGraphOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── derived data
  const topTrackers = [...trackerNodes]
    .sort((a, b) => (b.domainCount || 0) - (a.domainCount || 0))
    .slice(0, 10);
  const categories = [
    "Advertising",
    "Analytics",
    "Social",
    "Email",
    "Fingerprinting",
    "Other",
  ];
  const categoryBuckets = categories.map((category) => ({
    category,
    value: trackerNodes.filter(
      (n) => normalizeCategory(n.category) === category,
    ).length,
  }));
  const highRiskTrackers = trackerNodes
    .filter((n) => n.risk === "high")
    .sort((a, b) => (b.domainCount || 0) - (a.domainCount || 0));
  const advertising =
    categoryBuckets.find((b) => b.category === "Advertising")?.value ?? 0;
  const analytics =
    categoryBuckets.find((b) => b.category === "Analytics")?.value ?? 0;
  const social =
    categoryBuckets.find((b) => b.category === "Social")?.value ?? 0;
  const maxDomainCount = topTrackers[0]?.domainCount || 1;

  return (
    <div
      style={{
        width: "100%",
        background: "#0A0A0A",
        border: "1px solid rgba(255,107,0,0.35)",
        borderRadius: "20px",
        padding: "28px",
        fontFamily: "'IBM Plex Mono', 'Fira Code', monospace",
        minHeight: "600px",
        position: "relative",
      }}
    >
      {/* ── Loading ── */}
      {loading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "320px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                border: "2px solid rgba(255,107,0,0.2)",
                borderTop: "2px solid #FF6B00",
                borderRadius: "50%",
                animation: "spin 0.9s linear infinite",
              }}
            />
            <span
              style={{
                color: "#8B8B8B",
                fontSize: "12px",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              Scanning trackers…
            </span>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "280px",
          }}
        >
          <div
            style={{ color: "#FF4444", textAlign: "center", fontSize: "14px" }}
          >
            {error}
          </div>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && (!data || data.nodes.length === 0) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "320px",
          }}
        >
          <div
            style={{ color: "#8B8B8B", textAlign: "center", fontSize: "14px" }}
          >
            No trackers detected in browser data
          </div>
        </div>
      )}

      {/* ── Dashboard ── */}
      {!loading && !error && data && data.nodes.length > 0 && (
        <>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            {/* ════ LEFT PANEL (70%) ════ */}
            <div
              style={{
                flex: "0 0 calc(70% - 10px)",
                minWidth: "320px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#FF6B00",
                        boxShadow: "0 0 10px #FF6B00",
                      }}
                    />
                    <h1
                      style={{
                        margin: 0,
                        fontSize: "22px",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      Tracker Fingerprint
                    </h1>
                  </div>
                  <div
                    style={{
                      color: "#8B8B8B",
                      marginTop: "6px",
                      fontSize: "11px",
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                    }}
                  >
                    {total} Trackers Detected
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "10px",
                    color: "#FF6B00",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    border: "1px solid rgba(255,107,0,0.25)",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    background: "rgba(255,107,0,0.06)",
                  }}
                >
                  Live Scan
                </span>
              </div>

              {/* Executive Summary */}
              <div style={{ ...glass, padding: "18px 22px" }}>
                <div
                  style={{
                    color: "#FF6B00",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    fontWeight: 700,
                    marginBottom: "10px",
                  }}
                >
                  Executive Summary
                </div>
                <p
                  style={{
                    margin: 0,
                    color: "#CFCFCF",
                    fontSize: "13px",
                    lineHeight: "1.9",
                  }}
                >
                  Detected <strong style={{ color: "#FFFFFF" }}>{total}</strong>{" "}
                  trackers across multiple services. Advertising trackers
                  account for{" "}
                  <strong style={{ color: "#FF8C00" }}>{advertising}</strong>{" "}
                  detections, Analytics contributes{" "}
                  <strong style={{ color: "#4C6EF5" }}>{analytics}</strong>, and
                  Social trackers total{" "}
                  <strong style={{ color: "#00C48C" }}>{social}</strong>.
                  {highRiskTrackers.length > 0 && (
                    <>
                      {" "}
                      <strong style={{ color: "#FF4444" }}>
                        {highRiskTrackers.length}
                      </strong>{" "}
                      high-risk tracker
                      {highRiskTrackers.length !== 1 ? "s" : ""} identified.
                    </>
                  )}
                </p>
              </div>

              {/* Metrics cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "12px",
                }}
              >
                {[
                  {
                    label: "Total",
                    value: total,
                    color: "#FF6B00",
                    bg: "rgba(255,107,0,0.08)",
                    border: "rgba(255,107,0,0.2)",
                  },
                  {
                    label: "Advertising",
                    value: advertising,
                    color: "#FF8C00",
                    bg: "rgba(255,140,0,0.08)",
                    border: "rgba(255,140,0,0.2)",
                  },
                  {
                    label: "Analytics",
                    value: analytics,
                    color: "#4C6EF5",
                    bg: "rgba(76,110,245,0.08)",
                    border: "rgba(76,110,245,0.2)",
                  },
                  {
                    label: "Social",
                    value: social,
                    color: "#00C48C",
                    bg: "rgba(0,196,140,0.08)",
                    border: "rgba(0,196,140,0.2)",
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    style={{
                      background: m.bg,
                      border: `1px solid ${m.border}`,
                      borderRadius: "12px",
                      padding: "14px 16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "8px",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: m.color,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "9px",
                          textTransform: "uppercase",
                          letterSpacing: "0.18em",
                          color: "#8B8B8B",
                        }}
                      >
                        {m.label}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "30px",
                        fontWeight: 700,
                        color: "#FFFFFF",
                      }}
                    >
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Graph Preview Card */}
              <div
                onClick={() => setGraphOpen(true)}
                style={{
                  ...glass,
                  position: "relative",
                  height: "320px",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "border-color 0.2s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(255,107,0,0.4)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(255,107,0,0.13)")
                }
              >
                <div
                  ref={previewContainerRef}
                  style={{
                    width: "100%",
                    height: "300px",
                    position: "relative",
                  }}
                >
                  <svg
                    ref={previewSvgRef}
                    style={{
                      width: "100%",
                      height: "100%",
                      overflow: "hidden",
                    }}
                  />
                  <div
                    ref={previewTooltipRef}
                    style={{
                      display: "none",
                      position: "absolute",
                      zIndex: 20,
                      pointerEvents: "none",
                      background: "rgba(15,15,15,0.92)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "10px",
                      padding: "8px 12px",
                      fontSize: "11px",
                      color: "#FFFFFF",
                      backdropFilter: "blur(8px)",
                      whiteSpace: "nowrap",
                    }}
                  />
                </div>

                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(to top, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.2) 50%, transparent 100%)",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    paddingBottom: "18px",
                    pointerEvents: "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      background: "rgba(255,107,0,0.12)",
                      border: "1px solid rgba(255,107,0,0.35)",
                      borderRadius: "8px",
                      padding: "8px 18px",
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#FF6B00"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                    <span
                      style={{
                        color: "#FF6B00",
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                      }}
                    >
                      Click to Expand
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    position: "absolute",
                    top: "14px",
                    right: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                    background: "rgba(10,10,10,0.65)",
                    borderRadius: "8px",
                    padding: "8px 10px",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  {[
                    ["#FF4444", "High Risk"],
                    ["#F0A500", "Medium"],
                    ["#00C48C", "Low Risk"],
                  ].map(([c, l]) => (
                    <div
                      key={l}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: "7px",
                          height: "7px",
                          borderRadius: "50%",
                          background: c,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "9px",
                          color: "#CFCFCF",
                          letterSpacing: "0.1em",
                        }}
                      >
                        {l}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ════ RIGHT PANEL (30%) ════ */}
            <div
              style={{
                flex: "1 1 240px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                minWidth: "240px",
                height: "620px",
                maxHeight: "620px",
              }}
            >
              {/* Tab switcher */}
              <div
                style={{
                  ...glass,
                  padding: "5px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  gap: "4px",
                }}
              >
                {[
                  { id: "companies", label: "Companies" },
                  { id: "categories", label: "Categories" },
                  { id: "highrisk", label: "High Risk" },
                  { id: "insights", label: "Insights" },
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        ...tabBase,
                        width: "100%",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        background: active ? "#FF6B00" : "transparent",
                        color: active ? "#000" : "#8B8B8B",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div
                style={{
                  ...glass,
                  padding: "18px",
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  overflowX: "hidden",
                  scrollbarWidth: "thin",
                  scrollbarColor: "#FF6B00 rgba(255,255,255,0.04)",
                }}
                className="tracker-scroll"
              >
                {/* TAB 1: COMPANIES */}
                {activeTab === "companies" && (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "16px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#FFFFFF",
                          }}
                        >
                          Top Tracking Companies
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#8B8B8B",
                            marginTop: "2px",
                          }}
                        >
                          By matched domains
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "9px",
                          color: "#FFB470",
                          background: "rgba(255,107,0,0.08)",
                          border: "1px solid rgba(255,107,0,0.2)",
                          borderRadius: "20px",
                          padding: "2px 8px",
                          letterSpacing: "0.15em",
                          textTransform: "uppercase",
                        }}
                      >
                        Top 10
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0",
                        minHeight: 0,
                      }}
                    >
                      {topTrackers.map((tracker, index) => (
                        <div
                          key={tracker.id}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.06)",
                            padding: "10px 0",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "8px",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: "9px",
                                  color: "#8B8B8B",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.2em",
                                  marginBottom: "2px",
                                }}
                              >
                                #{index + 1}
                              </div>
                              <div
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  color: "#FFFFFF",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {tracker.label}
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div
                                style={{ fontSize: "9px", color: "#8B8B8B" }}
                              >
                                Domains
                              </div>
                              <div
                                style={{
                                  fontSize: "16px",
                                  fontWeight: 700,
                                  color: "#FFFFFF",
                                }}
                              >
                                {tracker.domainCount || 0}
                              </div>
                            </div>
                          </div>
                          <div
                            style={{
                              height: "2px",
                              background: "rgba(255,255,255,0.08)",
                              borderRadius: "2px",
                              margin: "8px 0",
                            }}
                          >
                            <div
                              style={{
                                height: "2px",
                                background: "#FF6B00",
                                borderRadius: "2px",
                                width: `${Math.max(6, ((tracker.domainCount || 0) / maxDomainCount) * 100)}%`,
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>
                          <div style={{ display: "flex", gap: "5px" }}>
                            <span
                              style={{
                                fontSize: "9px",
                                color: "#8B8B8B",
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "20px",
                                padding: "2px 7px",
                              }}
                            >
                              {normalizeCategory(tracker.category)}
                            </span>
                            <span
                              style={{
                                fontSize: "9px",
                                color: riskColor(tracker.risk),
                                background: `${riskColor(tracker.risk)}18`,
                                border: `1px solid ${riskColor(tracker.risk)}44`,
                                borderRadius: "20px",
                                padding: "2px 7px",
                              }}
                            >
                              {tracker.risk || "low"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 2: CATEGORIES */}
                {activeTab === "categories" && (
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        marginBottom: "4px",
                      }}
                    >
                      Tracker Categories
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#8B8B8B",
                        marginBottom: "16px",
                      }}
                    >
                      Distribution across all detections
                    </div>

                    {/* FIX: updated container size to 220px */}
                    <div
                      ref={donutContainerRef}
                      style={{
                        position: "relative",
                        display: "flex",
                        justifyContent: "center",
                        height: "220px",
                        marginBottom: "16px",
                      }}
                    >
                      <svg
                        ref={donutRef}
                        style={{
                          width: "100%",
                          maxWidth: "220px",
                          height: "220px",
                          overflow: "visible",
                        }}
                        preserveAspectRatio="xMidYMid meet"
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0",
                      }}
                    >
                      {categoryBuckets.map((bucket) => (
                        <div
                          key={bucket.category}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderBottom: "1px solid rgba(255,255,255,0.07)",
                            padding: "9px 0",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-block",
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: categoryColor(bucket.category),
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{ fontSize: "12px", color: "#CFCFCF" }}
                            >
                              {bucket.category}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: 700,
                              color: "#FFFFFF",
                            }}
                          >
                            {bucket.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: HIGH RISK */}
                {activeTab === "highrisk" && (
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        marginBottom: "4px",
                      }}
                    >
                      Highest Risk Trackers
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#8B8B8B",
                        marginBottom: "16px",
                      }}
                    >
                      High-risk companies by exposed domains
                    </div>
                    {highRiskTrackers.length === 0 ? (
                      <div
                        style={{
                          color: "#8B8B8B",
                          fontSize: "13px",
                          padding: "20px 0",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontSize: "24px", marginBottom: "8px" }}>
                          ✓
                        </div>
                        No high-risk trackers detected
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {highRiskTrackers.slice(0, 6).map((tracker) => (
                          <div
                            key={tracker.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              gap: "10px",
                              borderBottom: "1px solid rgba(255,255,255,0.06)",
                              padding: "11px 0",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  color: "#FFFFFF",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {tracker.label}
                              </div>
                              <div
                                style={{
                                  fontSize: "10px",
                                  color: "#8B8B8B",
                                  marginTop: "3px",
                                }}
                              >
                                {normalizeCategory(tracker.category)}
                              </div>
                              <div
                                style={{
                                  fontSize: "10px",
                                  color: "#8B8B8B",
                                  marginTop: "1px",
                                }}
                              >
                                Domains: {tracker.domainCount || 0}
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "9px",
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.1em",
                                  color: "#FF4444",
                                  background: "rgba(255,68,68,0.1)",
                                  border: "1px solid rgba(255,68,68,0.35)",
                                  borderRadius: "5px",
                                  padding: "3px 7px",
                                }}
                              >
                                High
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: INSIGHTS */}
                {activeTab === "insights" && (
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        marginBottom: "4px",
                      }}
                    >
                      Insights
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#8B8B8B",
                        marginBottom: "16px",
                      }}
                    >
                      Actionable context from this scan
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0",
                      }}
                    >
                      {[
                        {
                          label: "Exposure",
                          text: `${total} tracker${total !== 1 ? "s" : ""} detected. ${total > 20 ? "This is a notably high fingerprint volume." : total > 10 ? "Moderate tracker exposure across services." : "Low tracker exposure detected."}`,
                        },
                        {
                          label: "Advertising",
                          text:
                            advertising > 0
                              ? `${advertising} advertising tracker${advertising !== 1 ? "s" : ""} found — ${((advertising / total) * 100).toFixed(0)}% of total. ${advertising > analytics ? "Advertising dominates this scan." : "Advertising is secondary to analytics."}`
                              : "No advertising trackers detected.",
                        },
                        {
                          label: "Analytics",
                          text:
                            analytics > 0
                              ? `${analytics} analytics tracker${analytics !== 1 ? "s" : ""} detected (${((analytics / total) * 100).toFixed(0)}% of total). These typically harvest behavioral patterns.`
                              : "No analytics trackers detected.",
                        },
                        {
                          label: "Risk Profile",
                          text:
                            highRiskTrackers.length > 0
                              ? `${highRiskTrackers.length} high-risk tracker${highRiskTrackers.length !== 1 ? "s" : ""} identified. Top threat: ${highRiskTrackers[0]?.label ?? "unknown"} with ${highRiskTrackers[0]?.domainCount || 0} exposed domains.`
                              : "No high-risk trackers found. Low threat profile.",
                        },
                        {
                          label: "Social",
                          text:
                            social > 0
                              ? `${social} social tracker${social !== 1 ? "s" : ""} present — cross-site identity linking is likely active.`
                              : "No social trackers detected. Cross-site linking risk is low.",
                        },
                        {
                          label: "Recommendation",
                          text:
                            topTrackers.length > 0
                              ? `Focus on the top 3 companies first: ${topTrackers
                                  .slice(0, 3)
                                  .map((t) => t.label)
                                  .join(
                                    ", ",
                                  )}. Blocking these will have the greatest privacy impact.`
                              : "No specific recommendations — clean scan.",
                        },
                      ].map(({ label, text }) => (
                        <div
                          key={label}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.07)",
                            padding: "11px 0",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "9px",
                              textTransform: "uppercase",
                              letterSpacing: "0.2em",
                              color: "#FF6B00",
                              marginBottom: "5px",
                            }}
                          >
                            {label}
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#CFCFCF",
                              lineHeight: "1.7",
                            }}
                          >
                            {text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ════ MODAL ════ */}
          {graphOpen && (
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) setGraphOpen(false);
              }}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1000,
                background: "rgba(0,0,0,0.78)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "90vw",
                  height: "85vh",
                  background: "#0D0D0D",
                  border: "1px solid rgba(255,107,0,0.3)",
                  borderRadius: "18px",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  boxShadow: "0 0 60px rgba(255,107,0,0.12)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 24px",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#FF6B00",
                        boxShadow: "0 0 8px #FF6B00",
                      }}
                    />
                    <span
                      style={{
                        color: "#FFFFFF",
                        fontSize: "14px",
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                      }}
                    >
                      Tracker Network Graph
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      {[
                        ["#FF4444", "High Risk"],
                        ["#F0A500", "Medium"],
                        ["#00C48C", "Low Risk"],
                        ["#4A90D9", "Domain"],
                      ].map(([c, l]) => (
                        <div
                          key={l}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: "7px",
                              height: "7px",
                              borderRadius: "50%",
                              background: c,
                            }}
                          />
                          <span style={{ fontSize: "10px", color: "#8B8B8B" }}>
                            {l}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setGraphOpen(false)}
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        color: "#CFCFCF",
                        cursor: "pointer",
                        width: "32px",
                        height: "32px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div
                  ref={modalContainerRef}
                  style={{ flex: 1, position: "relative", overflow: "hidden" }}
                >
                  <svg
                    ref={modalSvgRef}
                    style={{ width: "100%", height: "100%" }}
                  />
                  <div
                    ref={modalTooltipRef}
                    style={{
                      display: "none",
                      position: "absolute",
                      zIndex: 30,
                      pointerEvents: "none",
                      background: "rgba(10,10,10,0.92)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "10px",
                      padding: "8px 12px",
                      fontSize: "11px",
                      color: "#FFFFFF",
                      backdropFilter: "blur(8px)",
                      whiteSpace: "nowrap",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: "14px",
                      right: "14px",
                      fontSize: "10px",
                      color: "rgba(255,255,255,0.3)",
                      letterSpacing: "0.12em",
                    }}
                  >
                    Scroll to zoom · Drag to pan · Drag nodes to reposition
                  </div>
                </div>
              </div>
            </div>
          )}

          <style>{`
            .tracker-scroll::-webkit-scrollbar { width: 6px; }
            .tracker-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 999px; }
            .tracker-scroll::-webkit-scrollbar-thumb { background: rgba(255,107,0,0.7); border-radius: 999px; }
            .tracker-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,107,0,1); }
            @media (max-width: 768px) { .tracker-panels > * { flex: 0 0 100% !important; min-width: 0 !important; } }
          `}</style>
        </>
      )}
    </div>
  );
}
