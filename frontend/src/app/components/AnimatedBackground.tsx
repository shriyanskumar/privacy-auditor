import { motion } from "motion/react";

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Base black background */}
      <div className="absolute inset-0 bg-[#0A0A0A]" />

      {/* Vertical flowing lines */}
      {[...Array(60)].map((_, i) => (
        <motion.div
          key={`vertical-${i}`}
          className="absolute w-px bg-gradient-to-b from-transparent via-[#FF6B00]/20 to-transparent"
          style={{
            left: `${(i / 60) * 100}%`,
            height: `${150 + Math.random() * 250}px`,
          }}
          animate={{
            y: ["-100%", "100vh"],
            opacity: [0, 0.4, 0],
          }}
          transition={{
            duration: 4 + Math.random() * 6,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "linear",
          }}
        />
      ))}

      {/* Horizontal flowing lines */}
      {[...Array(30)].map((_, i) => (
        <motion.div
          key={`horizontal-${i}`}
          className="absolute h-px bg-gradient-to-r from-transparent via-[#FF6B00]/15 to-transparent"
          style={{
            top: `${(i / 30) * 100}%`,
            width: `${200 + Math.random() * 300}px`,
          }}
          animate={{
            x: ["-100%", "100vw"],
            opacity: [0, 0.3, 0],
          }}
          transition={{
            duration: 5 + Math.random() * 7,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "linear",
          }}
        />
      ))}

      {/* Diagonal scanning lines */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={`diagonal-${i}`}
          className="absolute bg-gradient-to-br from-transparent via-[#FF6B00]/10 to-transparent"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: '2px',
            height: `${100 + Math.random() * 200}px`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
          animate={{
            opacity: [0, 0.5, 0],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: 3 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Subtle particle dots */}
      {[...Array(40)].map((_, i) => (
        <motion.div
          key={`particle-${i}`}
          className="absolute w-1 h-1 rounded-full bg-[#FF6B00]"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0, 0.6, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 3 + Math.random() * 3,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Grid overlay for circuit board effect */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `
          linear-gradient(#FF6B00 1px, transparent 1px),
          linear-gradient(90deg, #FF6B00 1px, transparent 1px)
        `,
        backgroundSize: '80px 80px',
      }} />

      {/* Radial gradient hotspots */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full blur-[150px]"
        style={{ backgroundColor: '#FF6B00' }}
        animate={{
          x: ['20%', '80%', '20%'],
          y: ['20%', '60%', '20%'],
          opacity: [0.05, 0.08, 0.05],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full blur-[120px]"
        style={{ backgroundColor: '#FF8C00' }}
        animate={{
          x: ['70%', '10%', '70%'],
          y: ['70%', '30%', '70%'],
          opacity: [0.04, 0.07, 0.04],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 5,
        }}
      />
    </div>
  );
}
