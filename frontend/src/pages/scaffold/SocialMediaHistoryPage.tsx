import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { deleteJson, fetchPaged, type PagedResult } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';

// ── Types (camelCase JSON from ASP.NET Core) ─────────────────────────────────

interface SocialMediaPost {
  postId: number;
  platform?: string | null;
  platformPostId?: string | null;
  postUrl?: string | null;
  createdAt?: string | null;
  dayOfWeek?: string | null;
  postHour?: number | null;
  postType?: string | null;
  mediaType?: string | null;
  caption?: string | null;
  hashtags?: string | null;
  contentTopic?: string | null;
  sentimentTone?: string | null;
  campaignName?: string | null;
  impressions?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  engagementRate?: number | null;
  donationReferrals?: number | null;
}

const PLATFORMS = [
  'Facebook', 'Instagram', 'Twitter', 'TikTok', 'LinkedIn', 'YouTube', 'WhatsApp',
];

const PLATFORM_STYLE: Record<string, { bg: string; text: string }> = {
  Facebook:  { bg: '#DBEAFE', text: '#1E40AF' },
  Instagram: { bg: '#FCE7F3', text: '#BE185D' },
  Twitter:   { bg: '#E0E7FF', text: '#3730A3' },
  TikTok:    { bg: '#F1F5F9', text: '#0F172A' },
  LinkedIn:  { bg: '#DBEAFE', text: '#0C4A6E' },
  YouTube:   { bg: '#FEE2E2', text: '#991B1B' },
  WhatsApp:  { bg: '#DCFCE7', text: '#166534' },
};

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span style={{
      display: 'inline-block', background: bg, color: text,
      borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
    }}>{label}</span>
  );
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function KPIStrip({ items, totalInDb }: { items: SocialMediaPost[]; totalInDb: number }) {
  const likes = items.reduce((s, p) => s + (p.likes ?? 0), 0);
  const reach = items.reduce((s, p) => s + (p.reach ?? 0), 0);
  const comments = items.reduce((s, p) => s + (p.comments ?? 0), 0);
  const avgEng = items.length
    ? (items.reduce((s, p) => s + Number(p.engagementRate ?? 0), 0) / items.length * 100)
    : 0;

  const kpis = [
    { label: 'Posts (this page)', value: String(items.length), icon: '📱', color: '#1E3A5F' },
    { label: 'Total in database', value: String(totalInDb), icon: '📊', color: '#6B21A8' },
    { label: 'Likes (page)', value: likes.toLocaleString(), icon: '❤️', color: '#DC2626' },
    { label: 'Reach (page)', value: reach.toLocaleString(), icon: '👁️', color: '#0D9488' },
    { label: 'Comments (page)', value: comments.toLocaleString(), icon: '💬', color: '#1E40AF' },
    { label: 'Avg engagement %', value: `${avgEng.toFixed(2)}%`, icon: '📈', color: '#166534' },
  ];

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
      {kpis.map(k => (
        <div key={k.label} style={{
          flex: '1 1 130px', background: '#fff', borderRadius: 12,
          padding: '14px 16px', border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(30,58,95,0.06)',
        }}>
          <div style={{ fontSize: 18, marginBottom: 4 }}>{k.icon}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</div>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>{k.label}</div>
        </div>
      ))}
    </div>
  );
}

type SortCol = 'createdAt' | 'platform' | 'postType' | 'likes' | 'reach' | 'comments' | 'engagementRate';

function sortArrow(col: SortCol, sortCol: SortCol | null, sortDir: 'asc' | 'desc'): string {
  if (col !== sortCol) return ' ↕';
  return sortDir === 'asc' ? ' ▲' : ' ▼';
}

function compareVals(a: string | number | null | undefined, b: string | number | null | undefined, dir: 'asc' | 'desc'): number {
  const av = a ?? '';
  const bv = b ?? '';
  if (av < bv) return dir === 'asc' ? -1 : 1;
  if (av > bv) return dir === 'asc' ? 1 : -1;
  return 0;
}

const thStyle: React.CSSProperties = {
  padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#475569',
  fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
};
const tdStyle: React.CSSProperties = { padding: '12px 14px', fontSize: 13, verticalAlign: 'top' };
const delBtn: React.CSSProperties = {
  background: 'none', border: '1px solid #FCA5A5', borderRadius: 6,
  color: '#DC2626', fontSize: 11, fontWeight: 600, padding: '3px 10px', cursor: 'pointer',
};
const navBtn = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? '#F1F5F9' : '#fff',
  border: '1px solid #CBD5E1', borderRadius: 8, padding: '6px 16px',
  fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
  color: disabled ? '#94A3B8' : '#1E3A5F',
});

