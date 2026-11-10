"use client";
import { useCallback, useEffect, useState } from 'react';
import { call } from './client';
import type { Pulse } from './pulse';

const KEY = 'compass-pulse-v2';

/**
 * Stale-while-revalidate: show the last numbers at once (from this device), fetch fresh ones behind them.
 * The first paint is always "loading" so server and browser agree; the saved copy is read after mount.
 */
export function usePulse() {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (fresh: boolean) => {
    setBusy(true); setError(null);
    try {
      const p = await call<Pulse>(`/api/pulse${fresh ? '?fresh=1' : ''}`, 'GET');
      setPulse(p);
      try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: just no instant copy next time */ }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load.'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => {
    try { const saved = localStorage.getItem(KEY); if (saved) setPulse(JSON.parse(saved) as Pulse); } catch { /* ignore a bad copy */ }
    void load(false);
  }, [load]);

  return { pulse, error, busy, reload: () => load(true) };
}
