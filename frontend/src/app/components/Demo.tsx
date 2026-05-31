import { motion } from "motion/react";
import { Play, Shield, Zap, Lock } from "lucide-react";

export function Demo() {
  const highlights = [
    { icon: Shield, text: "Privacy-First Architecture" },
    { icon: Zap, text: "Real-Time Scanning" },
    { icon: Lock, text: "100% Local Processing" },
  ];

  return (
    <section
      id="demo"
      className="relative py-32 overflow-hidden bg-transparent"
    >
      <div className="max-w-[1440px] mx-auto px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div
            className="text-[#FF6B00] tracking-wider uppercase mb-4"
            style={{ fontFamily: "monospace", fontSize: "13px" }}
          >
            See It In Action
          </div>
          <h2
            className="text-white"
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: "3rem",
              fontWeight: 700,
            }}
          >
            Watch PrivyScan audit a real device
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="relative max-w-4xl mx-auto mb-12"
        >
          <div className="aspect-video rounded-2xl border border-[#FF6B00]/40 bg-black/60 backdrop-blur-xl flex items-center justify-center group hover:border-[#FF6B00]/60 transition-all duration-300 hover:shadow-[0_0_40px_rgba(255,107,0,0.3)] cursor-pointer overflow-hidden">
            {/* Background grid pattern */}
            <div className="absolute inset-0 opacity-20">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `linear-gradient(#FF6B00 1px, transparent 1px), linear-gradient(90deg, #FF6B00 1px, transparent 1px)`,
                  backgroundSize: "40px 40px",
                  opacity: 0.1,
                }}
              />
            </div>

            <div className="relative z-10 text-center">
              <div className="w-20 h-20 rounded-full bg-[#FF6B00]/20 border-2 border-[#FF6B00] flex items-center justify-center mb-4 mx-auto group-hover:bg-[#FF6B00]/30 transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(255,107,0,0.6)]">
                <Play className="w-8 h-8 text-[#FF6B00] ml-1" fill="#FF6B00" />
              </div>
              <p
                className="text-white"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "1.125rem",
                }}
              >
                Demo video coming soon
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="flex items-center justify-center gap-8"
        >
          {highlights.map((highlight, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/30 flex items-center justify-center">
                <highlight.icon className="w-5 h-5 text-[#FF6B00]" />
              </div>
              <span
                className="text-white"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {highlight.text}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
