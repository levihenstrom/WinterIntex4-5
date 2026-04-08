import { useEffect, useMemo, useRef } from 'react';
import NavBar from '../components/hw/NavBar';
import MetricCard from '../components/hw/MetricCard';
import DonationWidget from '../components/hw/DonationWidget';
import Footer from '../components/hw/Footer';
import CarouselPillarsSection from '../components/hw/CarouselPillarsSection';

// ── Scroll fade-in hook ───────────────────────────────────────────────────────
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) el.classList.add('hw-visible'); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

// ── Image URLs ────────────────────────────────────────────────────────────────
const HERO_IMG = '/girls.avif';
const MISSION_IMG = '/free.avif';

// ─────────────────────────────────────────────────────────────────────────────
// Section 1 — Hero
// ─────────────────────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section id="hero" className="relative flex flex-col" style={{ minHeight: '100svh' }}>
      {/* Full-bleed bg */}
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${HERO_IMG})` }} />
      {/* Single transparent purple overlay — adjust opacity in hw.css :root */}
      <div className="absolute inset-0 hw-hero-overlay" />
      {/* Nav spacer */}
      <div className="h-16 lg:h-[72px] flex-shrink-0" />
      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
        <h1
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight max-w-4xl hw-heading-font hw-text-shadow-heavy"
        >
          Every child deserves
          <br />
          <span>to heal and soar</span>
        </h1>
        <p className="mt-6 text-base md:text-lg text-white/80 max-w-2xl leading-relaxed hw-text-shadow-heavy">
          HealingWings provides safe homes, counseling, and education for children who are survivors of
          trafficking and abuse in the World.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <a href="#donate" className="hw-btn-magenta inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm tracking-wide no-underline shadow-xl">
            Donate Now →
          </a>
          <a href="#mission" className="hw-btn-ghost-white inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-semibold text-sm tracking-wide no-underline shadow-xl">
            Learn Our Story
          </a>
        </div>
      </div>
      {/* Scroll indicator */}
      <div className="relative z-10 flex justify-center pb-10">
        <div className="hw-scroll-bounce flex flex-col items-center gap-1 text-white/50">
          <span className="text-[10px] tracking-widest uppercase">Scroll</span>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 2 — Impact Numbers Bar
// ─────────────────────────────────────────────────────────────────────────────
function ImpactBar() {
  return (
    <section id="impact" className="relative z-20 mx-auto max-w-7xl w-[92%] -mt-20 sm:-mt-24 lg:-mt-28 bg-[#1E3A5F]/75 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-white/20">
      <div className="py-10 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/20 gap-y-10 lg:gap-y-0 text-center">
          <MetricCard target={247} label="children Served" />
          <MetricCard target={4} label="Safe Homes" />
          <MetricCard target={89} suffix="%" label="Reintegration Rate" />
          <MetricCard target={6} label="Years of Impact" />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 3 — Mission Statement
// ─────────────────────────────────────────────────────────────────────────────
function MissionSection() {
  return (
    <section id="mission" className="py-10 overflow-hidden hw-bg-offwhite">
      <div className="w-[95%] max-w-[1600px] mx-auto">
        <div className="hw-fade-in hw-mission-card grid grid-cols-1 lg:grid-cols-2 p-0 group cursor-default" ref={useFadeIn()}>
          {/* Photo */}
          <div className="w-full h-[320px] md:h-[420px] lg:h-auto overflow-hidden">
            <img 
              src={MISSION_IMG} 
              alt="A child in a safe space" 
              className="w-full h-full object-cover transition-transform duration-[1500ms] ease-out group-hover:scale-105" 
            />
          </div>
          {/* Text */}
          <div className="p-8 md:p-12 lg:p-14 flex flex-col justify-center">
            <span className="hw-eyebrow">Our Mission</span>
            <h2 className="hw-heading mt-3 text-3xl md:text-4xl font-extrabold leading-snug">
              We believe every child deserves safety, healing, and a future.
            </h2>
            <div className="mt-6 space-y-4 text-stone-600 leading-relaxed text-base">
              <p>
                HealingWings provides safe homes and professional rehabilitation services for girl survivors of sexual abuse and trafficking, helping them successfully reintegrate into family life and society. With residential shelters serving girls aged 8 to 18, we work alongside local authorities and social welfare agencies to rescue, shelter, and restore.
              </p>
              <p>
                 The children are rescued by the local police department or anti-trafficking agents who refer the children through the Department of Social Welfare and Development (DSWD) to Lighthouse Sanctuary. The social worker in the sanctuary will assist the child in transitioning into their new environment.

              </p>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-3">
              {[
                {
                  icon: (
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path d="M3 12L12 3l9 9" /><path d="M9 21V12h6v9" /><path d="M3 12v9h18v-9" />
                    </svg>
                  ),
                  label: 'Safe Residential Homes',
                },
                {
                  icon: (
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path d="M12 21C12 21 4 14.5 4 9a8 8 0 0 1 16 0c0 5.5-8 12-8 12z" />
                      <path d="M12 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="currentColor" />
                      <path d="M12 11v3" />
                    </svg>
                  ),
                  label: 'Trauma Counseling',
                },
                {
                  icon: (
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                  ),
                  label: 'Education Programs',
                },
                {
                  icon: (
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  ),
                  label: 'Family Reintegration',
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5 text-stone-700 text-sm font-medium">
                  <span className="hw-text-teal flex-shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <a
              href="#pillars"
              className="hw-btn-magenta inline-flex items-center gap-2 px-7 py-3 rounded-full font-bold text-sm mt-8 no-underline"
            >
              How We Help →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 4 — Three Pillars
// ─────────────────────────────────────────────────────────────────────────────
// Legacy static Pillars Section removed — now using CarouselPillarsSection



// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Section 8 — Donation CTA Banner (Legacy/Redesigned to "Broken Grid")
function DonationBanner() {
  const ref = useFadeIn();

  return (
    <section
      id="donate"
      ref={ref}
      className="bg-[#f6f1ff] px-6 py-10 lg:px-16"
    >
      <div className="mx-auto max-w-7xl">

        {/* PURPLE FRAME */}
        <div className="border-[6px] border-[#6B21A8]">

          {/* SPACE BETWEEN BORDER AND PANEL */}
          <div className="p-[15px]">

            {/* MAIN PANEL */}
            <div className="bg-[#efe6ff] shadow-lg">

              <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] min-h-[280px]">

                {/* IMAGE */}
                <div className="relative overflow-hidden">
                  <img
                    src="/girl-portrait.png"
                    alt="HealingWings Resident"
                    className="h-full w-full object-cover object-center"
                  />

                  <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/10 to-transparent" />

                  <div className="absolute bottom-6 left-6 max-w-[240px] text-white">
                    <p className="text-sm leading-5 font-medium">
                      Every contribution helps provide safety and hope.
                    </p>
                  </div>
                </div>

                {/* RIGHT SIDE */}
                <div className="flex items-center px-8 py-6 lg:px-12">
                  <div className="w-full">

                    <div className="mb-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6B21A8]">
                        Make an impact
                      </p>

                      <h2 className="hw-heading-font text-3xl font-extrabold text-stone-900">
                        Your donation changes lives
                      </h2>
                    </div>

                    <div className="bg-white p-5 shadow-md border border-stone-200">
                      <DonationWidget />

                      <div className="mt-4 flex gap-6 border-t pt-4 text-sm">

                        <div className="flex items-center gap-2 text-stone-600">
                          <svg
                            className="w-4 h-4 text-[#0D9488]"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Impact Driven
                        </div>

                        <div className="flex items-center gap-2 text-stone-600">
                          <svg
                            className="w-4 h-4 text-[#6B21A8]"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Secure Giving
                        </div>

                      </div>
                    </div>

                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>

      </div>
    </section>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Section 9 — Partners
// ─────────────────────────────────────────────────────────────────────────────
const ALL_DONORS = [
  // Row 1 - Large, prominent names
  { name: "Maria F. Santos", size: "text-3xl", weight: "font-bold", opacity: 0.95 },
  { name: "Benjamin A. Clark", size: "text-lg", weight: "font-medium", opacity: 0.6 },
  { name: "Liam & Sofia Walker", size: "text-2xl", weight: "font-semibold", opacity: 0.85 },
  { name: "Elena Rossi", size: "text-sm", weight: "font-normal", opacity: 0.45 },
  { name: "Dr. Noah P. Smith", size: "text-xl", weight: "font-medium", opacity: 0.7 },
  { name: "The Johnson Family", size: "text-2xl", weight: "font-bold", opacity: 0.9 },
  { name: "Ava Martinez", size: "text-sm", weight: "font-normal", opacity: 0.4 },
  { name: "Lucas Chen", size: "text-lg", weight: "font-medium", opacity: 0.65 },
  { name: "Isabella Kim", size: "text-3xl", weight: "font-bold", opacity: 1 },
  { name: "Mateo & Clara Silva", size: "text-xl", weight: "font-semibold", opacity: 0.8 },
  { name: "Harper & James Lewis", size: "text-sm", weight: "font-light", opacity: 0.35 },
  { name: "Charlotte M. Lee", size: "text-2xl", weight: "font-medium", opacity: 0.75 },
  { name: "Grace Allen", size: "text-lg", weight: "font-medium", opacity: 0.55 },
  { name: "Amelia R. Taylor", size: "text-3xl", weight: "font-extrabold", opacity: 0.9 },
  { name: "Oliver N. Brown", size: "text-sm", weight: "font-normal", opacity: 0.4 },
  { name: "The Davis Foundation", size: "text-2xl", weight: "font-bold", opacity: 0.85 },
  { name: "Sophia White", size: "text-xl", weight: "font-medium", opacity: 0.7 },
  { name: "Ethan Hall", size: "text-sm", weight: "font-light", opacity: 0.38 },
  { name: "Mia & Jack Thompson", size: "text-2xl", weight: "font-semibold", opacity: 0.82 },
  { name: "Chloe D. Wright", size: "text-lg", weight: "font-medium", opacity: 0.6 },
  { name: "Alexander Scott", size: "text-3xl", weight: "font-bold", opacity: 0.95 },
  { name: "Emma L. Wilson", size: "text-sm", weight: "font-normal", opacity: 0.42 },
  { name: "James R. Anderson", size: "text-xl", weight: "font-medium", opacity: 0.72 },
  { name: "Lily Chen", size: "text-2xl", weight: "font-semibold", opacity: 0.8 },
  { name: "Ryan & Megan Moore", size: "text-sm", weight: "font-light", opacity: 0.36 },
  { name: "Victoria Torres", size: "text-xl", weight: "font-medium", opacity: 0.68 },
  { name: "Andrés Peña", size: "text-3xl", weight: "font-bold", opacity: 0.92 },
  { name: "Natalie Santos", size: "text-sm", weight: "font-normal", opacity: 0.44 },
  { name: "Joshua Bennett", size: "text-2xl", weight: "font-semibold", opacity: 0.78 },
  { name: "Samantha Cox", size: "text-lg", weight: "font-medium", opacity: 0.58 },
];

function DonorWallSection() {
  type DonorParticle = {
    id: number;
    name: string;
    size: string;
    weight: string;
    opacity: number;
    left: string;
    top: string;
    duration: string;
    delay: string;
  };

  const particles: DonorParticle[] = useMemo(() =>
    ALL_DONORS.map((donor, i) => ({
      id: i,
      ...donor,
      left: `${(i * 7 + 3) % 90}%`,
      top: `${(i * 11 + 5) % 82}%`,
      duration: `${20 + (i % 7) * 5}s`,
      delay: `${-(i * 2.3) % 18}s`,
    }))
  , []);

  return (
    <section className="relative overflow-hidden bg-white" style={{ minHeight: '420px' }}>
      {/* Soft off-white gradient for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#FAFAF9] to-white z-0" />
      
      {/* Floating donor names in dark amber (#B45309) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-10">
        {particles.map((p) => (
          <div
            key={p.id}
            className={`absolute hw-animate-float hw-donor-name ${p.size} ${p.weight} text-[#B45309]`}
            style={{
              left: p.left,
              top: p.top,
              opacity: p.opacity,
              '--float-duration': p.duration,
              '--float-delay': p.delay,
              letterSpacing: '0.01em',
            } as React.CSSProperties & { '--float-duration': string; '--float-delay': string }}
          >
            {p.name}
          </div>
        ))}
      </div>

      {/* Centered text overlay with ultra-transparent glass card */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center pointer-events-none" style={{ minHeight: '420px', padding: '80px 24px' }}>
        <div className="bg-white/10 backdrop-blur-md border border-white/30 rounded-3xl p-8 lg:p-12 shadow-[0_8px_32px_rgba(30,58,95,0.06)] max-w-3xl">
          <h2 className="hw-heading-font text-[#1E3A5F] font-extrabold text-4xl lg:text-5xl tracking-tight leading-tight mix-blend-multiply mb-4">
            Thank you to our Donors
          </h2>
          <p className="text-stone-600/90 text-lg lg:text-xl font-medium tracking-wide">
            Each of these names has made a contribution and a lasting impact on the lives of our children.
          </p>
        </div>
      </div>
    </section>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function HealingWingsHome() {
  return (
    <div style={{ fontFamily: 'var(--hw-font-body)' }}>
      <NavBar />
      <HeroSection />
      <ImpactBar />
      <MissionSection />
      <CarouselPillarsSection />
      <DonationBanner />
      <DonorWallSection />
      <Footer />
    </div>
  );
}
