import { useEffect, useRef, useState } from "react";
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

function StaticPreviewGraph({ data }: { data: TrackerData }) {
  const width = 400;
  const height = 280;
  const cx = width / 2;
  const cy = height / 2;

  const nodes = data.nodes;
  const edges = data.edges;

  const nodePositions: Record<string, { x: number; y: number; type: string; risk?: string }> = {};

  const domains = nodes.filter((n) => n.type === "domain");
  const trackers = nodes.filter((n) => n.type === "tracker");

  // Position domains at the center
  domains.forEach((d, idx) => {
    if (domains.length === 1) {
      nodePositions[d.id] = { x: cx, y: cy, type: d.type };
    } else {
      const angle = (idx * 2 * Math.PI) / domains.length;
      const r = 20;
      nodePositions[d.id] = {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        type: d.type,
      };
    }
  });

  // Position trackers in a circle
  trackers.forEach((t, idx) => {
    const angle = (idx * 2 * Math.PI) / trackers.length;
    const r = Math.min(width, height) / 2 - 35;
    nodePositions[t.id] = {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      type: t.type,
      risk: t.risk,
    };
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      {/* Draw edges */}
      {edges.map((edge, idx) => {
        const sourceId = typeof edge.source === "object" ? (edge.source as any).id : edge.source;
        const targetId = typeof edge.target === "object" ? (edge.target as any).id : edge.target;
        const p1 = nodePositions[sourceId];
        const p2 = nodePositions[targetId];
        if (!p1 || !p2) return null;
        return (
          <line
            key={`edge-${idx}`}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="#4A4A4A"
            strokeOpacity={0.35}
            strokeWidth={1}
          />
        );
      })}

      {/* Draw nodes */}
      {nodes.map((node) => {
        const pos = nodePositions[node.id];
        if (!pos) return null;
        const isTracker = pos.type === "tracker";
        const radius = isTracker ? 7 : 4;
        const color = isTracker ? riskColor(pos.risk) : "#4A90D9";
        return (
          <circle
            key={`node-${node.id}`}
            cx={pos.x}
            cy={pos.y}
            r={radius}
            fill={color}
            stroke="#121212"
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}

export function TrackerMap({
  sessionId: propSessionId,
}: {
  sessionId?: string | null;
}) {
  const donutRef = useRef<SVGSVGElement | null>(null);
  const donutContainerRef = useRef<HTMLDivElement | null>(null);
  const advancedSvgRef = useRef<SVGSVGElement | null>(null);
  const networkContainerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"companies" | "categories" | "risk" | "insights">("companies");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {

    if (!propSessionId) {
      setData(null);
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    // Dynamic API resolution using Vite environment variables to avoid machine-specific hardcoding
    const API_BASE_URL =
      import.meta.env.VITE_API_URL || "http://localhost:3001";
    const targetUrl = `${API_BASE_URL}/api/trackers/${propSessionId}`;

    fetch(targetUrl)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.error || `Server responded with status: ${res.status}`,
          );
        }
        return res.json();
      })
      .then((payload: TrackerData) => {
        setData(payload);
      })
      .catch((err) => {
        console.error("TrackerMap — FETCH ERROR:", err);
        setError(err.message || "Failed to fetch tracker data");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [propSessionId]);

  useEffect(() => {
    if (!data || !donutRef.current || !donutContainerRef.current) return;

    const categories = [
      "Advertising",
      "Analytics",
      "Social",
      "Email",
      "Fingerprinting",
      "Other",
    ];

    const counts = categories.map((category) => ({
      category,
      value: data.nodes.filter(
        (node) =>
          node.type === "tracker" &&
          normalizeCategory(node.category) === category,
      ).length,
    }));

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
      .arc<{ category: string; value: number }>()
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

    chart
      .selectAll("path")
      .data(pie)
      .join("path")
      .attr("d", arc as any)
      .attr("fill", (d) => colorScale(d.data.category) || "#4A4A4A")
      .attr("stroke", "#0A0A0A")
      .attr("stroke-width", 2);
  }, [data, activeTab]);

  useEffect(() => {
    if (!isModalOpen || !data || !advancedSvgRef.current || !networkContainerRef.current)
      return;
    if (data.nodes.length === 0) return;

    const svg = d3.select(advancedSvgRef.current);
    svg.selectAll("*").remove();

    const width = networkContainerRef.current.clientWidth;
    const height = Math.max(networkContainerRef.current.clientHeight, 0);
    const padding = 50;

    if (width <= 0 || height <= 0) return;

    svg.attr("width", width).attr("height", height).style("overflow", "hidden");

    // Create a container group for link, node, and label elements to allow panning/zooming
    const containerG = svg.append("g");

    // Add D3 zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => {
        containerG.attr("transform", event.transform);
      });
    svg.call(zoom);

    const tooltip = d3.select(tooltipRef.current);

    // Clone data to avoid mutating original objects if we open/re-open simulations
    const clonedNodes: TrackerNode[] = data.nodes.map((n) => ({ ...n }));
    const clonedLinks: TrackerEdge[] = data.edges.map((e) => {
      const sourceId = typeof e.source === "object" ? (e.source as any).id : e.source;
      const targetId = typeof e.target === "object" ? (e.target as any).id : e.target;
      return {
        ...e,
        source: sourceId,
        target: targetId,
      };
    });

    const link = containerG
      .append("g")
      .attr("stroke", "#4A4A4A")
      .attr("stroke-opacity", 0.75)
      .selectAll("line")
      .data(clonedLinks)
      .join("line")
      .attr("stroke-width", 1);

    const simulation = d3
      .forceSimulation<TrackerNode>(clonedNodes)
      .force(
        "link",
        d3
          .forceLink<TrackerNode, TrackerEdge>(clonedLinks)
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

    const node = containerG
      .append("g")
      .selectAll("circle")
      .data(clonedNodes)
      .join("circle")
      .attr("r", (d) => nodeRadius(d))
      .attr("fill", (d) =>
        d.type === "tracker" ? riskColor(d.risk) : "#4A90D9",
      )
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

    const label = containerG
      .append("g")
      .selectAll("text")
      .data(clonedNodes.filter((node) => node.type === "tracker"))
      .join("text")
      .attr("font-size", 11)
      .attr("fill", "#FFFFFF")
      .attr("text-anchor", "middle")
      .attr("dy", -26)
      .text((d) => d.label);

    function handleMouseOver(event: any, d: TrackerNode) {
      if (!tooltipRef.current) return;
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
      if (!tooltipRef.current) return;
      tooltip.style("display", "none");
    }

    node
      .on("mouseover", handleMouseOver)
      .on("mousemove", handleMouseOver)
      .on("mouseout", handleMouseOut);

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

    return () => {
      simulation.stop();
    };
  }, [data, isModalOpen]);

  const normalizeCategory = (category?: string) => {
    if (!category) return "Other";
    const normalized = category.toLowerCase();
    if (normalized.includes("advertising")) return "Advertising";
    if (normalized.includes("analytics")) return "Analytics";
    if (normalized.includes("social")) return "Social";
    if (normalized.includes("email")) return "Email";
    if (normalized.includes("fingerprint")) return "Fingerprinting";
    return "Other";
  };

  const trackerNodes =
    data?.nodes.filter((node) => node.type === "tracker") ?? [];
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
      (node) => normalizeCategory(node.category) === category,
    ).length,
  }));

  const highRiskTrackers = trackerNodes
    .filter((node) => node.risk === "high")
    .sort((a, b) => (b.domainCount || 0) - (a.domainCount || 0));

  const total = trackerNodes.length;
  const advertising =
    categoryBuckets.find((bucket) => bucket.category === "Advertising")
      ?.value ?? 0;
  const analytics =
    categoryBuckets.find((bucket) => bucket.category === "Analytics")?.value ??
    0;
  const social =
    categoryBuckets.find((bucket) => bucket.category === "Social")?.value ?? 0;

  const maxDomainCount = topTrackers[0]?.domainCount || 1;

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

  return (
    <div
      style={{
        width: "100%",
        background: "#0A0A0A",
        border: "1px solid #FF6B00",
        borderRadius: "16px",
        padding: "32px",
      }}
    >
      {error ? (
        <div className="flex min-h-[280px] items-center justify-center">
          <div className="text-center text-red-400">{error}</div>
        </div>
      ) : !data || data.nodes.length === 0 ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="text-center text-[#8B8B8B]">
            No trackers detected in browser data
          </div>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h1
              className="text-white"
              style={{
                fontSize: "28px",
                fontWeight: 700,
              }}
            >
              Tracker Fingerprint
            </h1>

            <div
              style={{
                color: "#8B8B8B",
                marginTop: "8px",
                fontSize: "13px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              {total} Trackers Detected
            </div>

            <div style={{ marginTop: "24px" }}>
              <div
                style={{
                  color: "#FF6B00",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  marginBottom: "10px",
                  fontWeight: 600,
                }}
              >
                Executive Summary
              </div>

              <div
                style={{
                  padding: "18px 22px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,107,0,0.12)",
                  borderRadius: "12px",
                  color: "#CFCFCF",
                  fontSize: "15px",
                  lineHeight: "1.8",
                }}
              >
                Detected{" "}
                <span style={{ color: "#FFFFFF", fontWeight: 700 }}>
                  {total}
                </span>{" "}
                trackers across multiple services.
                <br />
                <br />
                Advertising trackers account for{" "}
                <span style={{ color: "#FF6B00", fontWeight: 600 }}>
                  {advertising}
                </span>{" "}
                detections, while Analytics contributes{" "}
                <span style={{ color: "#4C6EF5", fontWeight: 600 }}>
                  {analytics}
                </span>
                .
              </div>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row gap-8 w-full items-start">
            {/* Left Panel: Insights + Tracker Network Graph (42% width) */}
            <div className="w-full lg:w-[42%] flex flex-col gap-6">
              {/* INSIGHTS */}
              <div className="w-full bg-[#121212]/50 border border-white/[0.06] rounded-2xl p-6">
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-[#FF6B00] font-semibold">
                    Insights
                  </div>
                  <div className="text-sm text-white/50 mt-1">
                    Key tracker metrics and risk distribution.
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Metric: Total Trackers */}
                  <div className="bg-[#1A1A1A] border border-white/[0.08] rounded-xl p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#FF6B00]" />
                      <span className="text-[10px] uppercase tracking-wider text-[#8B8B8B]">Total Trackers</span>
                    </div>
                    <span className="text-2xl font-bold text-white">{total}</span>
                  </div>
                  
                  {/* Metric: Advertising */}
                  <div className="bg-[#1A1A1A] border border-white/[0.08] rounded-xl p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#FF4444]" />
                      <span className="text-[10px] uppercase tracking-wider text-[#8B8B8B]">Advertising</span>
                    </div>
                    <span className="text-2xl font-bold text-white">{advertising}</span>
                  </div>
                  
                  {/* Metric: Analytics */}
                  <div className="bg-[#1A1A1A] border border-white/[0.08] rounded-xl p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#4C6EF5]" />
                      <span className="text-[10px] uppercase tracking-wider text-[#8B8B8B]">Analytics</span>
                    </div>
                    <span className="text-2xl font-bold text-white">{analytics}</span>
                  </div>
                  
                  {/* Metric: Social */}
                  <div className="bg-[#1A1A1A] border border-white/[0.08] rounded-xl p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#00C48C]" />
                      <span className="text-[10px] uppercase tracking-wider text-[#8B8B8B]">Social</span>
                    </div>
                    <span className="text-2xl font-bold text-white">{social}</span>
                  </div>
                </div>
              </div>

              {/* TRACKER NETWORK PREVIEW */}
              <div className="w-full bg-[#121212]/50 border border-white/[0.06] rounded-2xl p-6 flex flex-col">
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-[#FF6B00] font-semibold">
                    Tracker Network Preview
                  </div>
                  <div className="text-sm text-white/50 mt-1">
                    Static topology overview of tracker connections.
                  </div>
                </div>

                <div 
                  onClick={() => setIsModalOpen(true)}
                  className="group relative cursor-pointer overflow-hidden rounded-xl bg-black/45 border border-white/[0.05] hover:border-[#FF6B00]/30 transition-all duration-300"
                  style={{ height: "320px" }}
                >
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <StaticPreviewGraph data={data} />
                  </div>

                  {/* Polished CTA Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent flex items-end justify-center pb-6 opacity-90 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 text-xs font-semibold text-white shadow-lg transition-all duration-200">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h6v6"/>
                        <path d="M9 21H3v-6"/>
                        <path d="M21 3l-7 7"/>
                        <path d="M3 21l7-7"/>
                      </svg>
                      <span>🔍 View Full Network</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel: Tab-Switching Interface (58% width) */}
            <div className="w-full lg:w-[58%] flex flex-col bg-[#121212]/50 border border-white/[0.06] rounded-2xl p-6 lg:h-[1000px] overflow-hidden">
              {/* Tabs selector */}
              <div className="flex border-b border-white/[0.08] mb-6 overflow-x-auto scrollbar-none gap-2">
                {[
                  { id: "companies", label: "Top Tracking Companies" },
                  { id: "categories", label: "Tracker Categories" },
                  { id: "risk", label: "Highest Risk Trackers" },
                  { id: "insights", label: "Additional Insights" },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-all duration-200 cursor-pointer ${
                        isActive
                          ? "border-[#FF6B00] text-white bg-white/[0.02]"
                          : "border-transparent text-white/50 hover:text-white hover:bg-white/[0.01]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab content area (independently scrollable) */}
              <div className="flex-1 overflow-y-auto pr-1">
                {activeTab === "companies" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-lg font-bold text-white">Top Tracking Companies</h4>
                        <p className="text-xs text-white/40 mt-0.5">Most active tracker companies by matched domains.</p>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full bg-[#FF6B00]/10 border border-[#FF6B00]/25 text-[#FFB470]">
                        Top 10
                      </span>
                    </div>

                    <div className="space-y-3 mt-4">
                      {topTrackers.map((tracker, index) => {
                        const percentage = Math.max(8, ((tracker.domainCount || 0) / maxDomainCount) * 105);
                        return (
                          <div
                            key={tracker.id}
                            className="bg-[#1A1A1A]/60 hover:bg-[#1A1A1A] border border-white/[0.04] hover:border-white/[0.08] rounded-xl p-4 transition-all duration-200"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="flex items-center justify-center h-6 w-6 shrink-0 rounded-lg bg-white/[0.05] text-xs font-bold text-white/70">
                                  #{index + 1}
                                </span>
                                <span className="text-sm font-semibold text-white truncate">
                                  {tracker.label}
                                </span>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-[10px] text-white/40 block">Domains</span>
                                <span className="text-sm font-bold text-white">{tracker.domainCount || 0}</span>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden mb-3">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(100, percentage)}%`,
                                  backgroundColor: categoryColor(normalizeCategory(tracker.category)),
                                }}
                              />
                            </div>

                            <div className="flex justify-between items-center">
                              <div className="flex gap-2">
                                <span className="text-[10px] font-medium text-white/60 bg-white/[0.05] px-2.5 py-0.5 rounded-full border border-white/[0.08]">
                                  {normalizeCategory(tracker.category)}
                                </span>
                                <span
                                  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                                  style={{
                                    color: riskColor(tracker.risk),
                                    background: `${riskColor(tracker.risk)}15`,
                                    border: `1px solid ${riskColor(tracker.risk)}30`
                                  }}
                                >
                                  {tracker.risk || "low"}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === "categories" && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-lg font-bold text-white">Tracker Categories</h4>
                      <p className="text-xs text-white/40 mt-0.5">Category distribution across all detected tracker companies.</p>
                    </div>

                    <div className="grid gap-6 grid-cols-1 md:grid-cols-[240px_1fr] items-center bg-[#1A1A1A]/40 border border-white/[0.04] rounded-xl p-6">
                      <div
                        ref={donutContainerRef}
                        className="flex h-[220px] min-w-[220px] items-center justify-center overflow-visible mx-auto"
                      >
                        <svg
                          ref={donutRef}
                          className="w-full max-w-[220px] h-[220px] overflow-visible"
                          preserveAspectRatio="xMidYMid meet"
                        />
                      </div>

                      <div className="space-y-2">
                        {categoryBuckets.map((bucket) => (
                          <div
                            key={bucket.category}
                            className="flex items-center justify-between border-b border-white/[0.06] py-2.5 last:border-b-0"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className="inline-flex h-3 w-3 rounded-full shrink-0"
                                style={{
                                  backgroundColor: categoryColor(bucket.category),
                                }}
                              />
                              <span className="text-sm font-medium text-white/80">
                                {bucket.category}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">
                                {bucket.value}
                              </span>
                              <span className="text-[11px] text-white/40">
                                ({total > 0 ? Math.round((bucket.value / total) * 100) : 0}%)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "risk" && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-lg font-bold text-white">Highest Risk Trackers</h4>
                        <p className="text-xs text-white/40 mt-0.5">High-risk trackers require immediate attention.</p>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-[#FF4444]/15 border border-[#FF4444]/40 text-[#FF4444] animate-pulse">
                        {highRiskTrackers.length} Critical
                      </span>
                    </div>

                    <div className="space-y-3">
                      {highRiskTrackers.length === 0 ? (
                        <div className="bg-[#1A1A1A]/30 border border-white/[0.04] rounded-xl p-8 text-center text-[#8B8B8B] text-sm">
                          No high-risk trackers detected in browser data.
                        </div>
                      ) : (
                        highRiskTrackers.map((tracker) => (
                          <div
                            key={tracker.id}
                            className="bg-red-500/[0.03] hover:bg-red-500/[0.06] border border-red-500/15 hover:border-red-500/30 rounded-xl p-4 transition-all duration-200"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="mt-0.5 p-1.5 shrink-0 rounded-lg bg-red-500/10 border border-red-500/20 text-[#FF4444]">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                                    <line x1="12" y1="9" x2="12" y2="13"/>
                                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                                  </svg>
                                </div>
                                <div className="min-w-0">
                                  <h5 className="text-sm font-bold text-white truncate">{tracker.label}</h5>
                                  <div className="flex flex-wrap gap-2 mt-1.5 text-[10px] text-white/50">
                                    <span className="bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.08]">
                                      {normalizeCategory(tracker.category)}
                                    </span>
                                    <span className="bg-red-500/10 text-[#FF4444] px-2 py-0.5 rounded border border-red-500/20 font-medium">
                                      CRITICAL RISK
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-[10px] text-white/40 block uppercase tracking-wider">Domains</span>
                                <span className="text-base font-bold text-white">{tracker.domainCount || 0}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "insights" && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-lg font-bold text-white">Additional Insights</h4>
                      <p className="text-xs text-white/40 mt-0.5">Actionable analysis to interpret the tracker scan profile.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Card: Most Prevalent */}
                      <div className="bg-[#1A1A1A]/60 border border-white/[0.06] rounded-xl p-4 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-semibold text-[#FF6B00] uppercase tracking-wider block mb-1">Most Prevalent</span>
                          <h5 className="text-sm font-bold text-white">{topTrackers[0]?.label || "None"}</h5>
                        </div>
                        <p className="text-xs text-white/50 mt-3">
                          This tracker is active across <span className="text-[#FF6B00] font-bold">{topTrackers[0]?.domainCount || 0}</span> domains, making it the primary target for privacy mitigation.
                        </p>
                      </div>

                      {/* Card: Ad Dominance */}
                      <div className="bg-[#1A1A1A]/60 border border-white/[0.06] rounded-xl p-4 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-semibold text-[#FF6B00] uppercase tracking-wider block mb-1">Advertising Exposure</span>
                          <h5 className="text-sm font-bold text-white">{total > 0 ? Math.round((advertising / total) * 100) : 0}% Ad Trackers</h5>
                        </div>
                        <p className="text-xs text-white/50 mt-3">
                          Advertising trackers constitute <span className="text-[#FF6B00] font-bold">{advertising}</span> of the {total} total trackers detected.
                        </p>
                      </div>

                      {/* Card: High Risk Count */}
                      <div className="bg-[#1A1A1A]/60 border border-white/[0.06] rounded-xl p-4 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-semibold text-[#FF6B00] uppercase tracking-wider block mb-1">High Risk Count</span>
                          <h5 className="text-sm font-bold text-white">{highRiskTrackers.length} Trackers</h5>
                        </div>
                        <p className="text-xs text-white/50 mt-3">
                          There are <span className="text-red-400 font-bold">{highRiskTrackers.length}</span> high-risk tracking networks present.
                        </p>
                      </div>

                      {/* Card: Focus */}
                      <div className="bg-[#1A1A1A]/60 border border-white/[0.06] rounded-xl p-4 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-semibold text-[#FF6B00] uppercase tracking-wider block mb-1">Concentration</span>
                          <h5 className="text-sm font-bold text-white">Centralized Risk</h5>
                        </div>
                        <p className="text-xs text-white/50 mt-3">
                          High-risk trackers are centralized in a few major parent companies.
                        </p>
                      </div>
                    </div>

                    {/* Existing Editorial Tips */}
                    <div className="mt-6 border-t border-white/[0.06] pt-6 space-y-4">
                      <div className="flex gap-3">
                        <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold w-12 pt-0.5">Focus</div>
                        <div className="text-xs text-white/70">
                          High-risk trackers are centralized in a few major companies.
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold w-12 pt-0.5">Trend</div>
                        <div className="text-xs text-white/70">
                          Advertising trackers dominate the current fingerprint profile.
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold w-12 pt-0.5">Tip</div>
                        <div className="text-xs text-white/70">
                          Review the top 3 companies first to maximize privacy impact.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal for Full D3 Network Graph */}
            {isModalOpen && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
                onClick={() => setIsModalOpen(false)}
              >
                <div 
                  className="relative w-full max-w-6xl h-[85vh] bg-[#0A0A0A] border border-[#FF6B00]/30 rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-scale-up"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#121212]/30">
                    <div>
                      <h3 className="text-lg font-bold text-white">Tracker Network Graph</h3>
                      <p className="text-xs text-white/40 mt-0.5">Interactive topology of connection paths.</p>
                    </div>
                    <button 
                      onClick={() => setIsModalOpen(false)}
                      className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>

                  {/* Modal Body: D3 SVG Container */}
                  <div 
                    ref={networkContainerRef}
                    className="flex-1 relative w-full bg-black/40 overflow-hidden"
                  >
                    <svg 
                      ref={advancedSvgRef}
                      className="w-full h-full overflow-hidden cursor-move"
                    />

                    {/* D3 Tooltip */}
                    <div
                      ref={tooltipRef}
                      className="pointer-events-none absolute z-50 hidden px-3 py-2 text-xs text-white shadow-xl"
                      style={{
                        display: "none",
                        background: "rgba(255, 255, 255, 0.04)",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "12px",
                      }}
                    />
                  </div>

                  {/* Modal Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-white/[0.08] bg-[#121212]/30 text-xs text-white/40 gap-3">
                    <div>
                      Drag nodes to reposition • Hover for details • Scroll to zoom
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#FF4444]" /> High Risk</span>
                      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#F0A500]" /> Medium Risk</span>
                      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#00C48C]" /> Low Risk</span>
                      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#4A90D9]" /> Target Domain</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
