import { useEffect, useRef } from 'react';
import NavBar from '../components/hw/NavBar';
import SectionContainer from '../components/hw/SectionContainer';
import MetricCard from '../components/hw/MetricCard';
import PillarCard from '../components/hw/PillarCard';
import QuoteBlock from '../components/hw/QuoteBlock';
import DonationWidget from '../components/hw/DonationWidget';
import Footer from '../components/hw/Footer';

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
const PILLAR_EDU_IMG = 'https://images.unsplash.com/photo-1513258496099-48168024aec0?w=800&auto=format&fit=crop&q=80';
const PILLAR_HEAL_IMG = 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80';
const PILLAR_REINT_IMG = 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=800&auto=format&fit=crop&q=80';

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
        <span className="inline-block mb-5 px-4 py-1.5 rounded-full bg-purple-900/40 border border-purple-300/30 text-xs font-bold tracking-[0.18em] uppercase backdrop-blur-sm" style={{ color: '#D8B4FE' }}>
          A safe place for every child
        </span>
        <h1
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight max-w-4xl hw-heading-font"
        >
          Every child deserves
          <br />
          <span className="hw-text-soft">to heal and soar</span>
        </h1>
        <p className="mt-6 text-base md:text-lg text-white/80 max-w-2xl leading-relaxed">
          HealingWings provides safe homes, counseling, and education for children who are survivors of
          trafficking and abuse in the Philippines.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <a href="#donate" className="hw-btn-magenta inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm tracking-wide no-underline">
            Donate Now →
          </a>
          <a href="#mission" className="hw-btn-ghost-white inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-semibold text-sm tracking-wide no-underline">
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
    <section id="impact" className="hw-bg-navy">
      <SectionContainer>
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/10">
          <MetricCard target={247} label="children Served" />
          <MetricCard target={4} label="Safe Homes" />
          <MetricCard target={89} suffix="%" label="Reintegration Rate" />
          <MetricCard target={6} label="Years of Impact" />
        </div>
      </SectionContainer>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 3 — Mission Statement
