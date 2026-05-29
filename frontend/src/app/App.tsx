import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { PrivacyDebt } from "./components/PrivacyDebt";
import { Features } from "./components/Features";
import { Demo } from "./components/Demo";
import { Team } from "./components/Team";
import { Footer } from "./components/Footer";
import { AnimatedBackground } from "./components/AnimatedBackground";

export default function App() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden relative">
      {/* Continuous animated background across entire page */}
      <AnimatedBackground />

      {/* All content sits on top of the animated background */}
      <div className="relative z-10">
        <Navbar />
        <Hero />
        <PrivacyDebt />
        <Features />
        <Demo />
        <Team />
        <Footer />
      </div>
    </div>
  );
}