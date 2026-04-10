const CAROUSEL_PILLARS = [
  {
    title: 'Physiological Needs',
    description: 'Secure shelter, nutritious meals, and clean environments to meet every basic physical need.',
    imgUrl: '/food.jpg'
  },
  {
    title: 'Biological Needs',
    description: 'Regular medical and dental care to closely monitor and support physical health.',
    imgUrl: '/doctor.jpg'
  },
  {
    title: 'Spiritual Needs',
    description: 'Faith-based counseling to help children find inner strength and renewed hope.',
    imgUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop&q=80'
  },
  {
    title: 'Psychological Needs',
    description: 'Trauma-informed therapy sessions to safely heal deep psychological wounds.',
    imgUrl: '/phycology.jpg'
  },
  {
    title: 'Social Needs',
    description: 'Positive peer activities and ongoing education to rebuild active community trust.',
    imgUrl: '/social.jpg'
  },
  {
    title: 'Love and Belonging',
    description: 'A deeply nurturing environment preparing each child for a safe, supportive family reunion.',
    imgUrl: '/sisters.jpg'
  }
];

// Duplicate for seamless infinite marquee
const ITEMS = [...CAROUSEL_PILLARS, ...CAROUSEL_PILLARS];

export default function CarouselPillarsSection() {
  return (
    <section className="pt-16 pb-0">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 mb-14 text-center">
        <span
          className="hw-eyebrow"
          style={{ color: 'rgba(255,255,255,0.85)' }}
        >
          Our Approach
        </span>
        <h2
          className="text-3xl md:text-4xl font-semibold mt-3 text-white"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Our Programs and Services
        </h2>
      </div>

      {/* Carousel Strip */}
      <div className="w-full overflow-hidden hw-pillar-strip">
        <div className="hw-pillar-track">
          {ITEMS.map((pillar, idx) => (
            <div
              key={`${pillar.title}-${idx}`}
              className="hw-pillar-card"
            >
              {/* Photo */}
              <img
                src={pillar.imgUrl}
                alt={pillar.title}
                className="hw-pillar-img"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />

              {/* Always-visible bottom gradient + title */}
              <div className="hw-pillar-default">
                <h3 className="hw-pillar-title">{pillar.title}</h3>
              </div>

              {/* Hover overlay — image stays, dark wash fades in */}
              <div className="hw-pillar-hover">
                <h3 className="hw-pillar-hover-title">{pillar.title}</h3>
                <p className="hw-pillar-hover-desc">{pillar.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