export default function SocialMediaHistoryPage() {
  const { authSession } = useAuth();
  const canDelete = authSession.roles.includes('Admin') || authSession.roles.includes('Staff');

  const [page, setPage] = useState(1);
  const [platform, setPlatform] = useState('');
  const [campaignInput, setCampaignInput] = useState('');
  const [appliedCampaign, setAppliedCampaign] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<PagedResult<SocialMediaPost> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [sortCol, setSortCol] = useState<SortCol | null>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [deleteTarget, setDeleteTarget] = useState<SocialMediaPost | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const extra: Record<string, string | undefined> = {};
    if (platform) extra.platform = platform;
    if (appliedCampaign.trim()) extra.campaignName = appliedCampaign.trim();

    fetchPaged<SocialMediaPost>('/api/social-media-posts', page, 20, extra)
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, platform, appliedCampaign, reloadToken]);

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else {
      setSortCol(col);
      setSortDir(col === 'createdAt' ? 'desc' : 'asc');
    }
  }

  const displayItems = useMemo(() => {
    let items = data?.items ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      items = items.filter((p) => {
        const cap = (p.caption ?? '').toLowerCase();
        const tags = (p.hashtags ?? '').toLowerCase();
        const pt = (p.postType ?? '').toLowerCase();
        const pl = (p.platform ?? '').toLowerCase();
        return cap.includes(q) || tags.includes(q) || pt.includes(q) || pl.includes(q);
      });
    }
    if (!sortCol) return items;
    return [...items].sort((a, b) => {
      switch (sortCol) {
        case 'createdAt':
          return compareVals(a.createdAt, b.createdAt, sortDir);
        case 'platform':
          return compareVals(a.platform, b.platform, sortDir);
        case 'postType':
          return compareVals(a.postType, b.postType, sortDir);
        case 'likes':
          return compareVals(a.likes ?? 0, b.likes ?? 0, sortDir);
        case 'reach':
          return compareVals(a.reach ?? 0, b.reach ?? 0, sortDir);
        case 'comments':
          return compareVals(a.comments ?? 0, b.comments ?? 0, sortDir);
        case 'engagementRate':
          return compareVals(Number(a.engagementRate ?? 0), Number(b.engagementRate ?? 0), sortDir);
        default:
          return 0;
      }
    });
  }, [data?.items, search, sortCol, sortDir]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteJson(`/api/social-media-posts/${deleteTarget.postId}`);
      setDeleteTarget(null);
      setReloadToken((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', padding: '32px 0' }}>
      <div className="container">

        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0D9488', letterSpacing: 2, textTransform: 'uppercase' }}>Outreach &amp; Communication</span>
            <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 28, color: '#1E3A5F', marginBottom: 4 }}>
              Social Media — Post History
            </h1>
            <p style={{ color: '#64748B', fontSize: 14, marginBottom: 0 }}>
              Paginated posts from your database with engagement metrics. Filter by platform or campaign; search narrows the current page.
            </p>
          </div>
          <Link
            to="/admin/social-media/suggest"
            style={{
              background: '#1E3A5F', color: '#fff', textDecoration: 'none', borderRadius: 8,
              padding: '10px 20px', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap',
            }}
          >
            Suggest next post →
          </Link>
        </div>

        {data && <KPIStrip items={data.items} totalInDb={data.totalCount} />}

        <div style={{
          background: '#fff', borderRadius: 12, padding: '16px 20px',
          border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(30,58,95,0.05)',
          marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
        }}>
          <input
            type="search"
            placeholder="Search caption, hashtags, type on this page…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: '1 1 220px', padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
          />
          <input
            type="text"
            placeholder="Campaign name (exact)"
            value={campaignInput}
            onChange={e => setCampaignInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (setPage(1), setAppliedCampaign(campaignInput))}
            style={{ flex: '0 1 200px', padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
          />
          <button
            type="button"
            onClick={() => { setPage(1); setAppliedCampaign(campaignInput); }}
            style={{
              background: '#0D9488', color: '#fff', border: 'none', borderRadius: 8,
              padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            Apply campaign
          </button>
          <button
            type="button"
            onClick={() => { setCampaignInput(''); setAppliedCampaign(''); setPage(1); }}
            style={{
              background: 'none', border: '1px solid #CBD5E1', borderRadius: 8,
              padding: '8px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#64748B',
            }}
          >
            Clear campaign
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => { setPlatform(''); setPage(1); }}
            style={{
              border: 'none', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: platform === '' ? '#1E3A5F' : '#E2E8F0',
              color: platform === '' ? '#fff' : '#475569',
            }}
          >
            All platforms
          </button>
          {PLATFORMS.map((p) => {
            const cfg = PLATFORM_STYLE[p] ?? { bg: '#F1F5F9', text: '#475569' };
            const active = platform === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => { setPlatform(p); setPage(1); }}
                style={{
                  border: 'none', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: active ? cfg.bg : '#E2E8F0',
                  color: active ? cfg.text : '#475569',
                  transition: 'all 0.15s',
                }}
              >
                {p}
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{ borderRadius: 8, padding: '10px 16px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{
          background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
          boxShadow: '0 2px 12px rgba(30,58,95,0.06)', overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
              <p style={{ fontWeight: 600 }}>Loading posts…</p>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
              <p style={{ fontWeight: 600 }}>No posts match your filters.</p>
            </div>
          ) : displayItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
              <p style={{ fontWeight: 600 }}>No rows match your search on this page.</p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                      <th style={thStyle} onClick={() => handleSort('platform')}>Platform{sortArrow('platform', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('createdAt')}>Posted{sortArrow('createdAt', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('postType')}>Type{sortArrow('postType', sortCol, sortDir)}</th>
                      <th style={{ ...thStyle, cursor: 'default', minWidth: 200 }}>Caption</th>
                      <th style={thStyle} onClick={() => handleSort('reach')}>Reach{sortArrow('reach', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('likes')}>Likes{sortArrow('likes', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('comments')}>Comments{sortArrow('comments', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('engagementRate')}>Eng. % {sortArrow('engagementRate', sortCol, sortDir)}</th>
                      {canDelete && <th style={{ ...thStyle, cursor: 'default' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {displayItems.map((row, i) => {
                      const ps = PLATFORM_STYLE[row.platform ?? ''] ?? { bg: '#F1F5F9', text: '#64748B' };
                      const rawEng = Number(row.engagementRate ?? NaN);
                      const eng = Number.isFinite(rawEng)
                        ? (rawEng > 1 ? rawEng.toFixed(2) : (rawEng * 100).toFixed(2))
                        : '—';
                      const cap = row.caption ?? '';
                      const capShort = cap.length > 120 ? `${cap.slice(0, 120)}…` : cap;
                      return (
                        <tr key={row.postId} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                          <td style={tdStyle}>
                            <Badge label={row.platform ?? '—'} bg={ps.bg} text={ps.text} />
                          </td>
                          <td style={{ ...tdStyle, color: '#64748B', whiteSpace: 'nowrap' }}>{fmtDateTime(row.createdAt)}</td>
                          <td style={{ ...tdStyle, color: '#475569' }}>{row.postType ?? '—'}</td>
                          <td style={{ ...tdStyle, color: '#475569', maxWidth: 280 }}>
                            {row.postUrl ? (
                              <a href={row.postUrl} target="_blank" rel="noreferrer" style={{ color: '#6B21A8', fontWeight: 600 }}>
                                {capShort || '(link)'}
                              </a>
                            ) : (
                              <span title={cap}>{capShort || '—'}</span>
                            )}
                          </td>
                          <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{row.reach?.toLocaleString() ?? '—'}</td>
                          <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{row.likes?.toLocaleString() ?? '—'}</td>
                          <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{row.comments?.toLocaleString() ?? '—'}</td>
                          <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{eng}</td>
                          {canDelete && (
                            <td style={tdStyle}>
                              <button type="button" style={delBtn} onClick={() => setDeleteTarget(row)}>Delete</button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {data && (
                <div style={{
                  padding: '14px 20px', borderTop: '1px solid #E2E8F0',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
                }}>
                  <span style={{ fontSize: 12, color: '#64748B' }}>
                    Page {data.page} of {data.totalPages || 1} · {data.totalCount} total posts
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))} style={navBtn(page <= 1 || loading)}>← Prev</button>
                    <button type="button" disabled={loading || page >= (data.totalPages || 1)} onClick={() => setPage(p => p + 1)} style={navBtn(loading || page >= (data.totalPages || 1))}>Next →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <DeleteConfirmModal
        show={deleteTarget !== null}
        itemLabel={deleteTarget ? `post ${deleteTarget.postId} (${deleteTarget.platform ?? 'unknown'})` : ''}
        onCancel={() => { if (!deleteBusy) setDeleteTarget(null); }}
        onConfirm={() => { if (!deleteBusy) void confirmDelete(); }}
      />
    </div>
  );
}
