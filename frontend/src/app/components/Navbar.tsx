import { Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const navItems = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "features", label: "Features" },
  { id: "demo", label: "See How It Works" },
  { id: "team", label: "Team" },
];

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [activeLink, setActiveLink] = useState("home");
  const navTextStyle = {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace",
    letterSpacing: "4px",
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      if (location.pathname !== "/") {
        return;
      }

      const offset = 96;
      let currentSection = "home";
      let smallestDistance = Number.POSITIVE_INFINITY;

      navItems.forEach((item) => {
        const section = document.getElementById(item.id);
        if (!section) {
          return;
        }

        const distance = Math.abs(section.getBoundingClientRect().top - offset);
        if (distance < smallestDistance) {
          smallestDistance = distance;
          currentSection = item.id;
        }
      });

      setActiveLink(currentSection);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === "/") {
      const hash = location.hash.replace("#", "") || "home";
      setActiveLink(hash);
    } else {
      setActiveLink("");
    }
  }, [location]);

  const scrollToSection = (id: string) => {
    setActiveLink(id);
    if (location.pathname !== "/") {
      navigate(`/#${id}`);
      return;
    }

    const navbarHeight = id === "demo" ? 250 : 80;
    const element = document.getElementById(id);
    if (element) {
      const top = element.getBoundingClientRect().top + window.scrollY - navbarHeight;
      window.scrollTo({ top, behavior: "smooth" });
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
          <span
            className="text-xl font-bold text-white tracking-tight"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            PrivyScan
          </span>
        </div>

        {/* Nav Links */}
        <div className="flex items-center gap-8">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="text-[0.82rem] font-medium uppercase transition-colors duration-200 ease-in-out relative pb-2"
              style={{
                ...navTextStyle,
                color: activeLink === item.id ? "#FF6B00" : "#FFFFFF",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={() => navigate("/app")}
          className="px-6 py-2.5 bg-[#FF6B00] hover:bg-[#FF8C00] text-white rounded-lg transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,107,0,0.5)]"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          Launch App
        </button>
      </div>
    </nav>
  );
}
