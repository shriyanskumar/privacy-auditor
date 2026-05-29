import { motion } from "motion/react";
import { Search, Files, Thermometer, MapPin, Trash2 } from "lucide-react";

export function Features() {
  const features = [
    {
      icon: Search,
      title: "Tracker Fingerprint Map",
      description: "Visualizes which companies are silently tracking you",
      color: "#FF6B00",
    },
    {
      icon: Files,
      title: "Shadow Copy Detector",
      description: "Finds forgotten sensitive files you didn't know still existed",
      color: "#FF8C00",
    },
    {
      icon: Thermometer,
      title: "Sensitive Data Heatmap",
      description: "Color-coded folder risk map across your entire device",
      color: "#FF6B00",
    },
    {
      icon: MapPin,
      title: "EXIF Walk",
      description: "Plots your photo location history on a map",
      color: "#FF8C00",
    },
    {
      icon: Trash2,
      title: "The Nuke Button",
      description: "One-click quarantine and cleanup of all high-risk data",
      color: "#FF6B00",
    },
  ];

  return (
    <section id="features" className="relative py-32 overflow-hidden bg-transparent">
      <div className="max-w-[1440px] mx-auto px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="text-[#FF6B00] tracking-wider uppercase mb-4" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
            What We Detect
          </div>
          <h2 className="text-white" style={{ fontFamily: 'Syne, sans-serif', fontSize: '3rem', fontWeight: 700 }}>
            Five ways PrivyScan exposes your Privacy Debt
          </h2>
        </motion.div>

        <div className="grid grid-cols-3 gap-6 max-w-[1100px] mx-auto">
          {features.slice(0, 3).map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              viewport={{ once: true }}
              className="rounded-xl border border-[#FF6B00]/30 bg-white/[0.04] backdrop-blur-xl p-8 hover:border-[#FF6B00]/60 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,107,0,0.2)] group"
            >
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center mb-6 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(255,107,0,0.4)]"
                style={{
                  backgroundColor: `${feature.color}20`,
                  border: `1px solid ${feature.color}40`,
                }}
              >
                <feature.icon className="w-7 h-7" style={{ color: feature.color }} />
              </div>
              <h3 className="text-white mb-3" style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.25rem', fontWeight: 600 }}>
                {feature.title}
              </h3>
              <p className="text-[#8B8B8B]" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6 max-w-[720px] mx-auto mt-6">
          {features.slice(3).map((feature, i) => (
            <motion.div
              key={i + 3}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: (i + 3) * 0.1 }}
              viewport={{ once: true }}
              className="rounded-xl border border-[#FF6B00]/30 bg-white/[0.04] backdrop-blur-xl p-8 hover:border-[#FF6B00]/60 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,107,0,0.2)] group"
            >
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center mb-6 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(255,107,0,0.4)]"
                style={{
                  backgroundColor: `${feature.color}20`,
                  border: `1px solid ${feature.color}40`,
                }}
              >
                <feature.icon className="w-7 h-7" style={{ color: feature.color }} />
              </div>
              <h3 className="text-white mb-3" style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.25rem', fontWeight: 600 }}>
                {feature.title}
              </h3>
              <p className="text-[#8B8B8B]" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
