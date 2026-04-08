import NavBar from '../components/hw/NavBar';
import Footer from '../components/hw/Footer';
import HealingWingsLogo from '../components/hw/HealingWingsLogo';

const STORIES = [
  {
    name: 'Maria, 14',
    tag: 'Survivor · Cebu',
    quote:
      '"When I arrived at HealingWings, I was afraid of everything. Now I laugh every day. I am learning to paint and I dream of becoming a teacher."',
    img: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80',
    color: '#0D9488',
  },
  {
    name: 'Ana, 11',
    tag: 'Survivor · Manila',
    quote:
      '"The counselors here never gave up on me. For the first time in my life I felt safe enough to sleep through the night."',
    img: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80',
    color: '#6B21A8',
  },
  {
    name: 'Grace, 16',
    tag: 'Graduate · Davao',
    quote:
      '"I finished high school at the top of my class. HealingWings gave me the books, the tutors, and the belief that I could do it."',
    img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80',
    color: '#1E3A5F',
  },
  {
    name: 'Joy, 13',
    tag: 'Survivor · Iloilo',
    quote:
      '"I used to think nobody cared. Here, everyone knows my name. The staff pray with us, eat with us, celebrate with us."',
    img: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=400&q=80',
    color: '#D97706',
  },
];

export default function StoriesPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb' }}>
      <NavBar />

      {/* Hero */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1E3A5F 0%, #6B21A8 100%)',
          paddingTop: '7rem',
          paddingBottom: '3.5rem',
          textAlign: 'center',
          color: 'white',
        }}
      >
        <HealingWingsLogo size={52} style={{ marginBottom: 16 }} />
        <h1
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 800,
            fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
            margin: '0 0 12px',
          }}
        >
          Stories of Hope
        </h1>
        <p
          style={{
            fontSize: 16,
            opacity: 0.85,
            maxWidth: 520,
            margin: '0 auto',
            lineHeight: 1.6,
          }}
        >
          Every child who walks through our doors carries a story of courage.
          These are just a few of the lives you help change.
        </p>
      </div>

      {/* Cards grid */}
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '3rem 1.5rem 4rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 28,
        }}
      >
        {STORIES.map((s) => (
          <div
            key={s.name}
            style={{
              background: 'white',
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(30,58,95,0.08)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Photo */}
            <div style={{ position: 'relative', height: 220 }}>
              <img
                src={s.img}
                alt={s.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)',
                }}
              />
              <div style={{ position: 'absolute', bottom: 14, left: 16 }}>
                <p style={{ margin: 0, color: 'white', fontWeight: 800, fontSize: 17, fontFamily: 'Poppins, sans-serif' }}>
                  {s.name}
                </p>
                <span
                  style={{
                    background: s.color,
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 10px',
                    borderRadius: 20,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  {s.tag}
                </span>
              </div>
            </div>

            {/* Quote */}
            <div style={{ padding: '20px 20px 24px', flex: 1 }}>
              <div
                style={{
                  width: 32,
                  height: 3,
                  background: s.color,
                  borderRadius: 2,
                  marginBottom: 14,
                }}
              />
              <p
                style={{
                  margin: 0,
                  color: '#374151',
                  fontSize: 14,
                  lineHeight: 1.75,
                  fontStyle: 'italic',
                }}
              >
                {s.quote}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0D9488, #1E3A5F)',
          textAlign: 'center',
          padding: '3rem 1.5rem',
          color: 'white',
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            opacity: 0.8,
            marginBottom: 8,
          }}
        >
          Make a difference today
        </p>
        <h2
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 800,
            fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
            margin: '0 0 20px',
          }}
        >
          Help write the next story of hope
        </h2>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="/#donate"
            style={{
              background: 'white',
              color: '#1E3A5F',
              borderRadius: 50,
              padding: '12px 28px',
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Donate Now →
          </a>
          <a
            href="/volunteer"
            style={{
              background: 'transparent',
              color: 'white',
              border: '2px solid rgba(255,255,255,0.6)',
              borderRadius: 50,
              padding: '12px 28px',
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Volunteer
          </a>
        </div>
      </div>

      <Footer />
    </div>
  );
}
