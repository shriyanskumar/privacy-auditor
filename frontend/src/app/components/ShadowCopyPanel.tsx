import { useMemo, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

// Component simplified to just render static text as requested, removing scrambling logic entirely
function ScrambledText({
  text,
  className,
}: {
  text: string;
  className?: string;
  triggerKey?: any;
}) {
  return <span className={className}>{text}</span>;
}

// 1. Define the structural shape of your backend file items
export type ShadowCopyItem = {
  id: number | string;
  filename: string;
  pattern: string;
  copies: number;
  size: string; // expected format: "450 KB" or similar
  extension: string;
  timestamp: string;
};

// 2. Define the explicit Props interface for the panel
interface ShadowCopyPanelProps {
  shadowCopies: ShadowCopyItem[];
  loading?: boolean;
  error?: string | null;
}

export function ShadowCopyPanel({
  shadowCopies = [],
  loading = false,
  error = null,
}: ShadowCopyPanelProps) {
  const [selectedExtension, setSelectedExtension] = useState<string | null>(
    null,
  );
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);

  const [isPatternDropdownOpen, setIsPatternDropdownOpen] = useState(false);
  const [isExtDropdownOpen, setIsExtDropdownOpen] = useState(false);

  // Left view sub-toggle (radar vs summary metrics)
  const [activeLeftTab, setActiveLeftTab] = useState<"radar" | "summary">(
    "radar",
  );

  const [hoveredNode, setHoveredNode] = useState<{
    subject: string;
    rawCount: number;
    rawSizeKB: number;
  } | null>(null);

  // 3. Compute top cards metrics dynamically from live dataset
  const summaryMetrics = useMemo(() => {
    let totalKB = 0;
    const distinctPatterns = new Set<string>();

    shadowCopies.forEach((file) => {
      const parsedSize = parseInt(file.size?.replace(/[^\d]/g, ""), 10) || 0;
      totalKB += parsedSize;
      if (file.pattern) distinctPatterns.add(file.pattern.toUpperCase());
    });

    const displaySize =
      totalKB >= 1024
        ? `${(totalKB / 1024).toFixed(2)} MB`
        : `${totalKB.toFixed(1)} KB`;

    return {
      totalSize: shadowCopies.length === 0 ? "0.00 MB" : displaySize,
      detectedPatterns: distinctPatterns.size,
    };
  }, [shadowCopies]);

  // 4. Extract total count breakdown per pattern category dynamically
  const patternBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    shadowCopies.forEach((file) => {
      const label = file.pattern || "UNKNOWN";
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([label, count]) => ({ label, count }));
  }, [shadowCopies]);

  // 5. Extract unique extensions map out of live array data streams
  const dynamicFileTypeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    shadowCopies.forEach((file) => {
      if (file.extension) {
        counts[file.extension] = (counts[file.extension] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([ext, count]) => ({ ext, count }))
      .sort((a, b) => b.count - a.count);
  }, [shadowCopies]);

  // 6. Formulate clean scaling data for the Recharts Radar visualizer
  const radarChartData = useMemo(() => {
    const patternMetrics: Record<
      string,
      { count: number; totalSizeKB: number }
    > = {};

    shadowCopies.forEach((file) => {
      const normPattern = file.pattern?.toLowerCase() || "unknown";
      const parsedSize = parseInt(file.size?.replace(/[^\d]/g, ""), 10) || 0;

      if (!patternMetrics[normPattern]) {
        patternMetrics[normPattern] = { count: 0, totalSizeKB: 0 };
      }
      patternMetrics[normPattern].count += 1;
      patternMetrics[normPattern].totalSizeKB += parsedSize;
    });

    const maxCount = Math.max(
      ...Object.values(patternMetrics).map((p) => p.count),
      1,
    );
    const maxSize = Math.max(
      ...Object.values(patternMetrics).map((p) => p.totalSizeKB),
      1,
    );

    return patternBreakdown.map((p) => {
      const match = patternMetrics[p.label.toLowerCase()] || {
        count: 0,
        totalSizeKB: 0,
      };
      return {
        subject: p.label,
        Count: Math.round((match.count / maxCount) * 100),
        "Size Impact": Math.round((match.totalSizeKB / maxSize) * 100),
        rawCount: match.count,
        rawSizeKB: match.totalSizeKB,
      };
    });
  }, [shadowCopies, patternBreakdown]);

  // 7. Compute calculated metrics for side-panel cards
  const computedMetrics = useMemo(() => {
    let totalSizeKB = 0;
    let maxPatternSizeKB = 0;
    let largestContributor = "N/A";

    const patternCounts: Record<string, number> = {};
    const patternSizes: Record<string, number> = {};

    shadowCopies.forEach((file) => {
      const parsedSize = parseInt(file.size?.replace(/[^\d]/g, ""), 10) || 0;
      totalSizeKB += parsedSize;

      if (file.pattern) {
        patternCounts[file.pattern] = (patternCounts[file.pattern] || 0) + 1;
        patternSizes[file.pattern] =
          (patternSizes[file.pattern] || 0) + parsedSize;
      }
    });

    Object.entries(patternSizes).forEach(([pattern, size]) => {
      if (size > maxPatternSizeKB) {
        maxPatternSizeKB = size;
        largestContributor = pattern;
      }
    });

    let maxCount = 0;
    let mostCommonPattern = "N/A";
    Object.entries(patternCounts).forEach(([pattern, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonPattern = pattern;
      }
    });

    const duplicateSizeKB = patternSizes["DUPLICATE"] || 0;
    const estimatedRecoverableMB = (duplicateSizeKB / 1024).toFixed(2);
    const totalDuplicatePercentage = (
      (duplicateSizeKB / (totalSizeKB || 1)) *
      100
    ).toFixed(1);

    return {
      largestContributor,
      mostCommonPattern,
      estimatedRecoverable: `${estimatedRecoverableMB} MB`,
      duplicatePercentage: `${totalDuplicatePercentage}%`,
    };
  }, [shadowCopies]);

  // 8. Filters execution block
  const processedFiles = useMemo(() => {
    let filtered = [...shadowCopies];
    if (selectedExtension) {
      filtered = filtered.filter(
        (file) => file.extension === selectedExtension,
      );
    }
    if (selectedPattern) {
      filtered = filtered.filter(
        (file) => file.pattern?.toLowerCase() === selectedPattern.toLowerCase(),
      );
    }
    return filtered.sort((a, b) => (b.copies || 0) - (a.copies || 0));
  }, [shadowCopies, selectedExtension, selectedPattern]);

  // Early Loading State Layout
  if (loading) {
    return (
      <div className="w-full rounded-xl border border-white/[0.04] bg-[#0A0A0B] p-6 h-[680px] flex flex-col items-center justify-center text-white font-mono text-xs">
        <div className="w-6 h-6 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin mb-3" />
        AGGREGATING TARGET FILE SYSTEM TELEMETRY...
      </div>
    );
  }

  // Early Error State Layout
  if (error) {
    return (
      <div className="w-full rounded-xl border border-red-500/30 bg-[#0A0A0B] p-6 h-[680px] flex flex-col items-center justify-center text-red-400 font-mono text-xs">
        <span className="text-sm mb-2">
          ⚠ ERROR PIPELINE CONNECTION DROPPED
        </span>
        <span className="text-neutral-400">{error}</span>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-[#FF6B00] bg-[#0A0A0B] p-6 shadow-[0_0_40px_rgba(255,107,0,0.03)] flex flex-col justify-between min-h-[680px] text-white font-sans selection:bg-[#FF6B00]/30 antialiased">
      {/* Module Master Header Block */}
      <div className="mb-5">
        <div className="text-[#FF6B00] tracking-widest uppercase mb-1 font-mono text-[10px] font-normal">
          DETECTION MODULES &gt; SHADOW COPIES
        </div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-100">
          Shadow Copy Detector
        </h1>
        <p className="text-xs text-[#7F7F82] font-inter mt-1 leading-relaxed">
          Identify duplicate and backup files that may contain sensitive
          credentials, personally identifiable information, or stale metrics
          metadata.
        </p>
      </div>

      {/* Dynamic Dual-Column Split Grid Core Structure */}
      <div className="grid grid-cols-12 gap-5 items-stretch flex-1">
        {/* Left Column Stacked Metadata Panel Set */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 max-h-[540px] h-[540px]">
          {/* Top Minimal Numeric Metric Indicator Matrix */}
          <div className="grid grid-cols-3 gap-2.5 shrink-0">
            {[
              { title: "TOTAL COPIES", value: shadowCopies.length },
              { title: "CAPACITY", value: summaryMetrics.totalSize },
              { title: "PATTERNS", value: summaryMetrics.detectedPatterns },
            ].map((card, i) => (
              <div
                key={i}
                className="rounded-lg border border-white/[0.04] bg-[#101012] p-2.5 text-center flex flex-col justify-center min-h-[64px]"
              >
                <span className="text-[9px] text-[#69696C] font-mono tracking-wider font-bold mb-0.5 block">
                  {card.title}
                </span>
                <span className="text-xs font-bold font-mono text-neutral-200 tracking-tight">
                  {card.value}
                </span>
              </div>
            ))}
          </div>

          {/* Structured Radar Panel Registry Bounding Block */}
          <div className="rounded-lg border border-white/[0.04] bg-[#101012] p-4 flex flex-col relative flex-1 min-h-0">
            <div className="flex items-center justify-between z-10 border-b border-white/[0.04] pb-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveLeftTab("radar")}
                  className={`text-[9px] font-mono tracking-wider uppercase px-2 py-1 rounded transition-all cursor-pointer ${
                    activeLeftTab === "radar"
                      ? "bg-[#FF6B00]/20 text-[#FF6B00] border border-[#FF6B00]/30 font-normal"
                      : "text-[#69696C] hover:text-neutral-300 border border-transparent font-bold"
                  }`}
                >
                  Radar Chart
                </button>
                <button
                  onClick={() => setActiveLeftTab("summary")}
                  className={`text-[9px] font-mono tracking-wider uppercase px-2 py-1 rounded transition-all cursor-pointer ${
                    activeLeftTab === "summary"
                      ? "bg-[#FF6B00]/20 text-[#FF6B00] border border-[#FF6B00]/30 font-normal"
                      : "text-[#69696C] hover:text-neutral-300 border border-transparent font-bold"
                  }`}
                >
                  Summary Metrics
                </button>
              </div>
            </div>

            {activeLeftTab === "radar" ? (
              <>
                <div className="absolute top-16 right-4 z-20 pointer-events-none w-[115px]">
                  {!hoveredNode ? (
                    <div className="text-right bg-[#0D0D0F]/90 backdrop-blur-[4px] px-2 py-1 rounded border border-white/[0.04] shadow-md">
                      <div className="text-[8px] font-mono text-[#69696C] uppercase tracking-wider">
                        ● Vol{" "}
                        <span className="text-[#FF3B30] font-bold ml-1">
                          - - Size
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-left bg-[#0E0E10] backdrop-blur-[4px] border border-[#FF6B00]/40 p-1.5 rounded shadow-2xl">
                      <div className="text-[8px] font-normal font-mono text-[#FF6B00] uppercase truncate mb-0.5">
                        {hoveredNode.subject}
                      </div>
                      <div className="text-[8px] font-mono text-neutral-400">
                        Files:{" "}
                        <span className="font-bold text-neutral-200">
                          {hoveredNode.rawCount}
                        </span>
                      </div>
                      <div className="text-[8px] font-mono text-neutral-400">
                        Space:{" "}
                        <span className="font-bold text-neutral-200">
                          {(hoveredNode.rawSizeKB / 1024).toFixed(1)}MB
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="w-full flex-1 relative select-none mt-2 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      cx="50%"
                      cy="50%"
                      outerRadius="70%"
                      data={radarChartData}
                      onMouseMove={(state) => {
                        if (
                          state &&
                          state.activePayload &&
                          state.activePayload[0]
                        ) {
                          const payload = state.activePayload[0].payload;
                          setHoveredNode({
                            subject: payload.subject,
                            rawCount: payload.rawCount,
                            rawSizeKB: payload.rawSizeKB,
                          });
                        }
                      }}
                      onMouseLeave={() => setHoveredNode(null)}
                    >
                      <PolarGrid stroke="rgba(255, 255, 255, 0.12)" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{
                          fill: "#A3A3A6",
                          fontSize: 8.5,
                          fontWeight: 600,
                          fontFamily: "monospace",
                        }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={false}
                        axisLine={false}
                      />
                      <Radar
                        name="Count"
                        dataKey="Count"
                        stroke="#FF6B00"
                        fill="#FF6B00"
                        fillOpacity={0.12}
                        strokeWidth={1.5}
                      />
                      <Radar
                        name="Size Impact"
                        dataKey="Size Impact"
                        stroke="#FF3B30"
                        fill="#FF3B30"
                        fillOpacity={0.12}
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col justify-center gap-3 mt-2 font-mono text-xs select-none">
                {[
                  {
                    label: "Largest storage contributor",
                    value: computedMetrics.largestContributor,
                  },
                  {
                    label: "Most common pattern",
                    value: computedMetrics.mostCommonPattern,
                  },
                  {
                    label: "Estimated recoverable storage",
                    value: computedMetrics.estimatedRecoverable,
                  },
                  {
                    label: "Total duplicate storage percentage",
                    value: computedMetrics.duplicatePercentage,
                  },
                ].map((metric, i) => (
                  <div
                    key={i}
                    className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-md flex flex-col gap-1"
                  >
                    <span className="text-[9px] uppercase tracking-wider text-[#69696C] font-bold">
                      {metric.label}
                    </span>
                    <ScrambledText
                      text={metric.value}
                      triggerKey={activeLeftTab}
                      className="text-sm font-normal text-[#FF6B00] tracking-tight"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: DETAILED SHADOW COPIES layout */}
        <div className="col-span-12 lg:col-span-8 rounded-lg border border-white/[0.04] bg-[#101012] flex flex-col overflow-hidden max-h-[540px] h-[540px]">
          <div className="w-full flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] bg-white/[0.01] font-mono text-[10px]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
              <span className="tracking-wider uppercase font-bold text-neutral-300">
                DETAILED SHADOW COPIES
              </span>
            </div>
            <div className="flex items-center gap-3">
              {(selectedPattern || selectedExtension) && (
                <button
                  onClick={() => {
                    setSelectedPattern(null);
                    setSelectedExtension(null);
                  }}
                  className="text-[9px] text-[#7F7F82] hover:text-[#FF6B00] transition-colors uppercase font-bold tracking-wider mr-1 cursor-pointer"
                >
                  Reset Active Filters [×]
                </button>
              )}
              <div className="text-[#FF6B00] bg-[#FF6B00]/[0.06] border border-[#FF6B00]/20 px-2 py-0.5 rounded text-[9px] uppercase font-normal tracking-wider transition-all">
                {processedFiles.length} / {shadowCopies.length} MATCHES
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden block px-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-neutral-950/[0.2] [&::-webkit-scrollbar-thumb]:bg-neutral-800 [&::-webkit-scrollbar-thumb]:rounded-md hover:[&::-webkit-scrollbar-thumb]:bg-[#FF6B00]/30 [&::-webkit-scrollbar-thumb]:transition-colors">
            <table className="w-full text-left border-collapse text-[11px] font-mono">
              <thead>
                <tr className="text-[9px] tracking-wider text-[#69696C] uppercase sticky top-0 bg-[#101012] border-b border-white/[0.04] z-20">
                  <th className="py-2.5 px-3 font-bold bg-[#101012] text-center w-8">
                    #
                  </th>
                  <th className="py-2.5 px-4 font-bold bg-[#101012]">
                    Filename
                  </th>
                  <th className="py-3 px-4 font-bold bg-[#101012] relative">
                    <div className="flex items-center gap-1.5">
                      <span>Pattern Detected</span>
                      <button
                        onClick={() => {
                          setIsPatternDropdownOpen(!isPatternDropdownOpen);
                          setIsExtDropdownOpen(false);
                        }}
                        className={`p-1 rounded bg-white/[0.02] border transition-all cursor-pointer outline-none hover:bg-white/[0.06] ${
                          selectedPattern
                            ? "border-[#FF6B00] text-[#FF6B00]"
                            : "border-white/[0.05] text-[#858588]"
                        }`}
                      >
                        <svg
                          className="w-2.5 h-2.5 fill-current"
                          viewBox="0 0 20 20"
                        >
                          <path d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.447.894l-3 2A1 1 0 017 17v-5.586L2.293 6.707A1 1 0 012 6V3h" />
                        </svg>
                      </button>
                    </div>

                    {isPatternDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-20 cursor-default"
                          onClick={() => setIsPatternDropdownOpen(false)}
                        />
                        <div className="absolute left-4 top-9 z-30 w-48 rounded-md border border-white/[0.08] bg-[#0E0E10] p-1 shadow-2xl normal-case font-normal text-left">
                          {patternBreakdown.map((item, idx) => {
                            const isCurrentActive =
                              selectedPattern?.toLowerCase() ===
                              item.label.toLowerCase();
                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  setSelectedPattern(
                                    isCurrentActive ? null : item.label,
                                  );
                                  setIsPatternDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between rounded px-2.5 py-1.5 text-[10px] font-mono text-left transition-colors cursor-pointer outline-none ${
                                  isCurrentActive
                                    ? "bg-[#FF6B00]/15 text-[#FF6B00] font-normal"
                                    : "text-[#9E9EAF] hover:bg-white/[0.04] hover:text-white"
                                }`}
                              >
                                <span className="truncate pr-2">
                                  {item.label}
                                </span>
                                <span
                                  className={`text-[9px] px-1 rounded shrink-0 ${
                                    isCurrentActive
                                      ? "bg-[#FF6B00]/20 text-[#FF6B00]"
                                      : "bg-white/[0.03] text-[#69696C]"
                                  }`}
                                >
                                  {item.count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </th>
                  <th className="py-3 px-4 font-bold text-center bg-[#101012]">
                    No. of Copies
                  </th>
                  <th className="py-3 px-4 font-bold bg-[#101012]">
                    File Size
                  </th>
                  <th className="py-3 px-4 font-bold bg-[#101012] relative">
                    <div className="flex items-center gap-1.5">
                      <span>Extension</span>
                      <button
                        onClick={() => {
                          setIsExtDropdownOpen(!isExtDropdownOpen);
                          setIsPatternDropdownOpen(false);
                        }}
                        className={`p-1 rounded bg-white/[0.02] border transition-all cursor-pointer outline-none hover:bg-white/[0.06] ${
                          selectedExtension
                            ? "border-[#FF6B00] text-[#FF6B00]"
                            : "border-white/[0.05] text-[#858588]"
                        }`}
                      >
                        <svg
                          className="w-2.5 h-2.5 fill-current"
                          viewBox="0 0 20 20"
                        >
                          <path d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.447.894l-3 2A1 1 0 017 17v-5.586L2.293 6.707A1 1 0 012 6V3h" />
                        </svg>
                      </button>
                    </div>

                    {isExtDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-20 cursor-default"
                          onClick={() => setIsExtDropdownOpen(false)}
                        />
                        <div className="absolute right-4 top-9 z-30 w-36 rounded-md border border-white/[0.08] bg-[#0E0E10] p-1 shadow-2xl normal-case font-normal text-left">
                          {dynamicFileTypeBreakdown.map((item, idx) => {
                            const isCurrentActive =
                              selectedExtension === item.ext;
                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  setSelectedExtension(
                                    isCurrentActive ? null : item.ext,
                                  );
                                  setIsExtDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between rounded px-2.5 py-1.5 text-[10px] font-mono text-left transition-colors cursor-pointer outline-none ${
                                  isCurrentActive
                                    ? "bg-[#FF6B00]/15 text-[#FF6B00] font-normal"
                                    : "text-[#9E9EAF] hover:bg-white/[0.04] hover:text-white"
                                }`}
                              >
                                <span>{item.ext}</span>
                                <span
                                  className={`text-[9px] px-1 rounded ${
                                    isCurrentActive
                                      ? "bg-[#FF6B00]/20 text-[#FF6B00]"
                                      : "bg-white/[0.03] text-[#69696C]"
                                  }`}
                                >
                                  {item.count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </th>
                  <th className="py-3 px-4 font-bold bg-[#101012]">Found At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.01]">
                {processedFiles.map((file, idx) => (
                  <tr
                    key={file.id}
                    className="hover:bg-[#FF6B00]/[0.015] border-b border-white/[0.01] transition-colors group text-[#9E9EAF]"
                  >
                    <td className="py-2 px-3 text-[#4A4A4D] text-center font-mono font-medium border-r border-white/[0.02]">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-4 text-neutral-200 font-medium group-hover:text-[#FF6B00] transition-colors font-sans text-xs max-w-[180px] truncate">
                      {file.filename}
                    </td>
                    <td className="py-2 px-4">
                      <span className="border border-[#FF6B00]/20 bg-[#FF6B00]/[0.02] text-[#FF6B00] text-[8.5px] px-1.5 py-0.5 rounded font-normal tracking-wide whitespace-nowrap">
                        <ScrambledText
                          key={`scramble-${file.id}-${file.pattern}`}
                          text={file.pattern}
                        />
                      </span>
                    </td>
                    <td className="py-2 px-4 text-center">
                      <span className="bg-neutral-950 border border-white/[0.04] px-1.5 py-0.2 rounded text-neutral-300 font-bold text-[10px]">
                        {file.copies}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-[#7F7F82] whitespace-nowrap">
                      {file.size}
                    </td>
                    <td className="py-2 px-4 text-[#7F7F82]">
                      {file.extension}
                    </td>
                    <td className="py-2 px-4 text-[#7F7F82]/60 text-[10px] whitespace-nowrap">
                      {file.timestamp}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Global Bottom Status Pipeline Banner */}
      <div className="text-[9px] text-[#69696C] font-mono flex items-center justify-between border-t border-white/[0.03] pt-2.5 mt-3">
        <span>
          * Operational records aggregated from native filesystem analytics
          layer.
        </span>
        <span className="text-[#FF6B00]/50 uppercase font-normal tracking-wider">
          Sync Status: Online
        </span>
      </div>
    </div>
  );
}
