import { Shield } from "lucide-react";
import { useState, useEffect } from "react";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [activeLink, setActiveLink] = useState("home");

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setActiveLink(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-black/60 backdrop-blur-xl border-b border-[#FF6B00]/20"
          : "bg-black/20 backdrop-blur-sm"
      }`}
    >
      <div className="max-w-[1440px] mx-auto px-8 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-[#FF6B00]" />
          <span className="text-xl font-bold text-white tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            PrivyScan
          </span>
        </div>

        {/* Nav Links */}
        <div className="flex items-center gap-8">
          {["home", "features", "about", "team"].map((link) => (
            <button
              key={link}
              onClick={() => scrollToSection(link)}
              className={`text-sm font-medium capitalize transition-colors relative pb-1 ${
                activeLink === link ? "text-white" : "text-[#8B8B8B] hover:text-white"
              }`}
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {link}
              {activeLink === link && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B00]" />
              )}
            </button>
          ))}
        </div>

        {/* CTA Button */}
        <button className="px-6 py-2.5 bg-[#FF6B00] hover:bg-[#FF8C00] text-white rounded-lg transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,107,0,0.5)]" style={{ fontFamily: 'Inter, sans-serif' }}>
          Launch App
        </button>
      </div>
    </nav>
  );
}
