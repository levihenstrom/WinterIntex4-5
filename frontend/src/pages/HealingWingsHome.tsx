import { useEffect, useRef, useState } from 'react';
import NavBar from '../components/hw/NavBar';
import MetricCard from '../components/hw/MetricCard';
import DonationWidget from '../components/hw/DonationWidget';
import Footer from '../components/hw/Footer';
import CarouselPillarsSection from '../components/hw/CarouselPillarsSection';
import { fetchJson } from '../lib/apiClient';


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
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => cardRef.current?.classList.add('hw-donate-in-left'), 100);
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="donate"
      ref={sectionRef}
      className="hw-snap-section relative flex items-center overflow-hidden"
      style={{ backgroundColor: '#1E3A5F' }}
    >
      {/* Full-bleed background photo */}
      <img
        src="/ninadonacion.png"
        alt="HealingWings child"
        className="absolute inset-0 w-full h-full object-cover object-right"
      />
      {/* Gradient: dark on left so form is readable, fades to transparent right */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to right, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.20) 45%, transparent 75%)'
      }} />

      {/* Floating form card — shifted right */}
      <div
        ref={cardRef}
        className="hw-donate-slide relative z-10 ml-16 lg:ml-28
                   w-full max-w-[420px] lg:max-w-[460px]
                   bg-white/95 backdrop-blur-sm rounded-2xl px-8 py-9
                   shadow-[0_20px_60px_rgba(0,0,0,0.22)]"
        style={{ opacity: 0, transform: 'translateX(-40px)' }}
      >
        <span className="hw-eyebrow text-amber-600 mb-2 block">Make an Impact</span>
        <h2 className="hw-heading-font text-3xl lg:text-4xl font-semibold text-[#1E3A5F] leading-tight mb-5">
          Your donation<br />changes lives
        </h2>

        <DonationWidget />

        <div className="mt-5 flex gap-5 border-t border-stone-100 pt-4 text-xs text-stone-400">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Impact Driven
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-[#1E3A5F]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Secure Giving
          </div>
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
      {/* Final snap — footer */}
      <div className="hw-snap-final">
        <Footer />
      </div>
    </div>
  );
}
