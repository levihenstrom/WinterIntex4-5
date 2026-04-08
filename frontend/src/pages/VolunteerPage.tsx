import { useState } from 'react';
import { Link } from 'react-router-dom';
import NavBar from '../components/hw/NavBar';
import HealingWingsLogo from '../components/hw/HealingWingsLogo';
import Footer from '../components/hw/Footer';

const AREAS = [
  'Child Care & Support',
  'Education & Tutoring',
  'Counseling Assistance',
  'Fundraising & Events',
  'Administrative Support',
  'Social Media & Communications',
  'Construction & Maintenance',
  'Medical / Health Services',
];

export default function VolunteerPage() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    country: '',
    areas: [] as string[],
    availability: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  function toggle(area: string) {
    setForm(f => ({
      ...f,
      areas: f.areas.includes(area)
        ? f.areas.filter(a => a !== area)
        : [...f.areas, area],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: wire up to backend
    setSubmitted(true);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb' }}>
      <NavBar />

      {/* Hero banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1E3A5F 0%, #0D9488 100%)',
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
          Volunteer With Us
        </h1>
        <p style={{ fontSize: 16, opacity: 0.85, maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
          Join our mission to restore hope and rebuild lives for girl survivors of
          trafficking and abuse in the Philippines.
        </p>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        {submitted ? (
          /* ── Thank-you card ── */
          <div
            style={{
              background: 'white',
              borderRadius: 20,
              padding: '3rem 2rem',
              textAlign: 'center',
              boxShadow: '0 8px 40px rgba(30,58,95,0.1)',
            }}
          >
            <div style={{ fontSize: 56, marginBottom: 16 }}>🕊️</div>
            <h2
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 800,
                color: '#1E3A5F',
                marginBottom: 8,
              }}
            >
              Thank you for your heart!
            </h2>
            <p style={{ color: '#6B7280', lineHeight: 1.7, maxWidth: 440, margin: '0 auto 24px' }}>
              We've received your application and will reach out soon to discuss
              next steps. Every helping hand makes a real difference.
            </p>
            <Link
              to="/"
              style={{
                display: 'inline-block',
                background: '#0D9488',
                color: 'white',
                borderRadius: 50,
                padding: '12px 32px',
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              Back to Home
            </Link>
          </div>
        ) : (
          /* ── Form card ── */
          <div
            style={{
              background: 'white',
              borderRadius: 20,
              boxShadow: '0 8px 40px rgba(30,58,95,0.08)',
              overflow: 'hidden',
            }}
          >
            {/* Accent bar */}
            <div style={{ height: 4, background: 'linear-gradient(90deg, #0D9488, #1E3A5F)' }} />

            <form onSubmit={handleSubmit} style={{ padding: '2rem 2rem 2.5rem' }}>
              <h2
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 800,
                  color: '#1E3A5F',
                  fontSize: '1.35rem',
                  marginBottom: 4,
                }}
              >
                Volunteer Application
              </h2>
              <p style={{ color: '#9CA3AF', fontSize: 13, marginBottom: '1.75rem' }}>
                Fill in the form below and our team will get back to you within 3–5 business days.
              </p>

              {/* Name row */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={labelStyle}>First Name *</label>
                  <input
                    required
                    type="text"
                    className="form-control"
                    placeholder="Maria"
                    value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={labelStyle}>Last Name *</label>
                  <input
                    required
                    type="text"
                    className="form-control"
                    placeholder="Santos"
                    value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Email + Phone */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={labelStyle}>Email *</label>
                  <input
                    required
                    type="email"
                    className="form-control"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={labelStyle}>Phone</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="+1 (555) 000-0000"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Country + Availability */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={labelStyle}>Country / Region *</label>
                  <input
                    required
                    type="text"
                    className="form-control"
                    placeholder="Philippines"
                    value={form.country}
                    onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={labelStyle}>Availability</label>
                  <select
                    className="form-select"
                    value={form.availability}
                    onChange={e => setForm(f => ({ ...f, availability: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="">Select...</option>
                    <option>Weekdays</option>
                    <option>Weekends</option>
                    <option>Flexible</option>
                    <option>Remote only</option>
                  </select>
                </div>
              </div>

              {/* Areas of interest */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ ...labelStyle, display: 'block', marginBottom: 10 }}>
                  Areas of Interest
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {AREAS.map(area => {
                    const selected = form.areas.includes(area);
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => toggle(area)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 50,
                          border: selected ? '2px solid #0D9488' : '2px solid #E5E7EB',
                          background: selected ? '#0D9488' : 'white',
                          color: selected ? 'white' : '#6B7280',
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {area}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message */}
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Tell us about yourself</label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Share your background, motivation, skills, or anything else you'd like us to know..."
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  background: 'linear-gradient(90deg, #0D9488, #1E3A5F)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 50,
                  padding: '14px 32px',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                }}
              >
                Submit Application →
              </button>
            </form>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#6B7280',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid #E5E7EB',
  fontSize: 14,
};
