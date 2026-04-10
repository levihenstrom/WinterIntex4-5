import { useEffect, useMemo, useRef, useState } from 'react';
import NavBar from '../components/hw/NavBar';
import MetricCard from '../components/hw/MetricCard';
import DonationWidget from '../components/hw/DonationWidget';
import Footer from '../components/hw/Footer';
import CarouselPillarsSection from '../components/hw/CarouselPillarsSection';
import { fetchJson } from '../lib/apiClient';

// ── Scroll fade-in hook ───────────────────────────────────────────────────────
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === 'undefined' || typeof window.IntersectionObserver === 'undefined') {
      el.classList.add('hw-visible');
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) el.classList.add('hw-visible'); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

const HERO_IMG = '/girls.avif';
const MISSION_IMG = '/free.avif';

interface PublicLiveStats {
  totalResidents: number;
  successfulReintegrations: number;
  safehousesActive: number;
  donationsRaisedTotal: number;
  volunteerHoursTotal: number;
  reintegrationRatePct: number;
  oldestAdmissionYear?: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1 — Hero  (snap chapter 1)
// Glass metrics box lives at the bottom of this section.
// ─────────────────────────────────────────────────────────────────────────────
function HeroSection({
  residentsServed,
  safehousesActive,
  reintegrationRatePct,
  yearsOfImpact,
}: {
  residentsServed: number;
  safehousesActive: number;
  reintegrationRatePct: number;
  yearsOfImpact: number;
}) {
  return (
    <section
      id="hero"
      className="hw-snap-section relative flex flex-col"
    >
      {/* Full-bleed bg */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${HERO_IMG})` }}
      />
      <div className="absolute inset-0 hw-hero-overlay" />

      {/* Hero text — upper portion */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 pb-8">
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold text-white leading-tight max-w-4xl hw-heading-font hw-text-shadow-heavy">
          Every child deserves
          <br />
          <em>to heal and soar</em>
        </h1>
        <p className="mt-5 text-base md:text-lg text-white/75 max-w-xl leading-relaxed hw-text-shadow-heavy font-light tracking-wide">
          HealingWings provides safe homes, counseling, and education for children who are survivors of
          trafficking and abuse in the World.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#donate"
            className="hw-btn-magenta inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-semibold text-sm tracking-wide no-underline shadow-xl"
          >
            Donate Now →
          </a>
          <a
            href="#mission"
            className="hw-btn-ghost-white inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-medium text-sm tracking-wide no-underline"
          >
            Learn Our Story
          </a>
        </div>
      </div>

      {/* Glass metrics bar — pinned to bottom of hero */}
      <div className="relative z-10 w-full px-4 pb-8">
        <div className="mx-auto max-w-4xl bg-[#1E3A5F]/70 backdrop-blur-xl rounded-2xl shadow-2xl">
          <div className="py-7 px-4 sm:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/20 gap-y-6 lg:gap-y-0 text-center">
              <MetricCard target={residentsServed} suffix="+" label="Children Served" />
              <MetricCard target={safehousesActive} label="Safe Homes" />
              <MetricCard target={reintegrationRatePct} suffix="%" label="Reintegration Rate" />
              <MetricCard target={yearsOfImpact} label="Years of Impact" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 2 — Mission / About  (snap chapter 2)
// ─────────────────────────────────────────────────────────────────────────────
function MissionSection() {
  const fadeRef = useFadeIn();

  return (
    <section
      id="mission"
      className="hw-snap-section relative hw-bg-offwhite flex items-center overflow-hidden"
    >
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-10">
        <div
          className="hw-fade-in hw-mission-card grid grid-cols-1 lg:grid-cols-2 w-full group cursor-default rounded-2xl overflow-hidden shadow-xl"
          ref={fadeRef}
        >
          {/* Photo */}
          <div className="w-full h-[260px] md:h-[360px] lg:h-full overflow-hidden">
            <img
              src={MISSION_IMG}
              alt="A child in a safe space"
              className="w-full h-full object-cover transition-transform duration-[1500ms] ease-out group-hover:scale-105"
            />
          </div>

          {/* Text */}
          <div className="p-7 md:p-10 lg:p-12 flex flex-col justify-center bg-white">
            <span className="hw-eyebrow">Our Mission</span>
            <h2 className="hw-heading mt-3 text-2xl md:text-3xl lg:text-4xl font-semibold leading-snug hw-heading-font">
              We believe every child deserves safety, healing, and a future.
            </h2>
            <div className="mt-4 space-y-3 text-stone-500 leading-relaxed text-[14px] font-light">
              <p>
                HealingWings provides safe homes and professional rehabilitation services for girl survivors of sexual abuse and trafficking, helping them successfully reintegrate into family life and society.
              </p>
              <p>
                With residential shelters serving girls aged 8 to 18, we work alongside local authorities and the Department of Social Welfare and Development (DSWD) to rescue, shelter, and restore.
              </p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {[
                { icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 12L12 3l9 9" /><path d="M9 21V12h6v9" /><path d="M3 12v9h18v-9" /></svg>, label: 'Safe Residential Homes' },
                { icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 21C12 21 4 14.5 4 9a8 8 0 0 1 16 0c0 5.5-8 12-8 12z" /><path d="M12 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="currentColor" /><path d="M12 11v3" /></svg>, label: 'Trauma Counseling' },
                { icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>, label: 'Education Programs' },
                { icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>, label: 'Family Reintegration' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-stone-600 text-[13px] font-medium">
                  <span className="hw-text-teal flex-shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <a
              href="#donate"
              className="hw-btn-magenta inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm mt-6 no-underline self-start"
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
// Section 3 — Approach  (snap chapter 3)
// ─────────────────────────────────────────────────────────────────────────────
function ApproachSection() {
  return (
    <div
      id="programs"
      className="hw-snap-section flex flex-col justify-center"
      style={{ background: '#D97706' }}
    >
      <CarouselPillarsSection />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 4 — Donate  (snap chapter 4)
// ─────────────────────────────────────────────────────────────────────────────
function DonationBanner() {
  const ref = useFadeIn();

  return (
    <section
      id="donate"
      ref={ref}
      className="hw-snap-section relative flex flex-col justify-center bg-[#f6f1ff] px-6 lg:px-16"
    >
      <div className="mx-auto max-w-5xl w-full py-10">
        <div className="mb-8 text-center">
          <span className="hw-eyebrow">Make an Impact</span>
          <h2 className="hw-heading-font mt-3 text-4xl md:text-5xl font-semibold text-[#1E3A5F] leading-tight">
            Your donation<br />changes lives
          </h2>
        </div>

        <div className="border-[5px] border-[#6B21A8]">
          <div className="p-[12px]">
            <div className="bg-[#efe6ff] shadow-lg">
              <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] min-h-[300px]">
                <div className="relative overflow-hidden min-h-[200px]">
                  <img
                    src="/girl-portrait.png"
                    alt="HealingWings Resident"
                    className="h-full w-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/10 to-transparent" />
                  <div className="absolute bottom-5 left-5 max-w-[220px] text-white">
                    <p className="text-sm leading-5 font-medium">Every contribution helps provide safety and hope.</p>
                  </div>
                </div>
                <div className="flex items-center px-8 py-7 lg:px-10">
                  <div className="w-full">
                    <div className="bg-white p-5 shadow-md border border-stone-200">
                      <DonationWidget />
                      <div className="mt-4 flex gap-6 border-t pt-4 text-sm">
                        <div className="flex items-center gap-2 text-stone-600">
                          <svg className="w-4 h-4 text-[#0D9488]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Impact Driven
                        </div>
                        <div className="flex items-center gap-2 text-stone-600">
                          <svg className="w-4 h-4 text-[#6B21A8]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
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
// Donor Wall (final, no snap — natural scroll after last chapter)
// ─────────────────────────────────────────────────────────────────────────────
const ALL_DONORS = [
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
    id: number; name: string; size: string; weight: string; opacity: number;
    left: string; top: string; duration: string; delay: string;
  };
  const particles: DonorParticle[] = useMemo(() =>
    ALL_DONORS.map((donor, i) => ({
      id: i, ...donor,
      left: `${(i * 7 + 3) % 90}%`,
      top: `${(i * 11 + 5) % 82}%`,
      duration: `${20 + (i % 7) * 5}s`,
      delay: `${-(i * 2.3) % 18}s`,
    }))
  , []);

  return (
    <section className="relative overflow-hidden bg-white" style={{ minHeight: '420px' }}>
      <div className="absolute inset-0 bg-gradient-to-b from-[#FAFAF9] to-white z-0" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-10">
        {particles.map((p) => (
          <div
            key={p.id}
            className={`absolute hw-animate-float hw-donor-name ${p.size} ${p.weight} text-[#B45309]`}
            style={{
              left: p.left, top: p.top, opacity: p.opacity,
              '--float-duration': p.duration, '--float-delay': p.delay,
              letterSpacing: '0.01em',
            } as React.CSSProperties & { '--float-duration': string; '--float-delay': string }}
          >
            {p.name}
          </div>
        ))}
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center text-center pointer-events-none" style={{ minHeight: '420px', padding: '80px 24px' }}>
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 lg:p-12 shadow-[0_8px_32px_rgba(30,58,95,0.06)] max-w-3xl">
          <h2 className="hw-heading-font text-[#1E3A5F] font-semibold text-4xl lg:text-5xl leading-tight mix-blend-multiply mb-4">
            Thank you to our Donors
          </h2>
          <p className="text-stone-600/90 text-lg lg:text-xl font-light tracking-wide">
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
  const [impactKpis, setImpactKpis] = useState({
    residentsServed: 247,
    safehousesActive: 4,
    reintegrationRatePct: 89,
    yearsOfImpact: 6,
  });

  useEffect(() => {
    let cancelled = false;
    fetchJson<PublicLiveStats>('/api/public-impact/live-stats')
      .then((s) => {
        if (cancelled) return;
        const yearsOfImpact = s.oldestAdmissionYear
          ? Math.max(1, new Date().getFullYear() - s.oldestAdmissionYear + 1)
          : impactKpis.yearsOfImpact;
        setImpactKpis({
          residentsServed: s.totalResidents || impactKpis.residentsServed,
          safehousesActive: s.safehousesActive || impactKpis.safehousesActive,
          reintegrationRatePct: s.reintegrationRatePct || impactKpis.reintegrationRatePct,
          yearsOfImpact,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // hw-snap-container enables CSS scroll snapping
    <div className="hw-snap-container" style={{ fontFamily: 'var(--hw-font-body)' }}>
      <NavBar />
      <HeroSection
        residentsServed={impactKpis.residentsServed}
        safehousesActive={impactKpis.safehousesActive}
        reintegrationRatePct={impactKpis.reintegrationRatePct}
        yearsOfImpact={impactKpis.yearsOfImpact}
      />
      <MissionSection />
      <ApproachSection />
      <DonationBanner />
      <DonorWallSection />
      <Footer />
    </div>
  );
}
