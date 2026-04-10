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
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 pb-8" style={{ paddingTop: '18vh' }}>
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold text-white leading-tight max-w-4xl hw-heading-font hw-text-shadow-heavy">
          Every child deserves
          <br />
          <em>to heal and soar</em>
        </h1>
        <p className="mt-3 text-base md:text-lg text-white/75 max-w-xl leading-relaxed hw-text-shadow-heavy font-light tracking-wide">
          HealingWings provides safe homes, counseling, and education for children who are survivors of
          trafficking and abuse in the World.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-4 justify-center">
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
// Full-bleed image that transitions to a framed editorial layout on settle.
// ─────────────────────────────────────────────────────────────────────────────
function MissionSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Short delay so user sees the full-bleed first, then the frame settles in
          setTimeout(() => el.classList.add('hw-mission-framed'), 300);
        } else {
          el.classList.remove('hw-mission-framed');
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="mission"
      ref={sectionRef}
      className="hw-snap-section hw-mission-cinematic relative bg-white flex items-center justify-center overflow-hidden"
    >
      {/* Image wrapper — transitions from full-bleed to framed, contains text too */}
      <div className="hw-mission-img-frame absolute inset-0 transition-all duration-700 ease-out overflow-hidden">
        <img
          src={MISSION_IMG}
          alt="A child in a safe space"
          className="w-full h-full object-cover"
        />
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0.05) 100%)'
        }} />

        {/* Text — lives inside the frame so it clips with rounded corners */}
        <div className="absolute inset-0 flex flex-col justify-end px-8 md:px-16 lg:px-20 pb-10 md:pb-14">
        {/* Eyebrow with pill backdrop */}
        <span
          className="hw-eyebrow mb-3 self-start px-3 py-1 rounded-full text-white tracking-widest"
          style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', letterSpacing: '0.18em' }}
        >
          Our Mission
        </span>
        <h2
          className="hw-heading-font text-white font-semibold leading-[1.1] max-w-2xl"
          style={{ fontSize: 'clamp(2rem, 4.5vw, 3.75rem)' }}
        >
          We believe every child deserves safety, healing, and a future.
        </h2>
        <p className="mt-4 text-white/70 text-[15px] font-light leading-relaxed max-w-lg">
          Safe homes, counseling, and education for girl survivors of trafficking and abuse — helping them heal and return to family life.
        </p>
        <a
          href="#donate"
          className="mt-5 inline-flex items-center gap-2 px-7 py-3 rounded-full font-semibold text-sm no-underline self-start text-white"
          style={{ background: '#D97706' }}
        >
          How to Help →
        </a>
        </div>{/* end text */}
      </div>{/* end hw-mission-img-frame */}
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
  const sectionRef = useRef<HTMLElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          leftRef.current?.classList.add('hw-donate-in-left');
          setTimeout(() => rightRef.current?.classList.add('hw-donate-in-right'), 150);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="donate"
      ref={sectionRef}
      className="hw-snap-section relative flex items-center justify-center bg-white overflow-hidden"
    >
      {/* Subtle warm texture */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 20% 50%, rgba(217,119,6,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, rgba(30,58,95,0.05) 0%, transparent 60%)'
      }} />

      <div className="relative w-full max-w-6xl mx-auto px-6 lg:px-16 py-12 grid grid-cols-1 lg:grid-cols-2 gap-0 items-stretch min-h-[520px]">

        {/* Left — image with quote */}
        <div
          ref={leftRef}
          className="hw-donate-slide relative rounded-l-3xl overflow-hidden min-h-[360px] lg:min-h-0"
          style={{ opacity: 0, transform: 'translateX(-40px)' }}
        >
          <img
            src="/ninos.jpeg"
            alt="Children at HealingWings"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to top, rgba(10,20,40,0.80) 0%, rgba(10,20,40,0.20) 55%, transparent 100%)'
          }} />
          <div className="absolute bottom-8 left-8 right-8">
            <p className="text-white/90 text-lg font-light leading-relaxed italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              "Every child deserves safety, healing, and a future full of hope."
            </p>
            <div className="mt-3 w-10 h-[2px] bg-amber-400" />
          </div>
        </div>

        {/* Right — form panel */}
        <div
          ref={rightRef}
          className="hw-donate-slide flex flex-col justify-center bg-white rounded-r-3xl px-8 py-10 lg:px-12 shadow-[0_8px_48px_rgba(0,0,0,0.10)] border border-stone-100"
          style={{ opacity: 0, transform: 'translateX(40px)' }}
        >
          <span className="hw-eyebrow text-amber-600 mb-3">Make an Impact</span>
          <h2 className="hw-heading-font text-3xl md:text-4xl font-semibold text-[#1E3A5F] leading-tight mb-6">
            Your donation<br />changes lives
          </h2>

          <DonationWidget />

          <div className="mt-5 flex gap-6 border-t border-stone-100 pt-4 text-sm text-stone-500">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Impact Driven
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#1E3A5F]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Secure Giving
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
      {/* Final snap — donor wall + footer together */}
      <div className="hw-snap-final">
        <DonorWallSection />
        <Footer />
      </div>
    </div>
  );
}
