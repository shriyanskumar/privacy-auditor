import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";

export function Hero() {
  const navigate = useNavigate();
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Content */}
      <div className="relative z-10 max-w-[1440px] mx-auto px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="inline-block px-4 py-2 mb-8 rounded-full border border-[#FF6B00]/30 bg-[#FF6B00]/5"
        >
          <span
            className="text-[#FF6B00] tracking-wider uppercase"
            style={{ fontFamily: "monospace", fontSize: "13px" }}
          >
            Introducing PrivyScan
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-6"
          style={{
            fontFamily: "Syne, sans-serif",
            fontSize: "5rem",
            fontWeight: 800,
            lineHeight: 1.1,
            color: "white",
          }}
        >
          Your Device Is
          <br />
          Hiding Secrets.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-[#8B8B8B] max-w-2xl mx-auto mb-12"
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "1.125rem",
            lineHeight: 1.7,
          }}
        >
          PrivyScan audits your local filesystem, browser data, and image
          metadata — completely offline. Zero cloud. Zero leaks.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex items-center justify-center gap-4 mb-20"
        >
          <button
            onClick={() => navigate("/app")}
            className="px-8 py-4 bg-[#FF6B00] hover:bg-[#FF8C00] text-white rounded-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,107,0,0.6)] flex items-center gap-2"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Get Started
            <ArrowRight className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const element = document.getElementById("demo");
              if (element) {
                element.scrollIntoView({ behavior: "smooth" });
              }
            }}
            className="px-8 py-4 bg-transparent border border-[#FF6B00]/30 hover:border-[#FF6B00] text-white rounded-lg transition-all duration-300"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            See How It Works
          </button>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex items-center justify-center gap-6"
        >
          {[
            { label: "100% Offline", value: "No Internet Required" },
            { label: "Zero Cloud Calls", value: "Completely Local" },
            { label: "Real-Time Risk Scoring", value: "Instant Analysis" },
          ].map((stat, i) => (
            <div
              key={i}
              className="px-8 py-6 rounded-xl border border-[#FF6B00]/30 bg-white/[0.04] backdrop-blur-xl hover:border-[#FF6B00]/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,107,0,0.2)]"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              <div className="text-white font-semibold mb-1">{stat.label}</div>
              <div className="text-[#8B8B8B] text-sm">{stat.value}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
