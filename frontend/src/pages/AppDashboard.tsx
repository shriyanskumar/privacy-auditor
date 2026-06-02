import { useEffect, useState } from "react";
import { TrackerMap } from "../app/components/TrackerMap";
import ExifWalk from "../app/components/ExifWalk";
import PrivacyDebtHeatmap from "../app/components/PrivacyDebtHeatmap";
import { Footer } from "../app/components/Footer";
import { ShadowCopyPanel } from "../app/components/ShadowCopyPanel";

type Finding = {
  id: number;
  file_path: string;
  finding_type: string;
  severity: string;
  snippet: string;
};

type ShadowCopy = {
  id: number;
  file_path: string;
  filename: string;
  file_size: number;
  detected_pattern: string;
  file_extension: string;
  severity: string;
  detected_at: string;
};

export default function AppDashboard() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shadowCopies, setShadowCopies] = useState<ShadowCopy[]>([]);
  const [shadowLoading, setShadowLoading] = useState(false);
  const [shadowError, setShadowError] = useState<string | null>(null);

  const loadShadowCopies = async (id: string) => {
    setShadowLoading(true);
    setShadowError(null);

    try {
      const response = await fetch(`http://localhost:3001/api/shadow-copies/${id}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Unable to fetch shadow copies");
      }

      const data = await response.json();
      setShadowCopies(data.shadowCopies || []);
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

  const handleStartAudit = async () => {
    setScanning(true);
    setError(null);
    setShadowCopies([]);

    try {
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
    } finally {
      setScanning(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col w-full overflow-x-hidden bg-transparent">
      <div className="flex-1 max-w-[1440px] mx-auto px-6 pt-16 md:pt-20">
        {!sessionId && !scanning && !error ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-white mb-4">
                Ready to scan your browser?
              </h2>

              <p className="text-[#8B8B8B] mb-8 max-w-md mx-auto">
                We'll analyze your browser cookies and detect the tracker
                companies monitoring your privacy.
              </p>

              <button
                onClick={handleStartAudit}
                className="px-8 py-4 bg-[#FF6B00] hover:bg-[#FF8C00] text-white rounded-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,107,0,0.6)] font-semibold"
              >
                Start Privacy Audit
              </button>
            </div>
          </div>
        ) : scanning ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full border-4 border-white/10 border-t-[#FF6B00] animate-spin" />

              <div className="text-center">
                <div className="text-lg font-semibold text-white mb-2">
                  Scanning your browser
                </div>

                <div className="text-[#8B8B8B]">
                  This may take a few moments…
                </div>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center max-w-md">
              <div className="mb-4">
                <div className="text-5xl mb-3">⚠️</div>

                <h3 className="text-xl font-semibold text-white mb-2">
                  Scan failed
                </h3>

                <p className="text-[#8B8B8B] mb-4">{error}</p>
              </div>

              <button
                onClick={handleStartAudit}
                className="px-6 py-2 bg-[#FF6B00] hover:bg-[#FF8C00] text-white rounded-lg transition-all duration-300 font-semibold"
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-16">
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

