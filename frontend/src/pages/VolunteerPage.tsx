import { useState } from 'react';
import { Link } from 'react-router-dom';
import NavBar from '../components/hw/NavBar';
import HealingWingsLogo from '../components/hw/HealingWingsLogo';
import Footer from '../components/hw/Footer';
import { API_BASE_URL } from '../lib/apiBaseUrl';

const RELATIONSHIP_TYPES = ['Individual', 'Organization', 'Faith-Based / Church', 'Corporate', 'Family', 'Anonymous'];
const ACQUISITION_CHANNELS = ['Social Media', 'Word of Mouth', 'Website', 'Church / Faith Community', 'Event', 'Other'];

export default function VolunteerPage() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    organizationName: '',
    relationshipType: '',
    region: '',
    country: '',
    acquisitionChannel: '',
  });

  const [submitted, setSubmitted]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [emailError, setEmailError]     = useState('');
  const [submitError, setSubmitError]   = useState('');

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  /** Check if email already exists in supporters table */
  async function checkEmail() {
    if (!form.email) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/supporters/check-email?email=${encodeURIComponent(form.email)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json() as { exists: boolean };
        if (data.exists) {
          setEmailError('⚠️ You are already registered as a supporter on our site.');
        } else {
          setEmailError('');
        }
      }
    } catch {
      // silently ignore network errors on blur
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (emailError) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/supporters/volunteer-apply`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName:         form.firstName,
          lastName:          form.lastName,
          email:             form.email,
          phone:             form.phone || null,
          organizationName:  form.organizationName || null,
          relationshipType:  form.relationshipType || null,
          region:            form.region || null,
          country:           form.country || null,
          acquisitionChannel: form.acquisitionChannel || null,
        }),
      });

      if (res.status === 409) {
        setEmailError('⚠️ You are already registered as a supporter on our site.');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        setSubmitError(data.message ?? 'Something went wrong. Please try again.');
        return;
      }
      setSubmitted(true);
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fb' }}>
      <NavBar />

      {/* Hero banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1E3A5F 0%, #0D9488 100%)',
        paddingTop: '7rem', paddingBottom: '3.5rem',
        textAlign: 'center', color: 'white',
      }}>
        <HealingWingsLogo size={52} style={{ marginBottom: 16 }} />
        <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800,
          fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', margin: '0 0 12px' }}>
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
          /* Thank-you card */
          <div style={{ background: 'white', borderRadius: 20, padding: '3rem 2rem',
            textAlign: 'center', boxShadow: '0 8px 40px rgba(30,58,95,0.1)' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🕊️</div>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800,
              color: '#1E3A5F', marginBottom: 8 }}>
              Thank you, {form.firstName}!
            </h2>
            <p style={{ color: '#6B7280', lineHeight: 1.7, maxWidth: 440, margin: '0 auto 24px' }}>
              We've received your application and an admin will review it shortly.
              We'll be in touch at <strong>{form.email}</strong>.
            </p>
            <Link to="/" style={{
              display: 'inline-block', background: '#0D9488', color: 'white',
              borderRadius: 50, padding: '12px 32px', fontWeight: 700,
              fontSize: 14, textDecoration: 'none',
            }}>
              Back to Home
            </Link>
          </div>
        ) : (
          /* Form card */
          <div style={{ background: 'white', borderRadius: 20,
            boxShadow: '0 8px 40px rgba(30,58,95,0.08)', overflow: 'hidden' }}>
            <div style={{ height: 4, background: 'linear-gradient(90deg, #0D9488, #1E3A5F)' }} />

            <form onSubmit={handleSubmit} style={{ padding: '2rem 2rem 2.5rem' }}>
              <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800,
                color: '#1E3A5F', fontSize: '1.35rem', marginBottom: 4 }}>
                Volunteer Application
              </h2>
              <p style={{ color: '#9CA3AF', fontSize: 13, marginBottom: '1.75rem' }}>
                Fill in the form below and our team will review your submission within 3–5 business days.
              </p>

              {/* Name row */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={lbl}>First Name *</label>
                  <input required type="text" className="form-control" placeholder="Maria"
                    value={form.firstName} onChange={e => set('firstName', e.target.value)} style={inp} />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={lbl}>Last Name *</label>
                  <input required type="text" className="form-control" placeholder="Santos"
                    value={form.lastName} onChange={e => set('lastName', e.target.value)} style={inp} />
                </div>
              </div>

              {/* Email */}
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Email *</label>
                <input
                  required type="email" className="form-control"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => { set('email', e.target.value); setEmailError(''); }}
                  onBlur={checkEmail}
                  style={{ ...inp, borderColor: emailError ? '#DC2626' : undefined }}
                />
                {emailError && (
                  <p style={{ color: '#DC2626', fontSize: 12, marginTop: 5, marginBottom: 0, fontWeight: 600 }}>
                    {emailError}
                  </p>
                )}
              </div>

              {/* Phone + Organization */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={lbl}>Phone</label>
                  <input type="tel" className="form-control" placeholder="+1 (555) 000-0000"
                    value={form.phone} onChange={e => set('phone', e.target.value)} style={inp} />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={lbl}>Organization Name</label>
                  <input type="text" className="form-control" placeholder="(if applicable)"
                    value={form.organizationName} onChange={e => set('organizationName', e.target.value)} style={inp} />
                </div>
              </div>

              {/* Relationship type + Acquisition channel */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={lbl}>Relationship Type</label>
                  <select className="form-select" value={form.relationshipType}
                    onChange={e => set('relationshipType', e.target.value)} style={inp}>
                    <option value="">Select...</option>
                    {RELATIONSHIP_TYPES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={lbl}>How did you hear about us?</label>
                  <select className="form-select" value={form.acquisitionChannel}
                    onChange={e => set('acquisitionChannel', e.target.value)} style={inp}>
                    <option value="">Select...</option>
                    {ACQUISITION_CHANNELS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Region + Country */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={lbl}>Region / State</label>
                  <input type="text" className="form-control" placeholder="e.g. Cebu"
                    value={form.region} onChange={e => set('region', e.target.value)} style={inp} />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={lbl}>Country</label>
                  <input type="text" className="form-control" placeholder="Philippines"
                    value={form.country} onChange={e => set('country', e.target.value)} style={inp} />
                </div>
              </div>

              {submitError && (
                <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10,
                  padding: '10px 14px', marginBottom: 16, color: '#DC2626', fontSize: 13, fontWeight: 600 }}>
                  {submitError}
                </div>
              )}

              <button type="submit" disabled={submitting || !!emailError} style={{
                width: '100%',
                background: (submitting || emailError)
                  ? '#9CA3AF'
                  : 'linear-gradient(90deg, #0D9488, #1E3A5F)',
                color: 'white', border: 'none', borderRadius: 50,
                padding: '14px 32px', fontWeight: 700, fontSize: 15,
                cursor: (submitting || emailError) ? 'not-allowed' : 'pointer',
                letterSpacing: '0.02em', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 10,
              }}>
                {submitting ? (
                  <><span className="spinner-border spinner-border-sm" /> Submitting...</>
                ) : 'Submit Application →'}
              </button>
            </form>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
};
const inp: React.CSSProperties = {
  borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 14,
};
