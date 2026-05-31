import { motion } from "motion/react";
import { Check, X } from "lucide-react";

export function PrivacyDebt() {
  const existingTools = [
    { feature: "Local File Auditing", has: true },
    { feature: "Tracker Fingerprint Mapping", has: true },
    { feature: "Image EXIF & GPS Analysis", has: true },
    { feature: "Shadow Copy Detection", has: false },
    { feature: "Sensitive Data Heatmap", has: false },
    { feature: "One-Click Cleanup & Quarantine", has: false },
  ];

  const privyScan = [
    { feature: "Local File Auditing", has: true },
    { feature: "Tracker Fingerprint Mapping", has: true },
    { feature: "Image EXIF & GPS Analysis", has: true },
    { feature: "Shadow Copy Detection", has: true },
    { feature: "Sensitive Data Heatmap", has: true },
    { feature: "One-Click Cleanup & Quarantine", has: true },
  ];

  return (
    <section
      id="about"
      className="relative py-12 overflow-hidden bg-transparent"
      style={{ scrollMarginTop: "96px" }}
    >
      <div className="max-w-[1440px] mx-auto px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <div
            className="text-[#FF6B00] tracking-wider uppercase mb-3"
            style={{ fontFamily: "monospace", fontSize: "13px" }}
          >
            The Problem
          </div>
          <h2
            className="text-white mb-4"
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: "2rem",
              fontWeight: 700,
            }}
          >
            You're carrying Privacy Debt right now.
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <p
              className="text-[#8B8B8B] leading-relaxed"
              style={{ fontFamily: "Inter, sans-serif", fontSize: "1rem" }}
            >
              Every forgotten <span className="text-white font-mono">.env</span>{" "}
              file, cached tracker cookie, GPS-tagged photo, and backup
              credential sitting on your device is{" "}
              <span className="text-[#FF6B00]">Privacy Debt</span>.
            </p>
            <p
              className="text-[#8B8B8B] leading-relaxed mt-3"
              style={{ fontFamily: "Inter, sans-serif", fontSize: "0.98rem" }}
            >
              Most tools protect you from the internet.{" "}
              <span className="text-white">
                Nobody audits what the internet already left behind.
              </span>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="relative rounded-xl border border-[#FF6B00]/30 bg-white/[0.04] backdrop-blur-xl p-6"
          >
            <div className="space-y-4">
              {[
                { path: "/Documents", risk: "high", color: "#FF4444" },
                { path: "/Downloads", risk: "high", color: "#FF4444" },
                { path: "/Pictures", risk: "medium", color: "#FFA500" },
                { path: "/Desktop", risk: "medium", color: "#FFA500" },
                { path: "/Applications", risk: "low", color: "#4CAF50" },
              ].map((folder, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="flex items-center justify-between p-2 rounded-lg bg-black/40"
                >
                  <span className="text-white font-mono text-sm">
                    {folder.path}
                  </span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full animate-pulse"
                      style={{
                        backgroundColor: folder.color,
                        boxShadow: `0 0 10px ${folder.color}`,
                      }}
                    />
                    <span
                      className="text-xs uppercase tracking-wider"
                      style={{ color: folder.color }}
                    >
                      {folder.risk}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Comparison Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 gap-4"
        >
          <div className="rounded-xl border border-[#8B8B8B]/20 bg-white/[0.02] backdrop-blur-xl p-8">
            <h3
              className="text-white mb-6"
              style={{
                fontFamily: "Syne, sans-serif",
                fontSize: "1.5rem",
                fontWeight: 600,
              }}
            >
              Existing Tools
            </h3>
            <div className="space-y-3">
              {existingTools.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  {item.has ? (
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <X className="w-5 h-5 text-red-500 flex-shrink-0" />
                  )}
                  <span
                    className={`${item.has ? "text-white" : "text-[#8B8B8B]"}`}
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    {item.feature}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#FF6B00]/30 bg-white/[0.04] backdrop-blur-xl p-6 hover:border-[#FF6B00]/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,107,0,0.2)]">
            <h3
              className="text-white mb-6 flex items-center gap-2"
              style={{
                fontFamily: "Syne, sans-serif",
                fontSize: "1.5rem",
                fontWeight: 600,
              }}
            >
              PrivyScan
              <span
                className="text-[#FF6B00] text-sm"
                style={{ fontFamily: "monospace" }}
              >
                NEW
              </span>
            </h3>
            <div className="space-y-3">
              {privyScan.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  {item.has ? (
                    <Check className="w-5 h-5 text-[#FF6B00] flex-shrink-0" />
                  ) : (
                    <X className="w-5 h-5 text-[#8B8B8B]/30 flex-shrink-0" />
                  )}
                  <span
                    className={`${item.has ? "text-white" : "text-[#8B8B8B]/50"}`}
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    {item.feature}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
