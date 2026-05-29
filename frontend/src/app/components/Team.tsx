import { motion } from "motion/react";

export function Team() {
  const members = [
    {
      name: "Shriyans Kumar",
      role: "Team Lead & Backend",
      initials: "SK",
      color: "#FF6B00",
    },
    {
      name: "Fawaz Zakir",
      role: "Frontend",
      initials: "FZ",
      color: "#FF8C00",
    },
    {
      name: "Niharika Pamnani",
      role: "Integration",
      initials: "NP",
      color: "#FF6B00",
    },
    {
      name: "Saakshi V P",
      role: "Research & Demo",
      initials: "SVP",
      color: "#FF8C00",
    },
  ];

  return (
    <section id="team" className="relative py-32 overflow-hidden bg-transparent">
      <div className="max-w-[1440px] mx-auto px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="text-[#FF6B00] tracking-wider uppercase mb-4" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
            Built By
          </div>
          <h2 className="text-white" style={{ fontFamily: 'Syne, sans-serif', fontSize: '3rem', fontWeight: 700 }}>
            The team behind PrivyScan
          </h2>
        </motion.div>

        <div className="grid grid-cols-4 gap-6 max-w-5xl mx-auto">
          {members.map((member, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              viewport={{ once: true }}
              className="rounded-xl border border-[#FF6B00]/30 bg-white/[0.04] backdrop-blur-xl p-8 hover:border-[#FF6B00]/60 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,107,0,0.2)] group text-center"
            >
              <div
                className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(255,107,0,0.4)]"
                style={{
                  backgroundColor: `${member.color}20`,
                  border: `2px solid ${member.color}40`,
                }}
              >
                <span
                  className="font-bold"
                  style={{
                    fontFamily: 'Syne, sans-serif',
                    fontSize: '1.5rem',
                    color: member.color,
                  }}
                >
                  {member.initials}
                </span>
              </div>
              <h3 className="text-white mb-2" style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.125rem', fontWeight: 600 }}>
                {member.name}
              </h3>
              <p className="text-[#8B8B8B]" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>
                {member.role}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
