import { motion } from "motion/react";

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-visible pointer-events-none">
      {/* Base deep black layer */}
      <div className="absolute inset-0 bg-[#050505]" />

      {/* Stronger grid overlay for visible structure */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,107,0,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,107,0,0.08) 1px, transparent 1px)
          `,
          backgroundSize: "90px 90px",
          opacity: 0.45,
        }}
      />

      {/* Vertical flowing lines */}
      {[...Array(45)].map((_, i) => (
        <motion.div
          key={`vertical-${i}`}
          className="absolute w-[1px] bg-gradient-to-b from-transparent via-[#FF6B00]/40 to-transparent"
          style={{
            left: `${(i / 45) * 100}%`,
            top: `${-60 + Math.random() * 20}px`,
            height: `${180 + Math.random() * 280}px`,
          }}
          animate={{
            y: ["-25%", "105%"],
            opacity: [0, 0.55, 0],
          }}
          transition={{
            duration: 6 + Math.random() * 5,
            repeat: Infinity,
            delay: Math.random() * 4,
            ease: "linear",
          }}
        />
      ))}

      {/* Horizontal flowing lines */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={`horizontal-${i}`}
          className="absolute h-[1px] bg-gradient-to-r from-transparent via-[#FF6B00]/30 to-transparent"
          style={{
            top: `${(i / 20) * 100}%`,
            left: `${-100 + Math.random() * 50}px`,
            width: `${220 + Math.random() * 260}px`,
          }}
          animate={{
            x: ["-30%", "110%"],
            opacity: [0, 0.45, 0],
          }}
          transition={{
            duration: 7 + Math.random() * 6,
            repeat: Infinity,
            delay: Math.random() * 6,
            ease: "linear",
          }}
        />
      ))}

      {/* Diagonal scanning beams */}
      {[...Array(16)].map((_, i) => (
        <motion.div
          key={`diagonal-${i}`}
          className="absolute bg-gradient-to-br from-transparent via-[#FF6B00]/20 to-transparent"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: "2px",
            height: `${120 + Math.random() * 240}px`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
          animate={{
            opacity: [0, 0.6, 0],
            scale: [0.9, 1.1, 0.9],
          }}
          transition={{
            duration: 4 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 4,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Particle highlights */}
      {[...Array(55)].map((_, i) => (
        <motion.div
          key={`particle-${i}`}
          className="absolute rounded-full bg-[#FF8C00]"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${1 + Math.random() * 2}px`,
            height: `${1 + Math.random() * 2}px`,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0, 0.65, 0],
            scale: [0.6, 1, 0.6],
          }}
          transition={{
            duration: 3 + Math.random() * 3,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Radial glow hotspots */}
      <motion.div
        className="absolute w-[650px] h-[650px] rounded-full blur-[180px]"
        style={{ backgroundColor: "#FF6B00" }}
        animate={{
          x: ["10%", "80%", "10%"],
          y: ["15%", "60%", "15%"],
          opacity: [0.05, 0.12, 0.05],
        }}
        transition={{
          duration: 23,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute w-[520px] h-[520px] rounded-full blur-[140px]"
        style={{ backgroundColor: "#FF8C00" }}
        animate={{
          x: ["70%", "5%", "70%"],
          y: ["70%", "25%", "70%"],
          opacity: [0.06, 0.11, 0.06],
        }}
        transition={{
          duration: 26,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 5,
        }}
      />
    </div>
  );
}
