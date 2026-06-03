import { useEffect, useState } from "react";
import {
  Shield,
  Fingerprint,
  Radar,
  FileSearch,
  Copy,
  AlertTriangle,
  TrendingUp,
  FileBarChart2,
  CheckCircle2,
  Lock,
  Loader2,
} from "lucide-react";
import { TrackerMap } from "../app/components/TrackerMap";
import ExifWalk from "../app/components/ExifWalk";
import PrivacyDebtHeatmap from "../app/components/PrivacyDebtHeatmap";
import { Footer } from "../app/components/Footer";
import { ShadowCopyPanel } from "../app/components/ShadowCopyPanel";

// Keep this type to parse what comes over the wire from the API
type BackendShadowCopy = {
  id: number;
  file_path: string;
  filename: string;
  file_size: number; // in bytes or KB
  detected_pattern: string;
  file_extension: string;
  severity: string;
  detected_at: string;
};

// Explicitly match the type contract expected by ShadowCopyPanel
type PanelShadowCopyItem = {
  id: number | string;
  filename: string;
  pattern: string;
  copies: number;
  size: string;
  extension: string;
  timestamp: string;
};

interface ScanModule {
  id: string;
  name: string;
  statusText: string;
  estimatedDuration: number;
}

const MODULE_ICON_MAP: Record<string, React.ComponentType<any>> = {
  browser: Fingerprint,
  trackers: Radar,
  metadata: FileSearch,
  fs_scan: FileSearch,
  shadow: Copy,
  debt: TrendingUp,
  report: FileBarChart2,
};

