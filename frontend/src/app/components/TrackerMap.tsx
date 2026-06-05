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
  }, [data]);

  useEffect(() => {
    if (!data || !advancedSvgRef.current || !networkContainerRef.current)
      return;
    if (data.nodes.length === 0) return;

    const svg = d3.select(advancedSvgRef.current);
    svg.selectAll("*").remove();

    const width = networkContainerRef.current.clientWidth;
    const height = Math.max(networkContainerRef.current.clientHeight, 0);
    const padding = 50;

    if (width <= 0 || height <= 0) return;

    svg.attr("width", width).attr("height", height).style("overflow", "hidden");

    const tooltip = d3.select(tooltipRef.current);
    const links = data.edges;

    const link = svg
      .append("g")
      .attr("stroke", "#4A4A4A")
      .attr("stroke-opacity", 0.75)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1);

    const simulation = d3
      .forceSimulation<TrackerNode>(data.nodes)
      .force(
        "link",
        d3
          .forceLink<TrackerNode, TrackerEdge>(links)
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
    const node = svg
      .append("g")
      .selectAll("circle")
      .data(data.nodes)
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

    const label = svg
      .append("g")
      .selectAll("text")
      .data(data.nodes.filter((node) => node.type === "tracker"))
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
  }, [data]);

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

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            <div
              className="rounded-[16px] bg-white/5 p-6"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                border: "1px solid rgba(255, 107, 0, 0.12)",
                borderRadius: "16px",
                overflow: "visible",
                alignSelf: "stretch",
              }}
            >
              <div className="mb-6">
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: 600,
                    color: "#FFFFFF",
                  }}
                >
                  Insights
                </h3>
                <p
                  style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)" }}
                  className="mt-2 max-w-3xl"
                >
                  Review the top tracker counts, company breakdowns, risk
                  signals, and category distribution for this scan.
                </p>
              </div>

              <div className="mb-10 flex flex-wrap gap-4">
                <div
                  style={{
                    background: "rgba(255, 107, 0, 0.08)",
                    border: "1px solid rgba(255, 107, 0, 0.2)",
                    borderRadius: "12px",
                    padding: "12px 20px",
                  }}
                  className="flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-[#FF6B00]" />
                    <span className="text-xs uppercase tracking-[0.2em] text-[#8B8B8B]">
                      Total Trackers
                    </span>
                  </div>
                  <div className="text-4xl font-bold text-white">{total}</div>
                </div>

                <div
                  style={{
                    background: "rgba(255, 68, 68, 0.08)",
                    border: "1px solid rgba(255, 68, 68, 0.2)",
                    borderRadius: "12px",
                    padding: "12px 20px",
                  }}
                  className="flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-[#FF4444]" />
                    <span className="text-xs uppercase tracking-[0.2em] text-[#8B8B8B]">
                      Advertising
                    </span>
                  </div>
                  <div className="text-4xl font-bold text-white">
                    {advertising}
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(76, 110, 245, 0.08)",
                    border: "1px solid rgba(76, 110, 245, 0.2)",
                    borderRadius: "12px",
                    padding: "12px 20px",
                  }}
                  className="flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-[#4C6EF5]" />
                    <span className="text-xs uppercase tracking-[0.2em] text-[#8B8B8B]">
                      Analytics
                    </span>
                  </div>
                  <div className="text-4xl font-bold text-white">
                    {analytics}
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(0, 196, 140, 0.08)",
                    border: "1px solid rgba(0, 196, 140, 0.2)",
                    borderRadius: "12px",
                    padding: "12px 20px",
                  }}
                  className="flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-[#00C48C]" />
                    <span className="text-xs uppercase tracking-[0.2em] text-[#8B8B8B]">
                      Social
                    </span>
                  </div>
                  <div className="text-4xl font-bold text-white">{social}</div>
                </div>
              </div>
              <div
                className="rounded-[16px] bg-white/5 p-4"
                style={{
                  background: "rgba(255, 255, 255, 0.04)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  border: "1px solid rgba(255, 107, 0, 0.12)",
                  borderRadius: "16px",
                  alignSelf: "stretch",
                }}
              >
                <div
                  className="relative w-full rounded-[16px]"
                  style={{
                    height: "650px",
                    overflow: "visible",
                  }}
                  ref={networkContainerRef}
                >
                  <svg
                    ref={advancedSvgRef}
                    className="w-full h-full overflow-visible"
                  />

                  <div
                    ref={tooltipRef}
                    className="pointer-events-none absolute z-20 hidden px-3 py-2 text-xs text-white shadow-xl"
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

                <div className="mt-6 flex justify-center gap-8">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#FF4444]" />
                    <span className="text-sm text-white">High Risk</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#F0A500]" />
                    <span className="text-sm text-white">Medium Risk</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#00C48C]" />
                    <span className="text-sm text-white">Low Risk</span>
                  </div>
                </div>
              </div>
              <div style={{ height: "20px" }} />
              <div className="space-y-10">
                <div>
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h4
                        style={{
                          fontSize: "18px",
                          fontWeight: 600,
                          color: "#FFFFFF",
                        }}
                      >
                        Top Tracking Companies
                      </h4>
                      <p
                        style={{
                          fontSize: "13px",
                          color: "rgba(255,255,255,0.45)",
                        }}
                        className="mt-1"
                      >
                        Most active tracker companies by matched domains.
                      </p>
                    </div>
                    <span className="rounded-full border border-[#FF6B00]/20 bg-[#FF6B00]/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[#FFB470]">
                      Top 10
                    </span>
                  </div>
                  <div
                    className="space-y-2"
                    style={{
                      overflow: "visible",
                    }}
                  >
                    {topTrackers.map((tracker, index) => (
                      <div
                        key={tracker.id}
                        className="border-b border-white/[0.06] py-3 last:border-b-0"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[10px] text-[#8B8B8B] uppercase tracking-[0.18em] mb-1">
                              #{index + 1}
                            </div>
                            <div
                              className="text-sm font-semibold truncate"
                              style={{
                                color: "#FFFFFF",
                              }}
                            >
                              {tracker.label}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[9px] text-[#8B8B8B]">
                              Domains
                            </div>
                            <div className="text-base font-semibold text-white">
                              {tracker.domainCount || 0}
                            </div>
                          </div>
                        </div>
                        <div
                          className="rounded-full bg-white/10 overflow-hidden my-3"
                          style={{ height: "2px" }}
                        >
                          <div
                            className="rounded-full bg-[#FF6B00]"
                            style={{
                              height: "2px",
                              width: `${Math.max(8, ((tracker.domainCount || 0) / maxDomainCount) * 100)}%`,
                            }}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10px] text-[#8B8B8B]">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                            {normalizeCategory(tracker.category)}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                            {tracker.risk || "low"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-4">
                    <h4
                      style={{
                        fontSize: "18px",
                        fontWeight: 600,
                        color: "#FFFFFF",
                      }}
                    >
                      Tracker Categories
                    </h4>
                    <p
                      style={{
                        fontSize: "13px",
                        color: "rgba(255,255,255,0.45)",
                      }}
                      className="mt-1"
                    >
                      Category distribution across all detected tracker
                      companies.
                    </p>
                  </div>
                  <div className="grid gap-6 lg:grid-cols-[minmax(180px,auto)_1fr] items-center">
                    <div
                      ref={donutContainerRef}
                      className="flex h-[190px] min-w-[180px] items-center justify-center overflow-visible pl-10"
                    >
                      <svg
                        ref={donutRef}
                        className="w-full max-w-[190px] h-[190px] overflow-visible"
                        preserveAspectRatio="xMidYMid meet"
                      />
                    </div>
                    <div className="space-y-3">
                      {categoryBuckets.map((bucket) => (
                        <div
                          key={bucket.category}
                          className="flex items-center justify-between gap-2 border-b border-white/10 py-3 last:border-b-0"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor: categoryColor(bucket.category),
                              }}
                            />
                            <span className="text-sm text-white">
                              {bucket.category}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-white">
                            {bucket.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-8">
                  <div>
                    <div className="mb-4">
                      <h4
                        style={{
                          fontSize: "18px",
                          fontWeight: 600,
                          color: "#FFFFFF",
                        }}
                      >
                        Highest Risk Trackers
                      </h4>
                      <p
                        style={{
                          fontSize: "13px",
                          color: "rgba(255,255,255,0.45)",
                        }}
                        className="mt-1"
                      >
                        High-risk tracker companies with the most exposed
                        domains.
                      </p>
                    </div>
                    <div className="space-y-3">
                      {highRiskTrackers.length === 0 ? (
                        <div className="text-[#8B8B8B]">
                          No high-risk trackers detected.
                        </div>
                      ) : (
                        highRiskTrackers.slice(0, 6).map((tracker) => (
                          <div
                            key={tracker.id}
                            className="grid grid-cols-[1fr_auto] gap-3 border-b border-white/[0.06] py-3 last:border-b-0"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white truncate">
                                {tracker.label}
                              </div>
                              <div className="text-[10px] text-[#8B8B8B] mt-0.5">
                                {normalizeCategory(tracker.category)}
                              </div>
                              <div className="text-[10px] text-[#8B8B8B] mt-0.5">
                                Affected domains: {tracker.domainCount || 0}
                              </div>
                            </div>
                            <div className="flex items-start justify-end">
                              <span
                                style={{
                                  border: "1px solid rgba(255,68,68,0.5)",
                                  color: "#FF4444",
                                  background: "rgba(255,68,68,0.1)",
                                  borderRadius: "6px",
                                  padding: "2px 8px",
                                  fontSize: "11px",
                                }}
                                className="font-semibold uppercase tracking-[0.12em]"
                              >
                                High Risk
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-4">
                      <h4
                        style={{
                          fontSize: "18px",
                          fontWeight: 600,
                          color: "#FFFFFF",
                        }}
                      >
                        Additional Insights
                      </h4>
                      <p
                        style={{
                          fontSize: "13px",
                          color: "rgba(255,255,255,0.45)",
                        }}
                        className="mt-1"
                      >
                        Actionable context to interpret the tracker scan
                        quickly.
                      </p>
                    </div>
                    <div className="space-y-3 text-sm text-[#D5D5D5]">
                      <div className="border-b border-white/10 pb-3">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-[#8B8B8B]">
                          Focus
                        </div>
                        <div className="mt-1">
                          High-risk trackers are centralized in a few major
                          companies.
                        </div>
                      </div>
                      <div className="border-b border-white/10 pb-3">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-[#8B8B8B]">
                          Trend
                        </div>
                        <div className="mt-1">
                          Advertising trackers dominate the current fingerprint
                          profile.
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.22em] text-[#8B8B8B]">
                          Tip
                        </div>
                        <div className="mt-1">
                          Review the top 3 companies first to maximize privacy
                          impact.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
