import { useState, useEffect, useRef } from 'react';
import NavBar from '../components/hw/NavBar';
import Footer from '../components/hw/Footer';
import { useAuth } from '../context/AuthContext';
import { fetchJson, postJson } from '../lib/apiClient';

interface Story {
  storyId: number;
  authorEmail: string | null;
  authorName: string | null;
  authorRole: string | null;
  content: string;
  createdAt: string;
  likesCount: number;
}

const ROLE_COLOR: Record<string, { bg: string; color: string }> = {
  Admin:     { bg: '#EDE9FE', color: '#6B21A8' },
  Staff:     { bg: '#DBEAFE', color: '#1D4ED8' },
  Donor:     { bg: '#D1FAE5', color: '#065F46' },
  Volunteer: { bg: '#FEF3C7', color: '#92400E' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function initials(name: string | null, email: string | null) {
  const src = name || email || '?';
  return src.slice(0, 2).toUpperCase();
}

function avatarColor(str: string) {
  const colors = ['#0D9488', '#1E3A5F', '#6B21A8', '#D97706', '#DC2626', '#059669'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const MAX_CHARS = 500;

export default function StoriesPage() {
  const { isAuthenticated, authSession } = useAuth();
  const [stories, setStories]     = useState<Story[]>([]);
  const [loading, setLoading]     = useState(true);
  const [draft, setDraft]         = useState('');
  const [posting, setPosting]     = useState(false);
  const [likedIds, setLikedIds]   = useState<Set<number>>(new Set());
  const [error, setError]         = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchJson<Story[]>('/api/stories');
      setStories(data);
    } catch {
      // silently fail — stories are optional
    } finally {
      setLoading(false);
    }
  }

  async function post() {
    if (!draft.trim() || draft.length > MAX_CHARS) return;
    setPosting(true);
    setError('');
    try {
      const displayName = authSession.email?.split('@')[0] ?? 'Anonymous';
      const newStory = await postJson<Story>('/api/stories', {
        content: draft.trim(),
        authorName: displayName,
      });
      setStories(prev => [newStory, ...prev]);
      setDraft('');
    } catch (e: any) {
      setError(e.message ?? 'Could not post. Please try again.');
    } finally {
      setPosting(false);
    }
  }

  async function like(id: number) {
    if (likedIds.has(id)) return;
    setLikedIds(prev => new Set(prev).add(id));
    try {
      const res = await postJson<{ likes: number }>(`/api/stories/${id}/like`, {});
      setStories(prev => prev.map(s => s.storyId === id ? { ...s, likesCount: res.likes } : s));
    } catch {
      setLikedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  const remaining = MAX_CHARS - draft.length;

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <NavBar />

      {/* Top banner */}
      <div style={{
        background: '#1E3A5F',
        paddingTop: '5rem',
        paddingBottom: '1.5rem',
        textAlign: 'center',
        color: 'white',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800,
          fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', margin: '0 0 6px' }}>
          Community Stories
        </h1>
        <p style={{ margin: 0, opacity: 0.7, fontSize: 14 }}>
          Donors · Volunteers · Residents — share your voice
        </p>
      </div>

      <div style={{ maxWidth: 620, margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>

        {/* Compose box */}
        {isAuthenticated ? (
          <div style={{
            background: 'white', borderRadius: 16,
            boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
            marginBottom: 20, overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 16px 0', display: 'flex', gap: 12 }}>
              {/* Avatar */}
              <div style={{
                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                background: avatarColor(authSession.email ?? ''),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 800, fontSize: 14,
              }}>
                {initials(null, authSession.email)}
              </div>

              <textarea
                ref={textareaRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Share your story, experience or message of hope…"
                rows={3}
                style={{
                  flex: 1, border: 'none', outline: 'none', resize: 'none',
                  fontSize: 15, color: '#1E3A5F', lineHeight: 1.55,
                  fontFamily: 'inherit', background: 'transparent',
                  padding: '4px 0',
                }}
              />
            </div>

            {/* Compose footer */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 16px 14px',
              borderTop: draft ? '1px solid #f0f0f0' : 'none',
            }}>
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: remaining < 50 ? (remaining < 0 ? '#DC2626' : '#D97706') : '#9CA3AF',
              }}>
                {draft ? `${remaining} characters left` : ''}
              </span>
              <button
                onClick={post}
                disabled={!draft.trim() || remaining < 0 || posting}
                style={{
                  background: (!draft.trim() || remaining < 0 || posting) ? '#E5E7EB' : '#1E3A5F',
                  color: (!draft.trim() || remaining < 0 || posting) ? '#9CA3AF' : 'white',
                  border: 'none', borderRadius: 50,
                  padding: '8px 22px', fontWeight: 700, fontSize: 14,
                  cursor: (!draft.trim() || remaining < 0 || posting) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {posting ? <><span className="spinner-border spinner-border-sm" /> Posting…</> : 'Post'}
              </button>
            </div>

            {error && (
              <p style={{ margin: '0 16px 12px', color: '#DC2626', fontSize: 12, fontWeight: 600 }}>{error}</p>
            )}
          </div>
        ) : (
          <div style={{
            background: 'white', borderRadius: 16, padding: '20px',
            textAlign: 'center', marginBottom: 20,
            boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
          }}>
            <p style={{ margin: '0 0 12px', color: '#6B7280', fontSize: 14 }}>
              <strong>Sign in</strong> to share your own story with the community.
            </p>
            <a href="/login" style={{
              background: '#1E3A5F', color: 'white', borderRadius: 50,
              padding: '9px 24px', fontWeight: 700, fontSize: 13,
              textDecoration: 'none', display: 'inline-block',
            }}>
              Sign In
            </a>
          </div>
        )}

        {/* Feed */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9CA3AF' }}>
            <div className="spinner-border spinner-border-sm me-2" role="status" />
            Loading stories…
          </div>
        ) : stories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: '#9CA3AF' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🕊️</div>
            <p style={{ fontWeight: 600, margin: 0 }}>No stories yet.</p>
            <p style={{ margin: '4px 0 0', fontSize: 13 }}>Be the first to share!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stories.map(s => {
              const roleStyle = ROLE_COLOR[s.authorRole ?? ''] ?? { bg: '#F3F4F6', color: '#374151' };
              const liked = likedIds.has(s.storyId);
              const avatarBg = avatarColor(s.authorEmail ?? s.storyId.toString());

              return (
                <div key={s.storyId} style={{
                  background: 'white', borderRadius: 16,
                  padding: '16px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
                  transition: 'box-shadow 0.2s',
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: 10 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                      background: avatarBg, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 14,
                    }}>
                      {initials(s.authorName, s.authorEmail)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#1E3A5F', fontSize: 14 }}>
                          {s.authorName ?? s.authorEmail?.split('@')[0] ?? 'Anonymous'}
                        </span>
                        {s.authorRole && (
                          <span style={{
                            background: roleStyle.bg, color: roleStyle.color,
                            borderRadius: 20, padding: '1px 9px',
                            fontSize: 10, fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}>
                            {s.authorRole}
                          </span>
                        )}
                        <span style={{ color: '#9CA3AF', fontSize: 13 }}>·</span>
                        <span style={{ color: '#9CA3AF', fontSize: 13 }}>{timeAgo(s.createdAt)}</span>
                      </div>
                      {s.authorEmail && (
                        <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>
                          @{s.authorEmail.split('@')[0]}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <p style={{
                    margin: '0 0 12px', fontSize: 15, color: '#1F2937',
                    lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {s.content}
                  </p>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 20, paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
                    <button
                      onClick={() => like(s.storyId)}
                      disabled={liked}
                      style={{
                        background: 'none', border: 'none', cursor: liked ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                        color: liked ? '#DC2626' : '#9CA3AF', fontSize: 13, fontWeight: 600,
                        padding: '4px 0', transition: 'color 0.15s',
                      }}
                    >
                      <i className={liked ? 'bi bi-heart-fill' : 'bi bi-heart'} style={{ fontSize: 15 }} />
                      {s.likesCount > 0 && s.likesCount}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
