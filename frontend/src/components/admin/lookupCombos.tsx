import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { fetchJson, fetchPaged } from '../../lib/apiClient';

const DROPDOWN_Z = 2005;

const listBoxStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '100%',
  marginTop: 4,
  maxHeight: 240,
  overflowY: 'auto',
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(30,58,95,0.12)',
  zIndex: DROPDOWN_Z,
};

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function useClickOutside(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open, onClose, ref]);
}

// ── Resident ────────────────────────────────────────────────────────────────

export interface ResidentPickRow {
  residentId: number;
  caseControlNo?: string | null;
  internalCode?: string | null;
}

export function residentDisplayLabel(r: ResidentPickRow): string {
  return r.internalCode?.trim() || r.caseControlNo?.trim() || `Resident #${r.residentId}`;
}

export function ResidentSearchCombobox({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (id: number) => void;
  disabled?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const debouncedText = useDebounced(text, 280);
  const [items, setItems] = useState<ResidentPickRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!value) {
      if (!open) setText('');
      return;
    }
    if (open) return;
    let cancelled = false;
    fetchJson<ResidentPickRow>(`/api/residents/${value}`)
      .then((r) => {
        if (!cancelled) setText(residentDisplayLabel(r));
      })
      .catch(() => {
        if (!cancelled) setText(`Resident #${value}`);
      });
    return () => { cancelled = true; };
  }, [value, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const q = debouncedText.trim();
    fetchPaged<ResidentPickRow>('/api/residents', 1, 25, q ? { search: q } : {})
      .then((page) => {
        if (!cancelled) {
          setItems(page.items);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [open, debouncedText]);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(wrapRef, open, close);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        className="hw-input"
        autoComplete="off"
        disabled={disabled}
        placeholder="Search code, case #, or resident ID…"
        value={open ? text : (text || (value ? `Resident #${value}` : ''))}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => {
          setOpen(true);
          setText('');
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 180);
        }}
      />
      {open && (
        <div style={listBoxStyle} role="listbox">
          {loading && <div className="px-3 py-2 small text-muted">Loading…</div>}
          {!loading && items.length === 0 && (
            <div className="px-3 py-2 small text-muted">No residents match.</div>
          )}
          {!loading &&
            items.map((r) => (
              <button
                key={r.residentId}
                type="button"
                className="dropdown-item text-start border-0 w-100 py-2"
                style={{ fontSize: 13 }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(r.residentId);
                  setText(residentDisplayLabel(r));
                  setOpen(false);
                }}
              >
                <span className="fw-semibold">{residentDisplayLabel(r)}</span>
                <span className="text-muted ms-2">ID {r.residentId}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Social worker (string names from lookup) ───────────────────────────────

export function SocialWorkerCombobox({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(value, 250);
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const q = debounced.trim();
    const url = q
      ? `/api/lookups/social-workers?q=${encodeURIComponent(q)}`
      : '/api/lookups/social-workers';
    fetchJson<string[]>(url)
      .then((list) => {
        if (!cancelled) {
          setItems(list);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [open, debounced]);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(wrapRef, open, close);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        className="hw-input"
        autoComplete="off"
        disabled={disabled}
        placeholder="Search existing names or type a new one…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 180)}
      />
      {open && (items.length > 0 || loading) && (
        <div style={listBoxStyle} role="listbox">
          {loading && <div className="px-3 py-2 small text-muted">Loading…</div>}
          {!loading &&
            items.map((name) => (
              <button
                key={name}
                type="button"
                className="dropdown-item text-start border-0 w-100 py-2"
                style={{ fontSize: 13 }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
              >
                {name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Safehouse ───────────────────────────────────────────────────────────────

interface SafehouseLookupRow {
  safehouseId: number;
  displayName: string;
  safehouseCode: string;
}

function safehouseLabel(s: SafehouseLookupRow): string {
  const d = s.displayName?.trim() || s.safehouseCode?.trim();
  return d || `Safehouse #${s.safehouseId}`;
}

export function SafehouseSearchCombobox({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (id: number) => void;
  disabled?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState<SafehouseLookupRow[]>([]);
  const [text, setText] = useState('');
  const debouncedText = useDebounced(text, 200);

  useEffect(() => {
    let cancelled = false;
    fetchJson<SafehouseLookupRow[]>('/api/lookups/safehouses')
      .then((rows) => { if (!cancelled) setAll(rows); })
      .catch(() => { if (!cancelled) setAll([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!value) {
      if (!open) setText('');
      return;
    }
    const row = all.find((s) => s.safehouseId === value);
    if (row && !open) setText(safehouseLabel(row));
    else if (!row && all.length > 0 && !open) setText(`Safehouse #${value}`);
  }, [value, all, open]);

  const filtered = debouncedText.trim()
    ? all.filter(
        (s) =>
          safehouseLabel(s).toLowerCase().includes(debouncedText.trim().toLowerCase())
          || String(s.safehouseId).includes(debouncedText.trim()),
      )
    : all;

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(wrapRef, open, close);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        className="hw-input"
        autoComplete="off"
        disabled={disabled}
        placeholder="Search safehouse…"
        value={open ? text : (text || (value ? `Safehouse #${value}` : ''))}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => {
          setOpen(true);
          setText('');
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 180)}
      />
      {open && (
        <div style={listBoxStyle} role="listbox">
          {filtered.length === 0 && (
            <div className="px-3 py-2 small text-muted">No safehouses match.</div>
          )}
          {filtered.map((s) => (
            <button
              key={s.safehouseId}
              type="button"
              className="dropdown-item text-start border-0 w-100 py-2"
              style={{ fontSize: 13 }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(s.safehouseId);
                setText(safehouseLabel(s));
                setOpen(false);
              }}
            >
              <span className="fw-semibold">{safehouseLabel(s)}</span>
              <span className="text-muted ms-2">ID {s.safehouseId}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Donation ─────────────────────────────────────────────────────────────────

interface DonationPickRow {
  donationId: number;
  supporter?: { displayName?: string | null; organizationName?: string | null } | null;
}

function donationSummary(d: DonationPickRow): string {
  const s = d.supporter;
  const name = s?.displayName?.trim() || s?.organizationName?.trim();
  return name ? `#${d.donationId} — ${name}` : `Donation #${d.donationId}`;
}

export function DonationSearchCombobox({
  value,
  onChange,
  disabled,
  unallocatedOnly,
}: {
  value: number;
  onChange: (id: number) => void;
  disabled?: boolean;
  unallocatedOnly?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const debouncedText = useDebounced(text, 300);
  const [items, setItems] = useState<DonationPickRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!value) {
      if (!open) setText('');
      return;
    }
    if (open) return;
    let cancelled = false;
    fetchJson<DonationPickRow>(`/api/donations/${value}`)
      .then((d) => {
        if (!cancelled) setText(donationSummary(d));
      })
      .catch(() => {
        if (!cancelled) setText(`Donation #${value}`);
      });
    return () => { cancelled = true; };
  }, [value, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const q = debouncedText.trim();
    const extra: Record<string, string | number | undefined> = {};
    if (q) extra.search = q;
    if (unallocatedOnly) extra.unallocated = 'true';
    fetchPaged<DonationPickRow>('/api/donations', 1, 20, extra)
      .then((page) => {
        if (!cancelled) {
          setItems(page.items);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [open, debouncedText, unallocatedOnly]);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(wrapRef, open, close);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        className="hw-input"
        autoComplete="off"
        disabled={disabled}
        placeholder="Search donor name or donation ID…"
        value={open ? text : (text || (value ? `Donation #${value}` : ''))}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => {
          setOpen(true);
          setText('');
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 180)}
      />
      {open && (
        <div style={listBoxStyle} role="listbox">
          {loading && <div className="px-3 py-2 small text-muted">Loading…</div>}
          {!loading && items.length === 0 && (
            <div className="px-3 py-2 small text-muted">No donations match.</div>
          )}
          {!loading &&
            items.map((d) => (
              <button
                key={d.donationId}
                type="button"
                className="dropdown-item text-start border-0 w-100 py-2"
                style={{ fontSize: 13 }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(d.donationId);
                  setText(donationSummary(d));
                  setOpen(false);
                }}
              >
                {donationSummary(d)}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