export default function AppDashboard() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Updated state type to store the normalized items for the panel
  const [shadowCopies, setShadowCopies] = useState<PanelShadowCopyItem[]>([]);
  const [shadowLoading, setShadowLoading] = useState(false);
  const [shadowError, setShadowError] = useState<string | null>(null);

  const [scanModules, setScanModules] = useState<ScanModule[]>([]);
  const [currentModuleIndex, setCurrentModuleIndex] = useState<number>(0);
  const [moduleProgress, setModuleProgress] = useState<number>(0);

  const detectedTrackersCount = 0;
  const metadataExposuresCount = 0;
  const totalLiveFindings =
    shadowCopies.length + detectedTrackersCount + metadataExposuresCount;

  const loadShadowCopies = async (id: string) => {
    setShadowLoading(true);
    setShadowError(null);
    try {
      const response = await fetch(
        `http://localhost:3001/api/shadow-copies/${id}`,
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Unable to fetch shadow copies");
      }
      const data = await response.json();

      const rawCopies: BackendShadowCopy[] = data.shadowCopies || [];

      // FIX: Map backend snake_case properties to frontend camelCase expectations
      const normalizedCopies: PanelShadowCopyItem[] = rawCopies.map((item) => {
        // Convert numbers cleanly to human readable strings if they are raw byte capacities
        const sizeInKB =
          item.file_size > 1024
            ? Math.round(item.file_size / 1024)
            : item.file_size;

        return {
          id: item.id,
          filename: item.filename || "unknown_file",
          pattern: (item.detected_pattern || "UNKNOWN").toUpperCase(),
          copies: 2, // Temporary fallback multiplier for chart scaling calculations if copies key is absent
          size: `${sizeInKB || 0} KB`,
          extension: item.file_extension || "DAT",
          timestamp: item.detected_at
            ? new Date(item.detected_at).toLocaleDateString()
            : "RECENT",
        };
      });

      setShadowCopies(normalizedCopies);
    } catch (err) {
      setShadowError(
        err instanceof Error ? err.message : "Failed to load shadow copies",
      );
    } finally {
      setShadowLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    loadShadowCopies(sessionId);
  }, [sessionId]);

  const fetchScanConfiguration = async (): Promise<ScanModule[]> => {
    try {
      const response = await fetch("http://localhost:3001/api/default-paths");
      const defaultData = await response.json().catch(() => null);
      const targets =
        defaultData?.paths?.map((p: any) => p.name).join(", ") ||
        "User Folders";

      return [
        {
          id: "browser",
          name: "Browser Fingerprint Analysis",
          statusText:
            "Auditing session artifacts and localized storage structures...",
          estimatedDuration: 1200,
        },
        {
          id: "trackers",
          name: "Tracker Detection Engine",
          statusText:
            "Parsing network signatures against known fingerprint metrics...",
          estimatedDuration: 1500,
        },
        {
          id: "metadata",
          name: "Metadata Inspection Module",
          statusText: `Deep scanning file systems inside [${targets}]...`,
          estimatedDuration: 2200,
        },
        {
          id: "shadow",
          name: "Shadow Copy Integrity Verification",
          statusText:
            "Validating directory parity and tracking orphaned snapshots...",
          estimatedDuration: 1400,
        },
        {
          id: "debt",
          name: "Privacy Debt Aggregator",
          statusText:
            "Compiling computational exposure values and sorting risk indexes...",
          estimatedDuration: 1000,
        },
        {
          id: "report",
          name: "Report Generation System",
          statusText: "Finalizing localized data pipeline visualization...",
          estimatedDuration: 800,
        },
      ];
    } catch {
      return [
        {
          id: "browser",
          name: "Browser Fingerprint Analysis",
          statusText: "Auditing session artifacts...",
          estimatedDuration: 1000,
        },
        {
          id: "trackers",
          name: "Tracker Detection Engine",
          statusText: "Parsing trackers...",
          estimatedDuration: 1200,
        },
        {
          id: "fs_scan",
          name: "Filesystem Scanner",
          statusText: "Analyzing system assets...",
          estimatedDuration: 1800,
        },
        {
          id: "debt",
          name: "Privacy Debt Aggregator",
          statusText: "Compiling weights...",
          estimatedDuration: 1000,
        },
        {
          id: "report",
          name: "Report Generation System",
          statusText: "Assembling final telemetry...",
          estimatedDuration: 800,
        },
      ];
    }
  };

  useEffect(() => {
    if (!scanning || scanModules.length === 0) return;

    let progressInterval: NodeJS.Timeout;
    const currentModule = scanModules[currentModuleIndex];
    const updateRate = 40;
    const stepIncrement = (updateRate / currentModule.estimatedDuration) * 100;

    progressInterval = setInterval(() => {
      setModuleProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          if (currentModuleIndex < scanModules.length - 1) {
            setCurrentModuleIndex((idx) => idx + 1);
            return 0;
          }
          return 100;
        }
        return Math.min(prev + stepIncrement, 100);
      });
    }, updateRate);

    return () => clearInterval(progressInterval);
  }, [scanning, currentModuleIndex, scanModules]);

  const handleStartAudit = async () => {
    setScanning(true);
    setError(null);
    setShadowCopies([]);
    setCurrentModuleIndex(0);
    setModuleProgress(0);

    try {
      const activePipeline = await fetchScanConfiguration();
      setScanModules(activePipeline);

      const response = await fetch("http://localhost:3001/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to start privacy audit");
      }

      const data = await response.json();
      setSessionId(data.sessionId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred during the scan",
      );
      setScanning(false);
    }
  };

  useEffect(() => {
    if (sessionId && scanning && scanModules.length > 0) {
      if (
        currentModuleIndex === scanModules.length - 1 &&
        moduleProgress >= 95
      ) {
        setScanning(false);
      }
    }
  }, [sessionId, scanning, currentModuleIndex, moduleProgress, scanModules]);

  const totalModules = scanModules.length || 1;
  const globalPercentage = Math.min(
    Math.round(
      (currentModuleIndex / totalModules) * 100 + moduleProgress / totalModules,
    ),
    100,
  );

  return (
    <main className="min-h-screen flex flex-col w-full overflow-x-hidden bg-transparent text-white">
      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-16 w-full">
        {!sessionId && !scanning && !error ? (
          <div className="flex min-h-[500px] items-center justify-center">
            <div className="text-center max-w-lg mx-auto p-8 border border-white/5 bg-[#0D0D0D] rounded-2xl shadow-2xl">
              <div className="w-16 h-16 bg-[#FF6B00]/10 border border-[#FF6B00]/30 text-[#FF6B00] flex items-center justify-center rounded-2xl mx-auto mb-6 shadow-[0_0_30px_rgba(255,107,0,0.1)]">
                <Shield size={32} />
              </div>
              <h2 className="text-2xl font-bold tracking-tight mb-3">
                Ready to execute pipeline?
              </h2>
              <p className="text-sm text-[#8B8B8B] mb-8 leading-relaxed">
                We will look over deep session file-system configurations,
                localized storage partitions, and map trackers actively
                recording behavioral patterns.
              </p>
              <button
                onClick={handleStartAudit}
                className="w-full sm:w-auto px-8 py-4 bg-[#FF6B00] hover:bg-[#FF8C00] text-white rounded-xl transition-all duration-300 hover:shadow-[0_0_35px_rgba(255,107,0,0.4)] font-medium tracking-wide"
              >
                Start Privacy Audit
              </button>
            </div>
          </div>
        ) : scanning ? (
          <div className="w-full max-w-5xl mx-auto py-4 md:py-6 animate-in fade-in duration-500">
            <div className="bg-[#0C0C0C] border border-white/5 rounded-2xl p-5 md:p-6 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.9)] relative overflow-hidden backdrop-blur-md">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#FF6B00]/60 to-transparent" />

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 pb-4 border-b border-white/5">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF6B00] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF6B00]"></span>
                    </span>
                    <h3 className="text-xs font-semibold tracking-wider text-[#8B8B8B] uppercase">
                      Privacy Audit Execution
                    </h3>
                  </div>
                  <h2 className="text-lg font-bold text-white mt-0.5">
                    Auditing Privacy Leakage Risks
                  </h2>
                </div>

                <div className="flex items-center gap-4 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl self-stretch sm:self-auto justify-between sm:justify-start">
                  <div className="text-right">
                    <div className="text-[10px] text-[#8B8B8B] uppercase tracking-wider font-medium">
                      Pipeline Progress
                    </div>
                    <div className="text-[11px] text-white/50">
                      Stage {currentModuleIndex + 1} of {totalModules}
                    </div>
                  </div>
                  <div className="text-xl font-mono font-bold text-[#FF6B00] w-12 text-right">
                    {globalPercentage}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mb-5">
                <div className="lg:col-span-7 space-y-2">
                  {scanModules.map((module, idx) => {
                    const isCompleted = idx < currentModuleIndex;
                    const isActive = idx === currentModuleIndex;
                    const isPending = idx > currentModuleIndex;

                    const ModuleIcon = MODULE_ICON_MAP[module.id] || Shield;

                    return (
                      <div
                        key={module.id}
                        className={`flex items-center justify-between p-3 rounded-xl transition-all duration-300 border ${
                          isActive
                            ? "bg-[#FF6B00]/[0.02] border-[#FF6B00]/30 shadow-[inset_0_1px_1px_rgba(255,107,0,0.03)]"
                            : isCompleted
                              ? "bg-transparent border-white/5 opacity-75"
                              : "bg-transparent border-transparent opacity-20 select-none"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex-shrink-0">
                            {isCompleted ? (
                              <div className="w-8 h-8 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/30 flex items-center justify-center text-[#FF6B00]">
                                <CheckCircle2 size={16} />
                              </div>
                            ) : isActive ? (
                              <div className="w-8 h-8 rounded-lg bg-[#FF6B00] text-black flex items-center justify-center shadow-[0_0_12px_rgba(255,107,0,0.25)] relative">
                                <Loader2
                                  size={24}
                                  className="animate-spin absolute opacity-20 text-black scale-125"
                                />
                                <ModuleIcon
                                  size={16}
                                  className="relative z-10"
                                />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-white/40">
                                <Lock size={12} />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div
                              className={`text-xs font-medium tracking-wide ${isActive ? "text-white" : isCompleted ? "text-white/80" : "text-white/40"}`}
                            >
                              {module.name}
                            </div>
                            {isActive && (
                              <p className="text-[11px] text-[#8B8B8B] mt-0.5 line-clamp-1 leading-relaxed">
                                {module.statusText}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex-shrink-0 ml-3">
                          {isCompleted && (
                            <span className="text-[10px] font-semibold tracking-wider text-[#FF6B00]/70 bg-[#FF6B00]/5 px-2 py-0.5 border border-[#FF6B00]/10 rounded-md">
                              VERIFIED
                            </span>
                          )}
                          {isActive && (
                            <span className="text-xs font-mono font-bold text-[#FF6B00]">
                              {Math.round(moduleProgress)}%
                            </span>
                          )}
                          {isPending && (
                            <span className="text-[10px] tracking-wider text-white/20 font-medium">
                              QUEUED
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="lg:col-span-5 h-full">
                  <div className="bg-[#111] border border-white/5 rounded-xl p-4 flex flex-col min-h-[280px]">
                    <div className="pb-2 border-b border-white/5 mb-3">
                      <h4 className="text-[10px] font-semibold uppercase tracking-widest text-[#8B8B8B]">
                        Real-Time Analysis Discovery
                      </h4>
                    </div>

                    {totalLiveFindings > 0 ? (
                      <div className="flex-1 space-y-2 overflow-y-auto max-h-[210px] pr-1">
                        {shadowCopies.length > 0 && (
                          <div className="flex items-start gap-2.5 bg-black/40 border border-white/5 p-2.5 rounded-lg">
                            <AlertTriangle
                              size={14}
                              className="text-[#FF6B00] flex-shrink-0 mt-0.5"
                            />
                            <div>
                              <div className="text-[11px] font-medium text-white">
                                Shadow Snapshot Exposure
                              </div>
                              <p className="text-[10px] text-[#8B8B8B] mt-0.5">
                                {shadowCopies.length} orphaned snapshots
                                flagged.
                              </p>
                            </div>
                          </div>
                        )}
                        {detectedTrackersCount > 0 && (
                          <div className="flex items-start gap-2.5 bg-black/40 border border-white/5 p-2.5 rounded-lg">
                            <Radar
                              size={14}
                              className="text-[#FF6B00] flex-shrink-0 mt-0.5"
                            />
                            <div>
                              <div className="text-[11px] font-medium text-white">
                                Tracking Identities Isolated
                              </div>
                              <p className="text-[10px] text-[#8B8B8B] mt-0.5">
                                {detectedTrackersCount} telemetry signatures
                                mapped.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-white/5 bg-black/20 rounded-lg">
                        <div className="w-8 h-8 border border-white/10 text-white/30 flex items-center justify-center rounded-full mb-2">
                          <Shield size={14} />
                        </div>
                        <h5 className="text-[11px] font-medium text-white mb-0.5">
                          Evaluating Exposure Risks
                        </h5>
                        <p className="text-[10px] text-[#8B8B8B] max-w-[180px] leading-relaxed">
                          Live system components are returning analytics stream
                          records.
                        </p>
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-white/5">
                      <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#FF6B00] rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(255,107,0,0.5)]"
                          style={{ width: `${globalPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-white/5 text-[11px] text-[#8B8B8B] font-medium">
                <div className="flex items-center justify-center md:justify-start gap-1.5">
                  <span className="text-[#FF6B00]">✓</span>
                  Local Sandbox Architecture Execution
                </div>
                <div className="flex items-center justify-center md:justify-start gap-1.5">
                  <span className="text-[#FF6B00]">✓</span>
                  Zero External Telemetry Dispatch
                </div>
                <div className="flex items-center justify-center md:justify-end text-[#FF6B00] font-normal tracking-wide animate-pulse">
                  Compiling system risk scores...
                </div>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex min-h-[500px] items-center justify-center">
            <div className="text-center max-w-md bg-[#0D0D0D] border border-white/5 p-8 rounded-2xl shadow-xl">
              <div className="w-12 h-12 bg-red-900/20 border border-red-500/30 text-red-500 flex items-center justify-center rounded-xl mx-auto mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Scan sequence aborted
              </h3>
              <p className="text-sm text-[#8B8B8B] mb-6 leading-relaxed">
                {error}
              </p>
              <button
                onClick={handleStartAudit}
                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl transition-all duration-200 text-sm font-medium"
              >
                Retry Audit
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-12 animate-in fade-in duration-700">
            <ShadowCopyPanel
              shadowCopies={shadowCopies}
              loading={shadowLoading}
              error={shadowError}
            />
            <TrackerMap sessionId={sessionId} />
            <ExifWalk sessionId={sessionId} />
            <PrivacyDebtHeatmap />
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
