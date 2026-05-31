import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Hero } from "../app/components/Hero";
import { PrivacyDebt } from "../app/components/PrivacyDebt";
import { Features } from "../app/components/Features";
import { Demo } from "../app/components/Demo";
import { Team } from "../app/components/Team";
import { Footer } from "../app/components/Footer";

export default function HomePage() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      const navbarHeight = id === "demo" ? 250 : 80;
      const element = document.getElementById(id);
      if (element) {
        const top = element.getBoundingClientRect().top + window.scrollY - navbarHeight;
        window.scrollTo({ top, behavior: "smooth" });
      }
    }
  }, [location.hash]);

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-white">
      <div className="flex-1">
        <Hero />
        <PrivacyDebt />
        <Features />
        <Demo />
        <Team />
      </div>
      <Footer />
    </div>
  );
}
