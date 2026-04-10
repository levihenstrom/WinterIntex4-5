import { useRef, useEffect, useState } from 'react';

const CAROUSEL_PILLARS = [
  {
    title: 'Physiological Needs',
    teaser: 'Food, water, and shelter.',
    description: 'Secure shelter, nutritious meals, and clean environments to meet every basic physical need.',
    imgUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&auto=format&fit=crop&q=80'
  },
  {
    title: 'Biological Needs',
    teaser: 'Comprehensive medical care.',
    description: 'Regular medical and dental care to closely monitor and support physical health.',
    imgUrl: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=800&auto=format&fit=crop&q=80'
  },
  {
    title: 'Spiritual Needs',
    teaser: 'Finding meaning and hope.',
    description: 'Faith-based counseling to help children find inner strength and renewed hope.',
    imgUrl: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&auto=format&fit=crop&q=80'
  },
  {
    title: 'Psychological Needs',
    teaser: 'Expert therapeutic care.',
    description: 'Trauma-informed therapy sessions to safely heal deep psychological wounds.',
    imgUrl: 'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=800&auto=format&fit=crop&q=80'
  },
  {
    title: 'Social Needs',
    teaser: 'Rebuilding community trust.',
    description: 'Positive peer activities and ongoing education to rebuild active community trust.',
    imgUrl: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800&auto=format&fit=crop&q=80'
  },
  {
    title: 'Love and Belonging',
    teaser: 'Family and lasting bonds.',
    description: 'A deeply nurturing environment preparing each child for a safe, supportive family reunion.',
    imgUrl: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&auto=format&fit=crop&q=80'
  }
];

export default function CarouselPillarsSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState(CAROUSEL_PILLARS);

  useEffect(() => {
    setItems([...CAROUSEL_PILLARS, ...CAROUSEL_PILLARS]);
  }, []);

  const handleScroll = (dir: 1 | -1) => {
    if (wrapperRef.current) {
      wrapperRef.current.scrollBy({ left: dir * 300, behavior: 'smooth' });
    }
  };

// ... existing imports and array ...

// ... existing imports and array ...

  return (
    <section className="pt-16 pb-0">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 mb-14 text-center">
        <span className="hw-eyebrow text-white/80" style={{ color: 'rgba(255,255,255,0.85)' }}>Our Approach</span>
        <h2 className="text-3xl md:text-4xl font-semibold mt-3 text-white" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
          Our Programs and Services
        </h2>
      </div>

      <div className="relative w-full overflow-hidden hw-carousel-section">
        {/* Scroll Wrapper */}
        <div ref={wrapperRef} className="w-full overflow-x-hidden no-scrollbar">
          {/* Carousel Track */}
          <div 
            ref={trackRef}
            className="flex hw-carousel-track items-end"
          >
            {items.map((pillar, idx) => (
              <div 
                key={`${pillar.title}-${idx}`} 
                className="hw-carousel-card relative w-[180px] md:w-[220px] lg:w-[280px] shrink-0 rounded-t-[9999px] border-[4px] border-white border-b-0 overflow-hidden shadow-xl bg-black"
                style={{ aspectRatio: '3/4' }}
              >
                {/* Background Image */}
                <img 
                  src={pillar.imgUrl} 
                  alt={pillar.title} 
                  className="hw-card-img relative z-0 w-full h-full object-cover transition-transform"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    transitionDuration: '350ms',
                    transitionTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  }}
                />
                
                {/* Default Bottom Gradient Overlay (Subtle) */}
                <div className="hw-default-overlay absolute z-10 inset-x-0 bottom-0 h-[45%] flex flex-col justify-end p-4 transition-opacity duration-300 pointer-events-none"
                     style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)' }}>
                  <h3 className="text-white font-bold text-base md:text-lg leading-tight mb-1">{pillar.title}</h3>
                  <p className="text-white/90 text-xs font-medium">{pillar.teaser}</p>
                </div>

                {/* Hover Solid Dark Blue Overlay (Replaces image) */}
                <div
                  className="hw-hover-overlay absolute z-20 inset-0 p-5 flex flex-col justify-center opacity-0 transition-opacity duration-300 pointer-events-none"
                  style={{ backgroundColor: '#1E3A5F' }}
                >
                  <h3 className="font-extrabold text-[18px] mb-3 text-white">{pillar.title}</h3>
                  <p className="text-white/90 font-medium text-[14px] leading-relaxed">{pillar.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Arrows */}
        <button 
          onClick={() => handleScroll(-1)}
          className="hw-carousel-arrow absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center text-[#D97706] hover:scale-110 transition-all z-10 opacity-0 focus:opacity-100"
          aria-label="Previous"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
        </button>
        <button 
          onClick={() => handleScroll(1)}
          className="hw-carousel-arrow absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center text-[#D97706] hover:scale-110 transition-all z-10 opacity-0 focus:opacity-100"
          aria-label="Next"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
    </section>
  );
}
