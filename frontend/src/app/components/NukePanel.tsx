import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Shield,
  Trash2,
  RotateCcw,
  Loader2,
  CheckCircle2,
  Info,
  Layers,
  FileCheck,
} from "lucide-react";

interface FileDetail {
  id: number;
  filePath: string;
  filename: string;
  size: string;
  extension?: string;
  pattern?: string;
  type?: string;
  severity?: string;
  lat?: number;
  lon?: number;
  device?: string;
}

interface PlanCategory {
  name: string;
  action: string;
  count: number;
  files: FileDetail[];
}

interface CleanupPlan {
  currentScore: number;
  projectedScore: number;
  scoreReduction: number;
  affectedFilesCount: number;
  affectedCategoriesCount: number;
  categories: PlanCategory[];
}

interface QuarantinedItem {
  id: number;
  session_id: number;
  original_path: string;
  quarantine_path: string;
  filename: string;
  category: string;
  action_taken: string;
  quarantined_at: string;
  status: string;
  metadata: string;
}

interface NukePanelProps {
  sessionId: string | null;
  onActionComplete: () => void;
}

export function NukePanel({ sessionId, onActionComplete }: NukePanelProps) {
  const [plan, setPlan] = useState<CleanupPlan | null>(null);
  const [quarantineItems, setQuarantineItems] = useState<QuarantinedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null); // For individual restore/delete buttons
  const [nuking, setNuking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(50);
  const [planSearch, setPlanSearch] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteConfirmId, setShowDeleteConfirmId] = useState<number | null>(
    null,
  );

  // Fetch cleanup preview
  const fetchPreview = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:3001/api/nuke/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch cleanup preview plan");
      }
      const data = await response.json();
      setPlan(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load preview plan",
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch quarantine items
  const fetchQuarantine = async () => {
    try {
      const url = sessionId
        ? `http://localhost:3001/api/nuke/quarantine?sessionId=${sessionId}`
        : "http://localhost:3001/api/nuke/quarantine";
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch quarantined items");
      }
      const data = await response.json();
      setQuarantineItems(data);
      setVisibleCount(25);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchPreview();
      fetchQuarantine();
    } else {
      setPlan(null);
      setQuarantineItems([]);
    }
  }, [sessionId]);

  // Execute remediation
  const handleExecuteNuke = async () => {
    if (!sessionId) return;
    setNuking(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:3001/api/nuke/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!response.ok) {
        throw new Error("Failed to execute cleanup plan");
      }
      setShowConfirmModal(false);
      await fetchPreview();
      await fetchQuarantine();
      onActionComplete(); // Notify parent to refresh other dashboard cards
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setNuking(false);
    }
  };

  // Restore quarantined file/metadata
  const handleRestore = async (id: number) => {
    setActionLoading(id);
    try {
      const response = await fetch(
        `http://localhost:3001/api/nuke/restore/${id}`,
        {
          method: "POST",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to restore item");
      }
      await fetchPreview();
      await fetchQuarantine();
      onActionComplete(); // Refresh dashboard
    } catch (err) {
      alert(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreAll = async () => {
    try {
      setActionLoading(-1);

      const response = await fetch(
        "http://localhost:3001/api/nuke/restore-all",
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to restore all items");
      }

      const data = await response.json();

      alert(`Restored ${data.restored} files`);

      await fetchPreview();
      await fetchQuarantine();
      onActionComplete();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Restore all failed");
    } finally {
      setActionLoading(null);
    }
  };

  // Permanently delete quarantined file
  const handlePermanentDelete = async (id: number) => {
    setActionLoading(id);
    try {
      const response = await fetch(
        `http://localhost:3001/api/nuke/delete/${id}`,
        {
          method: "DELETE",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to permanently delete item");
      }
      setShowDeleteConfirmId(null);
      await fetchQuarantine();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setActionLoading(null);
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "duplicate":
        return "Duplicate File";
      case "shadow_copy":
        return "Shadow Copy";
      case "gps_metadata":
        return "GPS Metadata Stripped";
      case "sensitive_file":
        return "Sensitive File";
      default:
        return category;
    }
  };

  if (!sessionId) {
    return (
      <div className="w-full rounded-xl border border-white/[0.04] bg-[#0A0A0B] p-8 text-center text-[#7F7F82] font-mono text-xs">
        <Info className="mx-auto mb-2 text-neutral-600" size={20} />
        NO ACTIVE PRIVACY SESSION IN MEMORY. EXECUTE AUDIT SCAN FIRST.
      </div>
    );
  }

  const filteredQuarantineItems = quarantineItems.filter((item) => {
    const matchesSearch = item.filename
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || item.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="w-full rounded-xl border border-[#FF6B00]/40 bg-[#0A0A0B] p-6 shadow-[0_0_40px_rgba(255,107,0,0.02)] text-white font-sans antialiased">
      {/* Header */}
      <div className="mb-6">
        <div className="text-[#FF6B00] tracking-widest uppercase mb-1 font-mono text-[10px]">
          REMEDIATION INTERFACE &gt; PRIVACY NUKE
        </div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
          Privacy Remediation Engine
        </h1>
        <p className="text-xs text-[#7F7F82] mt-1 leading-relaxed">
          Safely resolve discovered privacy leakage risks. Automatically move
          duplicates, temporary sensitive credentials, and shadow snapshots into
          isolation, or strip geo-coordinates from photos.
        </p>
      </div>

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center font-mono text-xs text-[#7F7F82]">
          <Loader2 className="animate-spin mb-3 text-[#FF6B00]" size={24} />
          CALCULATING PRIVACY SCORE IMPACT AND CLEANUP MATRIX...
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-red-950/20 border border-red-500/30 text-red-400 font-mono text-xs mb-6 flex items-start gap-2.5">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">REMEDIATION INITIALIZATION FAIL</div>
            <p className="mt-1 text-neutral-400">{error}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6 items-stretch">
          {/* Left Side: Score Impact & Preview Plan */}
          <div className="col-span-12 lg:col-span-6 flex flex-col justify-between space-y-4 h-[550px]">
            {" "}
            <div className="space-y-4">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300 pb-2 border-b border-white/[0.04]">
                Remediation Preview
              </h2>

              {plan && plan.affectedFilesCount > 0 ? (
                <>
                  {/* Score Matrix Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-white/[0.04] bg-[#101012] p-3 text-center">
                      <span className="text-[9px] text-[#69696C] font-mono tracking-wider font-bold mb-1 block">
                        CURRENT RISK
                      </span>
                      <span className="text-2xl font-bold font-mono text-neutral-200">
                        {plan.currentScore}
                      </span>
                    </div>

                    <div className="rounded-lg border border-[#FF6B00]/20 bg-[#FF6B00]/[0.02] p-3 text-center shadow-[inset_0_1px_1px_rgba(255,107,0,0.03)]">
                      <span className="text-[9px] text-[#FF6B00]/70 font-mono tracking-wider font-bold mb-1 block">
                        EST. SCORE
                      </span>
                      <span className="text-2xl font-bold font-mono text-[#FF6B00] drop-shadow-[0_0_10px_rgba(255,107,0,0.15)]">
                        {plan.projectedScore}
                      </span>
                    </div>

                    <div className="rounded-lg border border-white/[0.04] bg-[#101012] p-3 text-center">
                      <span className="text-[9px] text-[#69696C] font-mono tracking-wider font-bold mb-1 block">
                        SCORE DEBT CUT
                      </span>
                      <span className="text-2xl font-bold font-mono text-neutral-200">
                        -{plan.scoreReduction}
                      </span>
                    </div>
                  </div>

                  {/* Summary Metric Info */}
                  <div className="flex items-center gap-3 bg-[#111115] border border-white/[0.04] p-3.5 rounded-lg text-xs">
                    <Layers className="text-[#FF6B00] shrink-0" size={16} />
                    <div>
                      A total of{" "}
                      <strong className="text-white">
                        {plan.affectedFilesCount} privacy risks
                      </strong>{" "}
                      across{" "}
                      <strong className="text-white">
                        {plan.affectedCategoriesCount} classes
                      </strong>{" "}
                      will be cleaned.
                    </div>
                  </div>

                  {/* Category Action List */}
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {plan.categories.map((cat, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg border border-white/[0.03] bg-white/[0.01] text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
                          <span className="text-neutral-200 font-bold">
                            {cat.name}
                          </span>
                          <span className="text-[#69696C]">({cat.count})</span>
                        </div>
                        <div className="text-[#FFB470] bg-[#FF6B00]/[0.06] border border-[#FF6B00]/15 px-2.5 py-0.5 rounded text-[10px]">
                          {cat.action}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-white/5 bg-white/[0.01] rounded-lg min-h-[200px]">
                  <FileCheck className="text-emerald-500 mb-2" size={24} />
                  <h3 className="text-xs font-medium text-white mb-1">
                    Zero Risks Remaining
                  </h3>
                  <p className="text-[11px] text-[#8B8B8B] max-w-[280px] leading-relaxed">
                    No duplicate files, shadow copies, GPS image markers, or
                    temporary credentials need action.
                  </p>
                </div>
              )}
            </div>
            {plan && plan.affectedFilesCount > 0 && (
              <button
                onClick={() => setShowConfirmModal(true)}
                className="w-full py-3.5 mt-4 bg-[#FF6B00] hover:bg-[#FF8C00] text-white font-medium rounded-xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,107,0,0.3)] tracking-wider uppercase font-mono text-xs flex items-center justify-center gap-2"
              >
                <Shield size={14} />
                Execute Clean Up Plan (Nuke)
              </button>
            )}
          </div>

          {/* Right Side: Quarantine review section */}
          <div className="col-span-12 lg:col-span-6 flex flex-col h-full">
            {" "}
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300 pb-2 border-b border-white/[0.04] mb-3">
              Quarantine Isolation Registry
            </h2>
            <div className="border border-white/[0.04] bg-[#101012] rounded-lg overflow-hidden flex flex-col h-[520px]">
              {" "}
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04] bg-white/[0.01] font-mono text-[9px] text-[#69696C] uppercase font-bold shrink-0">
                <span>Active Quarantined Items</span>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search filename..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="
      h-7
      w-40
      bg-[#0B0B0D]
      border border-[#FF6B00]/15
      rounded
      px-2
      text-[10px]
      text-neutral-300
      font-mono
      outline-none
      focus:border-[#FF6B00]/50
    "
                  />

                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="
      h-7
      bg-[#0B0B0D]
      border border-[#FF6B00]/15
      rounded
      px-2
      text-[10px]
      text-neutral-300
      font-mono
      outline-none
      cursor-pointer
    "
                  >
                    <option value="all">All Types</option>
                    <option value="duplicate">Duplicate Files</option>
                    <option value="shadow_copy">Shadow Copies</option>
                    <option value="sensitive_file">Sensitive Files</option>
                    <option value="gps_metadata">GPS Metadata</option>
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto pd-scrollbar">
                {" "}
                {quarantineItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 font-mono text-[10px] text-[#69696C]">
                    NO FILES CURRENTLY IN QUARANTINE ISOLATION
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-[10px] font-mono">
                    <thead>
                      <tr className="text-[#69696C] uppercase border-b border-white/[0.04] sticky top-0 bg-[#101012] z-10">
                        <th className="py-2 px-3 font-bold">Filename</th>
                        <th className="py-2 px-3 font-bold">Category</th>
                        <th className="py-2 px-3 font-bold text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                      {filteredQuarantineItems
                        .slice(0, visibleCount)
                        .map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-white/[0.01] transition-colors border-b border-white/[0.01]"
                          >
                            <td className="py-2.5 px-3 max-w-[150px] truncate">
                              <span
                                className="text-neutral-200 font-medium block"
                                title={item.filename}
                              >
                                {item.filename}
                              </span>
                              <span
                                className="text-[8px] text-[#69696C] truncate block"
                                title={item.original_path}
                              >
                                {item.original_path}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-[#7F7F82]">
                              {getCategoryLabel(item.category)}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="inline-flex gap-1.5">
                                <button
                                  disabled={actionLoading !== null}
                                  onClick={() => handleRestore(item.id)}
                                  className="px-2 py-1 rounded bg-[#FF6B00]/10 border border-[#FF6B00]/20 hover:bg-[#FF6B00]/20 text-[#FFB470] transition-colors text-[9px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  {actionLoading === item.id ? (
                                    <Loader2
                                      className="animate-spin"
                                      size={10}
                                    />
                                  ) : (
                                    <RotateCcw size={10} />
                                  )}
                                  Restore
                                </button>
                                <button
                                  disabled={actionLoading !== null}
                                  onClick={() =>
                                    setShowDeleteConfirmId(item.id)
                                  }
                                  className="px-2 py-1 rounded bg-red-950/20 border border-red-500/20 hover:bg-red-950/40 text-red-400 transition-colors text-[9px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <Trash2 size={10} />
                                  Wipe
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
                {visibleCount < quarantineItems.length && (
                  <div className="border-t border-white/[0.04] px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#69696C]">
                        {filteredQuarantineItems.length} Files Isolated
                      </span>

                      <div className="flex items-center gap-2">
                        {visibleCount < filteredQuarantineItems.length && (
                          <button
                            onClick={() => setVisibleCount((v) => v + 50)}
                            className="px-3 py-1 rounded border border-[#FF6B00]/20 bg-[#FF6B00]/10 text-[#FFB470] text-[10px] font-mono hover:bg-[#FF6B00]/20"
                          >
                            LOAD 50 MORE
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="shrink-0 border-t border-white/[0.04] px-3 py-2 flex items-center justify-between bg-[#101012]">
                <span className="text-[10px] font-mono text-[#69696C]">
                  {filteredQuarantineItems.length} Files Isolated
                </span>

                <button
                  onClick={handleRestoreAll}
                  disabled={
                    actionLoading !== null || quarantineItems.length === 0
                  }
                  className="
      px-3 py-1
      rounded
      bg-[#FF6B00]/10
      border border-[#FF6B00]/20
      hover:bg-[#FF6B00]/20
      text-[#FFB470]
      text-[10px]
      font-mono
      flex items-center gap-1
      disabled:opacity-50
    "
                >
                  <RotateCcw size={10} />
                  Restore All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal (Nuke execution) */}
      {showConfirmModal && plan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0E0E10] border border-[#FF6B00]/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#FF6B00]" />

            <div className="flex gap-4 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/30 text-[#FF6B00] flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Confirm Mass Remediation Plan
                </h3>
                <p className="text-xs text-[#8B8B8B] mt-1">
                  You are about to isolate sensitive files and strip geotags.
                  Confirm the actions below.
                </p>
              </div>
            </div>

            <div className="my-4 border border-white/[0.04] bg-[#101012] rounded-lg p-3">
              {" "}
              <div className="text-neutral-400 font-bold uppercase pb-2 border-b border-white/[0.04]">
                AFFECTED FILE REGISTRY ({plan.affectedFilesCount} ITEMS)
              </div>
              <input
                type="text"
                placeholder="Search file name or path..."
                value={planSearch}
                onChange={(e) => setPlanSearch(e.target.value)}
                className="
    w-full
    mt-2
    mb-2
    bg-[#0B0B0D]
    border border-[#FF6B00]/15
    rounded-lg
    px-3
    py-2
    text-[10px]
    text-neutral-300
    font-mono
    outline-none
    focus:border-[#FF6B00]/50
  "
              />
              <div className="max-h-[220px] overflow-y-auto pd-scrollbar pr-1">
                {plan.categories.map((cat, idx) => (
                  <div key={idx} className="mb-3 last:mb-0">
                    <div className="text-[#FFB470] font-bold uppercase mb-1">
                      {cat.name} &rarr; {cat.action}
                    </div>
                    <ul className="space-y-1 pl-2">
                      {cat.files
                        .filter((file) =>
                          file.filePath
                            .toLowerCase()
                            .includes(planSearch.toLowerCase()),
                        )
                        .map((file, fIdx) => (
                          <li
                            key={fIdx}
                            className="text-neutral-300 flex justify-between gap-4"
                          >
                            <span className="truncate" title={file.filePath}>
                              {file.filePath}
                            </span>
                            <span className="text-[#69696C] shrink-0 font-bold">
                              {file.size}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                disabled={nuking}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-white/10 rounded-lg text-xs font-mono font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                Abort
              </button>
              <button
                disabled={nuking}
                onClick={handleExecuteNuke}
                className="px-5 py-2 bg-[#FF6B00] hover:bg-[#FF8C00] text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(255,107,0,0.2)] cursor-pointer"
              >
                {nuking ? (
                  <>
                    <Loader2 className="animate-spin" size={12} />
                    Executing...
                  </>
                ) : (
                  <>
                    <Shield size={12} />
                    Authorize & Execute
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Permanent deletion) */}
      {showDeleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0E0E10] border border-red-500/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-red-500" />

            <div className="flex gap-4 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-950/20 border border-red-500/30 text-red-500 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Permanently Wipe File?
                </h3>
                <p className="text-xs text-red-400 mt-1">
                  WARNING: This action is irreversible. The quarantined file
                  will be permanently deleted from this device.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                disabled={actionLoading !== null}
                onClick={() => setShowDeleteConfirmId(null)}
                className="px-4 py-2 border border-white/10 rounded-lg text-xs font-mono font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading !== null}
                onClick={() => handlePermanentDelete(showDeleteConfirmId)}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] cursor-pointer"
              >
                {actionLoading === showDeleteConfirmId ? (
                  <>
                    <Loader2 className="animate-spin" size={12} />
                    Wiping...
                  </>
                ) : (
                  <>
                    <Trash2 size={12} />
                    Confirm Permanent Wipe
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
