import { useEffect, useState } from "react";
import { ResponsiveContainer, Treemap } from "recharts";

interface TreemapNode {
  name: string;
  value?: number;
  folder?: string;
  riskLevel?: "HIGH" | "MEDIUM" | "LOW";
  children?: TreemapNode[];
}

interface FolderStat {
  name: string;
  rawScore: number;
  debtScore: number;
  screenshots: number;
  emails: number;
  documents: number;
  sensitiveFiles: number;
  gpsCount: number;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
}

interface DashboardData {
  privacyDebt?: number;
  riskLevel?: string;
  foldersScanned?: number;
  highRiskFolders?: number;
  topRiskFolder?: string;
  folderBreakdown?: FolderStat[];
  treemapData?: TreemapNode[];
  folderInsights?: {
    lastScanned?: string;
  };
}

export default function PrivacyDebtHeatmap() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [hoverKey, setHoverKey] = useState("");
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    data: any;
  }>({
    visible: false,
    x: 0,
    y: 0,
    data: null,
  });

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          "http://localhost:3001/api/dashboard/latest",
        );
        if (!response.ok) {
          throw new Error(`Failed to load scan results: ${response.status}`);
        }
        const data = await response.json();
        setDashboard(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load scan results",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const folderBreakdown = dashboard?.folderBreakdown
    ? [...dashboard.folderBreakdown].sort((a, b) => b.debtScore - a.debtScore)
    : [];

  const treemapData = dashboard?.treemapData ?? [];

  useEffect(() => {
    if (!selectedNode && treemapData.length > 0) {
      const firstChild = treemapData[0]?.children?.[0];
      if (firstChild) {
        setSelectedNode(firstChild);
      } else if (treemapData[0]) {
        setSelectedNode(treemapData[0]);
      }
    }
  }, [treemapData, selectedNode]);

  const selectedFolderStats = folderBreakdown.find(
    (folder) => folder.name === (selectedNode?.folder || selectedNode?.name),
  ) ||
    folderBreakdown[0] || {
      name: "-",
      rawScore: 0,
      debtScore: 0,
      screenshots: 0,
      emails: 0,
      documents: 0,
      sensitiveFiles: 0,
      gpsCount: 0,
      riskLevel: "LOW",
    };

  const getRiskColor = (riskLevel: string) =>
    riskLevel === "HIGH"
      ? "#FF4444"
      : riskLevel === "MEDIUM"
        ? "#FF8A00"
        : "#00C48C";

  // Explicit risk mapping for visual tracking inside the Heatmap squares
  const HEATMAP_COLORS = {
    HIGH: "#FF4444",
    MEDIUM: "#FF8A00",
    LOW: "#3B82F6",
    UNKNOWN: "#6B7280",
  };

  const folderInsights = selectedFolderStats
    ? {
        folder: selectedFolderStats.name,
        rawScore: selectedFolderStats.rawScore,
        debtScore: selectedFolderStats.debtScore,
        screenshots: selectedFolderStats.screenshots,
        emails: selectedFolderStats.emails,
        documents: selectedFolderStats.documents,
        sensitiveFiles: selectedFolderStats.sensitiveFiles,
        lastScanned: dashboard?.folderInsights?.lastScanned ?? "-",
        riskLevel: selectedFolderStats.riskLevel,
        summary:
          selectedFolderStats.screenshots > 0 && selectedFolderStats.emails > 0
            ? "Sensitive screenshots and email addresses detected."
            : selectedFolderStats.screenshots > 0 &&
                selectedFolderStats.gpsCount > 0
              ? "Images containing location metadata detected."
              : selectedFolderStats.emails > 10
                ? "Large number of email addresses detected."
                : selectedFolderStats.sensitiveFiles > 10
                  ? "Multiple sensitive files detected."
                  : selectedFolderStats.screenshots > 0
                    ? "Screenshot files containing personal content detected."
                    : selectedFolderStats.gpsCount > 0
                      ? "GPS metadata detected in images."
                      : selectedFolderStats.emails > 0
                        ? "Email addresses found in this folder."
                        : selectedFolderStats.sensitiveFiles > 0
                          ? "Sensitive items found in this folder."
                          : "Potential privacy risk found in this folder.",
        recommendedAction:
          selectedFolderStats.riskLevel === "HIGH"
            ? "Review and purge exposed files"
            : selectedFolderStats.riskLevel === "MEDIUM"
              ? "Review sensitive files"
              : "No immediate action required",
      }
    : {
        folder: "-",
        rawScore: 0,
        debtScore: 0,
        screenshots: 0,
        emails: 0,
        documents: 0,
        sensitiveFiles: 0,
        lastScanned: "-",
        riskLevel: "LOW",
        summary: "-",
        recommendedAction: "-",
      };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1400px",
        margin: "0 auto",
        background: "#0A0A0A",
        border: "1px solid #FF6B00",
        borderRadius: "16px",
        padding: "40px",
        fontFamily: "sans-serif",
      }}
    >
      <h1
        style={{
          color: "#FFF",
          fontSize: "32px",
          fontWeight: "bold",
          marginBottom: "8px",
        }}
      >
        PRIVACY DEBT HEATMAP
      </h1>

      {loading ? (
        <div style={{ color: "#FFF", marginBottom: "24px", fontSize: "16px" }}>
          Loading scan results...
        </div>
      ) : error ? (
        <div
          style={{ color: "#FF7777", marginBottom: "24px", fontSize: "16px" }}
        >
          Error: {error}
        </div>
      ) : (
        <div style={{ color: "#888", marginBottom: "24px" }}>
          Visualize where sensitive information accumulates across your device
        </div>
      )}

      {/* Metric Dashboard Panel */}
      <div
        style={{
          background: "rgba(255,68,68,0.08)",
          border: "1px solid rgba(255,68,68,0.25)",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "24px",
          maxWidth: "280px",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            textTransform: "uppercase",
            color: "#888",
            marginBottom: "8px",
          }}
        >
          Privacy Debt
        </div>
        <div
          style={{
            fontSize: "60px",
            fontWeight: "bold",
            color: "#FF4444",
            lineHeight: 1,
          }}
        >
          {dashboard?.privacyDebt ?? "-"}
        </div>
        <div
          style={{
            marginTop: "8px",
            color: "#FFB470",
            fontSize: "13px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {dashboard?.riskLevel ?? "-"}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        <button
          style={{
            padding: "10px 18px",
            borderRadius: "10px",
            border: "1px solid rgba(255,107,0,0.3)",
            background: "rgba(255,107,0,0.12)",
            color: "#FFB470",
            cursor: "pointer",
          }}
        >
          Heatmap
        </button>
        <button
          style={{
            padding: "10px 18px",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
            color: "#AAA",
            cursor: "pointer",
          }}
        >
          Risk View
        </button>
        <button
          style={{
            padding: "10px 18px",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
            color: "#AAA",
            cursor: "pointer",
          }}
        >
          Findings
        </button>
      </div>

      {/* Treemap Context Layout Frame */}
      <div
        style={{
          height: "750px",
          borderRadius: "16px",
          border: "1px solid rgba(255,107,0,0.12)",
          background: "rgba(255,255,255,0.03)",
          marginBottom: "24px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            color: "#FF6B00",
            fontWeight: 600,
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          TREE VISUALIZATION
        </div>
        <div
          style={{
            position: "absolute",
            top: "45px",
            left: "20px",
            color: "#8B8B8B",
            fontSize: "13px",
          }}
        >
          Home › {selectedNode?.folder || selectedNode?.name || "Overview"}
        </div>

        <div
          style={{
            position: "absolute",
            top: "80px",
            left: "20px",
            right: "20px",
            bottom: "20px",
            background: "#111",
            border: "1px solid rgba(255,107,0,0.15)",
            borderRadius: "12px",
            padding: "12px",
          }}
        >
          {treemapData.length === 0 ? (
            <div
              style={{
                color: "#888",
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              No treemap data available
            </div>
          ) : (
            <div
              style={{ position: "relative", width: "100%", height: "100%" }}
            >
              {/* Floating Color Legend */}
              <div
                style={{ position: "absolute", top: 8, right: 12, zIndex: 10 }}
              >
                <div
                  style={{
                    background: "#1A1A1A",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div
                    style={{
                      color: "#FFF",
                      fontSize: 11,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    LEGEND (RISK)
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{ display: "flex", gap: 6, alignItems: "center" }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          background: "#FF4444",
                          borderRadius: 2,
                        }}
                      />
                      <div style={{ color: "#FFF", fontSize: 11 }}>HIGH</div>
                    </div>
                    <div
                      style={{ display: "flex", gap: 6, alignItems: "center" }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          background: "#FF8A00",
                          borderRadius: 2,
                        }}
                      />
                      <div style={{ color: "#FFF", fontSize: 11 }}>MEDIUM</div>
                    </div>
                    <div
                      style={{ display: "flex", gap: 6, alignItems: "center" }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          background: "#3B82F6",
                          borderRadius: 2,
                        }}
                      />
                      <div style={{ color: "#FFF", fontSize: 11 }}>LOW</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* The Recharts Engine Core Layout */}
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={treemapData} // Flatten out layout context nesting directly
                  dataKey="value"
                  aspectRatio={16 / 9}
                  isAnimationActive={false}
                  content={(props: any) => {
                    if (!props) return null;
                    const {
                      x,
                      y,
                      width,
                      height,
                      index,
                      depth,
                      payload,
                      name,
                      value,
                    } = props;

                    if (width <= 0 || height <= 0) return null;

                    // Direct resolution fallback engine map verification
                    const nodeRisk: keyof typeof HEATMAP_COLORS =
                      payload?.riskLevel || props?.riskLevel || "LOW";
                    const fill =
                      HEATMAP_COLORS[nodeRisk] || HEATMAP_COLORS.UNKNOWN;
                    const itemKey = `${name}-${index}-${value}`;
                    const hovered = hoverKey === itemKey;

                    return (
                      <g
                        transform={`translate(${x}, ${y})`}
                        onMouseEnter={(e) => {
                          setHoverKey(itemKey);
                          setTooltip({
                            visible: true,
                            x: e.clientX,
                            y: e.clientY,
                            data: {
                              name,
                              value,
                              riskLevel: nodeRisk,
                              folder: payload?.folder,
                            },
                          });
                        }}
                        onMouseMove={(e) =>
                          setTooltip((t) => ({
                            ...t,
                            x: e.clientX,
                            y: e.clientY,
                          }))
                        }
                        onMouseLeave={() => {
                          setHoverKey("");
                          setTooltip((t) => ({ ...t, visible: false }));
                        }}
                        onClick={() => {
                          setSelectedNode({
                            name,
                            value,
                            riskLevel: nodeRisk,
                            folder: payload?.folder,
                          });
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <rect
                          width={width}
                          height={height}
                          fill={fill}
                          fillOpacity={hovered ? 0.95 : 0.75}
                          stroke="#111"
                          strokeWidth={hovered ? 2 : 1}
                        />
                        {width > 60 && height > 35 && (
                          <>
                            <text
                              x={8}
                              y={20}
                              fill="#FFFFFF"
                              fontSize={12}
                              fontWeight={700}
                              style={{ pointerEvents: "none" }}
                            >
                              {name}
                            </text>
                            {height > 50 && (
                              <text
                                x={8}
                                y={36}
                                fill="rgba(255,255,255,0.85)"
                                fontSize={11}
                                fontWeight={600}
                                style={{ pointerEvents: "none" }}
                              >
                                {value} items
                              </text>
                            )}
                          </>
                        )}
                      </g>
                    );
                  }}
                />
              </ResponsiveContainer>

              {/* Fixed Tooltip Node Mount portal */}
              {tooltip.visible && tooltip.data && (
                <div
                  style={{
                    position: "fixed",
                    left: tooltip.x + 16,
                    top: tooltip.y + 16,
                    background: "#161616",
                    color: "#FFF",
                    padding: "12px",
                    borderRadius: "8px",
                    pointerEvents: "none",
                    zIndex: 9999,
                    border: "1px solid #FF6B00",
                    boxShadow: "0px 8px 24px rgba(0,0,0,0.7)",
                    fontFamily: "sans-serif",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      marginBottom: "4px",
                      fontSize: "14px",
                    }}
                  >
                    {tooltip.data.name}
                  </div>
                  {tooltip.data.folder && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#A0A0A0",
                        marginBottom: "4px",
                      }}
                    >
                      Folder: {tooltip.data.folder}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 12,
                      color: "#E0E0E0",
                      marginBottom: "6px",
                    }}
                  >
                    Count: <strong>{tooltip.data.value}</strong> files
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: getRiskColor(tooltip.data.riskLevel),
                      textTransform: "uppercase",
                    }}
                  >
                    RISK: {tooltip.data.riskLevel}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grid Panels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "58fr 42fr",
          gap: "24px",
        }}
      >
        {/* Left Stats Panel */}
        <div
          style={{
            minHeight: "180px",
            borderRadius: "12px",
            border: "1px solid rgba(255,107,0,0.12)",
            background: "rgba(255,255,255,0.03)",
            padding: "20px",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 500,
              marginBottom: "16px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(255,107,0,0.8)",
            }}
          >
            Folder Insights
          </div>

          <div style={{ marginTop: "20px" }}>
            <div
              style={{ color: "#FF4444", fontWeight: 600, fontSize: "18px" }}
            >
              {folderInsights.folder}
            </div>
            <div
              style={{
                color: "#8B8B8B",
                fontSize: "13px",
                marginBottom: "12px",
              }}
            >
              Selected Category: {selectedNode?.name ?? "-"}
            </div>
            <div
              style={{
                color: "#8B8B8B",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            >
              Debt Score: {folderInsights.debtScore}
            </div>

            <div
              style={{ color: "#D5D5D5", fontSize: "14px", lineHeight: 1.8 }}
            >
              <div>📸 {folderInsights.screenshots} Screenshots</div>
              <div>📧 {folderInsights.emails} Email Addresses</div>
              <div>📄 {folderInsights.documents} Documents</div>
              <div>🔐 {selectedNode?.value ?? 0} Items Scanned</div>
              <div>⚠️ Risk: {selectedNode?.riskLevel ?? "LOW"}</div>
            </div>

            <div
              style={{
                marginTop: "16px",
                color: "#D5D5D5",
                fontSize: "14px",
                lineHeight: 1.8,
              }}
            >
              <div>
                <span style={{ color: "#8B8B8B" }}>Last Scanned:</span>{" "}
                <span style={{ color: "#FFF" }}>
                  {folderInsights.lastScanned}
                </span>
              </div>
              <div>
                <span style={{ color: "#8B8B8B" }}>Sensitive Files:</span>{" "}
                <span style={{ color: "#FF4444" }}>
                  {folderInsights.sensitiveFiles}
                </span>
              </div>
            </div>

            <div
              style={{
                borderTop: "1px solid rgba(255,107,0,0.12)",
                marginTop: "20px",
                paddingTop: "20px",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  marginBottom: "16px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(255,107,0,0.8)",
                }}
              >
                Threat Summary
              </div>
              <div style={{ color: "#FFF", fontSize: "14px", lineHeight: 1.6 }}>
                {folderInsights.summary}
              </div>
              <div
                style={{
                  marginTop: "16px",
                  color: "#FFB470",
                  fontWeight: 600,
                  fontSize: "13px",
                }}
              >
                Risk Level: {folderInsights.riskLevel}
              </div>
              <div
                style={{
                  marginTop: "12px",
                  color: "#FFB470",
                  fontSize: "13px",
                }}
              >
                Recommended Action:{" "}
                <span style={{ color: "rgba(255,180,112,0.7)" }}>
                  {folderInsights.recommendedAction}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Distribution Sidebar */}
        <div
          style={{
            minHeight: "180px",
            borderRadius: "12px",
            border: "1px solid rgba(255,107,0,0.12)",
            background: "rgba(255,255,255,0.03)",
            padding: "20px",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 500,
              marginBottom: "16px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(255,107,0,0.8)",
            }}
          >
            Risk Sidebar
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                width: "140px",
                height: "140px",
                borderRadius: "50%",
                background:
                  "conic-gradient(#FF4444 0% 35%, #FF8A00 35% 65%, #3B82F6 65% 100%)",
                margin: "20px 0",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "100px",
                  height: "100px",
                  borderRadius: "50%",
                  background: "#111111",
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              marginTop: "10px",
            }}
          >
            <div
              style={{
                width: "100%",
                padding: "12px",
                borderBottom: "1px solid rgba(255,107,0,0.12)",
              }}
            >
              <div style={{ color: "#8B8B8B", fontSize: "12px" }}>
                FOLDERS SCANNED
              </div>
              <div style={{ color: "#FFF", fontSize: "28px", fontWeight: 700 }}>
                {dashboard?.foldersScanned ?? "-"}
              </div>
            </div>
            <div
              style={{
                width: "100%",
                padding: "12px",
                borderBottom: "1px solid rgba(255,107,0,0.12)",
              }}
            >
              <div style={{ color: "#8B8B8B", fontSize: "12px" }}>
                HIGH RISK FOLDERS
              </div>
              <div style={{ color: "#FFF", fontSize: "28px", fontWeight: 700 }}>
                {dashboard?.highRiskFolders ?? "-"}
              </div>
            </div>
            <div
              style={{
                width: "100%",
                padding: "12px",
                borderBottom: "1px solid rgba(255,107,0,0.12)",
              }}
            >
              <div style={{ color: "#8B8B8B", fontSize: "12px" }}>
                TOP RISK FOLDER
              </div>
              <div style={{ color: "#FFF", fontSize: "24px", fontWeight: 700 }}>
                {dashboard?.topRiskFolder ?? "-"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
