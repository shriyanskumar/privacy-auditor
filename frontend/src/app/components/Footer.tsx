import { Shield } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative border-t border-[#FF6B00]/20 bg-black/40 backdrop-blur-xl">
      <div className="max-w-[1440px] mx-auto px-8 py-12">
        <div className="grid grid-cols-3 gap-12 mb-8">
          {/* Left - Logo & Tagline */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-[#FF6B00]" />
              <span className="text-xl font-bold text-white tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
                PrivyScan
              </span>
            </div>
            <p className="text-[#8B8B8B]" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem' }}>
              Your device. Your data. Your audit.
            </p>
          </div>

          {/* Center - Nav Links */}
          <div className="flex items-center justify-center gap-8">
            {["Home", "Features", "About", "Team"].map((link) => (
              <button
                key={link}
                onClick={() => {
                  const element = document.getElementById(link.toLowerCase());
                  if (element) {
                    element.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="text-[#8B8B8B] hover:text-white transition-colors"
                style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem' }}
              >
                {link}
              </button>
            ))}
          </div>

          {/* Right - Built for */}
          <div className="flex items-center justify-end">
            <p className="text-[#8B8B8B] text-right" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem' }}>
              Built for <span className="text-white">Hack4SOC 2026</span>
              <br />
              RV Institutions
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-[#8B8B8B]/10 text-center">
          <p className="text-[#8B8B8B]" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>
            <span className="text-[#FF6B00] font-semibold">100% Offline.</span> No data ever leaves your machine.
          </p>
        </div>
      </div>
    </footer>
  );
}