// ─────────────────────────────────────────────────────────────────────────────
function MissionSection() {
  return (
    <section id="mission" className="py-24 lg:py-32 overflow-hidden hw-bg-offwhite">
      <SectionContainer>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          {/* Photo */}
          <div className="hw-fade-in" ref={useFadeIn()}>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl h-[420px] lg:h-[520px]">
              <img src={MISSION_IMG} alt="A child in a safe space" className="w-full h-full object-cover" />
              </div>
            {/* Badge */}
            <div className="hw-badge-purple absolute mt-[-60px] ml-[20px] w-32 h-32 rounded-full flex items-center justify-center shadow-lg"
              style={{ position: 'relative', top: '-60px', left: '20px', width: '128px', height: '128px', borderRadius: '50%' }}>
              <span className="text-white font-extrabold text-xl text-center leading-tight hw-heading-font">
                Since<br />2019
              </span>
            </div>
          </div>
          {/* Text */}
          <div className="hw-fade-in hw-delay-100" ref={useFadeIn()}>
            <span className="hw-eyebrow">Our Mission</span>
            <h2 className="hw-heading mt-3 text-3xl md:text-4xl font-extrabold leading-snug">
              We believe every child deserves safety, healing, and a future.
            </h2>
            <div className="mt-6 space-y-4 text-stone-600 leading-relaxed text-base">
              <p>
                Created to meet the needs of children-survivors of sexual abuse and sex trafficking in the world by providing a safe haven and professional rehabilitation services so children can successfully reintegrate back into family life and society.
                There is a great need for residential shelters in different countries for children who are trapped in abuse or who are sexually trafficked. Lighthouse Sanctuary has stepped up to fill the need for female survivors between the ages of 8 to 18.

              </p>
              <p>
                Lighthouse Sanctuary has two residential style shelters, that caters to up to 20 children each. The children are rescued by the local police department or anti-trafficking agents who refer the children through the Department of Social Welfare and Development (DSWD) to Lighthouse Sanctuary. The social worker in the sanctuary will assist the child in transitioning into their new environment.

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
      </SectionContainer>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 4 — Three Pillars
// ─────────────────────────────────────────────────────────────────────────────
function PillarsSection() {
  const ref = useFadeIn();
  return (
    <section id="pillars" className="py-24 lg:py-32 hw-bg-gray">
      <SectionContainer>
        <div className="text-center mb-14 hw-fade-in" ref={ref}>
          <span className="hw-eyebrow">Our Approach</span>
          <h2 className="hw-heading mt-3 text-3xl md:text-4xl font-extrabold">
            How we restore lives
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Purple overlay */}
          <PillarCard imageUrl={PILLAR_EDU_IMG} title="Education" subtitle="Giving every child the tools to build her own future." overlayColor="var(--hw-pillar-edu)" />
          {/* Teal overlay */}
          <PillarCard imageUrl={PILLAR_HEAL_IMG} title="Healing" subtitle="Trauma-informed care for every resident, at her own pace." overlayColor="var(--hw-pillar-heal)" />
          <PillarCard imageUrl={PILLAR_REINT_IMG} title="Reintegration" subtitle="Restoring family bonds, community, and the will to thrive." overlayColor="var(--hw-pillar-reint)" />
        </div>
      </SectionContainer>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 5 — Story Spotlight
// ─────────────────────────────────────────────────────────────────────────────
function StorySpotlight() {
  const ref = useFadeIn();
  return (
    <section id="stories" className="py-28 lg:py-36 hw-bg-lavender">
      <div className="hw-fade-in" ref={ref}>
        <QuoteBlock
          quote="For the first time in my life, I felt safe."
          attribution="Anonymous Resident"
          subtext="One of 247 children who found hope at HealingWings."
          ctaLabel="Read More Stories"
          ctaHref="#"
          accentColor="#6B21A8"
          textColor="#3b0764"
          subColor="#0D9488"
        />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 6 — Color Meaning Callout
// ─────────────────────────────────────────────────────────────────────────────
function ColorMeaningSection() {
  const ref = useFadeIn();
  const cards = [
    {
      color: '#6B21A8',
      label: 'Purple',
      cause: 'Domestic Violence Awareness',
      desc: 'Purple represents the courage and resilience of survivors of domestic violence — the strength to speak, seek safety, and start again.',
    },
    {
      color: '#0D9488',
      label: 'Teal',
      cause: 'Sexual Assault Prevention',
      desc: 'Teal represents the fight for consent, safety, and healing — because every survivor deserves to be believed, supported, and free.',
    },
    {
      color: '#1E3A5F',
      label: 'Navy',
      cause: 'Child Abuse Prevention',
      desc: 'Navy represents the protection every child deserves — because no child should ever have to endure what our residents have survived.',
    },
  ];
  return (
    <section className="py-20 lg:py-28 hw-bg-white">
      <SectionContainer>
        <div className="text-center mb-12 hw-fade-in" ref={ref}>
          <span className="hw-eyebrow">Intentional by Design</span>
          <h2 className="mt-2 text-2xl md:text-3xl font-extrabold text-stone-800 hw-heading-font">
            Why our colors matter
          </h2>
          <p className="mt-3 text-stone-500 text-sm max-w-xl mx-auto">
            Every color in our brand is a deliberate act of solidarity with the causes we serve.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card) => (
            <div
              key={card.label}
              className="hw-fade-in rounded-2xl p-7 bg-white shadow-sm border border-stone-100"
              ref={useFadeIn()}
              style={{ borderLeft: `5px solid ${card.color}` }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: card.color }} />
                <span className="font-bold text-sm" style={{ color: card.color }}>{card.label}</span>
                <span className="text-stone-400 text-xs">·</span>
                <span className="text-stone-500 text-xs font-medium">{card.cause}</span>
              </div>
              <p className="text-stone-600 text-sm leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </SectionContainer>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 7 — How You Can Help
// ─────────────────────────────────────────────────────────────────────────────
function HowToHelpSection() {
  const ref = useFadeIn();
  const cols = [
    {
      iconColor: '#E11D74',
      iconPath: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
      title: 'Donate',
      desc: 'Your gift funds safe shelter, counseling, and education for one more children who needs hope.',
      link: 'Give Today →',
    },
    {
      iconColor: '#6B21A8',
      iconPath: (
        <>
          <path d="M18 11V20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          <line x1="12" y1="15" x2="12" y2="18" />
        </>
      ),
      title: 'Volunteer',
      desc: 'Bring your skills to the safehouses — educators, counselors, mentors, and more are always needed.',
      link: 'Get Involved →',
    },
    {
      iconColor: '#1E3A5F',
      iconPath: (
        <>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </>
      ),
      title: 'Spread the Word',
      desc: 'Share our mission and help us reach more children in need. Every voice amplifies our impact.',
      link: 'Share Now →',
    },
  ];
  return (
    <section className="py-24 lg:py-32 hw-bg-white">
      <SectionContainer>
        <div className="text-center mb-14 hw-fade-in" ref={ref}>
          <span className="hw-eyebrow">Get Involved</span>
          <h2 className="hw-heading mt-3 text-3xl md:text-4xl font-extrabold">
            Join the mission
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
          {cols.map((col) => (
            <div key={col.title} className="text-center px-4 hw-fade-in" ref={useFadeIn()}>
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
                style={{ background: col.iconColor + '18' }}
              >
                <svg width="26" height="26" fill="none" stroke={col.iconColor} strokeWidth="1.8" viewBox="0 0 24 24">
                  {col.iconPath}
                </svg>
              </div>
              <h3 className="text-xl font-bold text-stone-800 mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                {col.title}
              </h3>
              <p className="text-stone-500 text-sm leading-relaxed mb-5">{col.desc}</p>
              <a href="#" className="hw-text-teal font-semibold text-sm no-underline transition-colors">
                {col.link}
              </a>
            </div>
          ))}
        </div>
      </SectionContainer>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 8 — Donation CTA Banner
// ─────────────────────────────────────────────────────────────────────────────
function DonationBanner() {
  const ref = useFadeIn();
  return (
    <section id="donate" className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 hw-bg-donate" />
      {/* Decorative circles */}
      <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-96 h-96 rounded-full bg-white/5 pointer-events-none" />
      <SectionContainer className="relative z-10">
        <div className="text-center mb-10 hw-fade-in" ref={ref}>
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-snug hw-heading-font"
          >
            ₱500 provides one week of safety
            <br />
            <span className="hw-text-soft">for a child in need.</span>
          </h2>
          <p className="mt-4 text-white/75 text-base">Every peso goes directly to the children we serve.</p>
        </div>
        <DonationWidget />
      </SectionContainer>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 9 — Partners
// ─────────────────────────────────────────────────────────────────────────────
function PartnersSection() {
  const ref = useFadeIn();
  return (
    <section className="py-16 hw-bg-lavender2">
      <SectionContainer>
        <div className="text-center mb-10 hw-fade-in" ref={ref}>
          <span className="hw-eyebrow">Trusted by our partners</span>
        </div>
        <div className="flex flex-wrap justify-center items-center gap-6">
          {['UNICEF Philippines', 'DSWD', 'IJM', 'Hope Foundation', 'Rotary Club', 'GMA Kapuso'].map((name) => (
            <div
              key={name}
              className="hw-partner-logo hw-partner-bg h-12 px-6 flex items-center justify-center rounded-lg shadow-sm"
            >
              <span className="text-stone-500 text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                {name}
              </span>
            </div>
          ))}
        </div>
      </SectionContainer>
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
      <PillarsSection />
      <StorySpotlight />
      <ColorMeaningSection />
      <HowToHelpSection />
      <DonationBanner />
      <PartnersSection />
      <Footer />
    </div>
  );
}
