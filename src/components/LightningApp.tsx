'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

import type { Bounds, Flash, FlashesResponse } from '@/lib/types';
import type { FocusRequest, PlaybackMode } from './LightningGlobe';
import styles from './LightningApp.module.css';
import DateInput from './DateInput';
import TimeInput from './TimeInput';

// Cesium touches `window` on import, so the globe can never render on the
// server. Everything else on this page is happy to.
const LightningGlobe = dynamic(() => import('./LightningGlobe'), {
  ssr: false,
  loading: () => <div className={styles.globeLoading}>Loading globe…</div>,
});

/** Stable empty array: `?? []` would allocate per render and break memo deps. */
const NO_FLASHES: Flash[] = [];

const SPEEDS = [60, 150, 300, 600, 1200];
const TRAILS = [30, 120, 300, 600];

/** "2026-08-01T00:00:03.447777Z" -> "00:00:03.447" */
function clockTime(iso: string): string {
  return iso.slice(11, 23);
}

function formatEnergy(j: number | null): string {
  return j === null ? '—' : j.toExponential(2);
}

export const formatToDateString = (dateTimeString: string) =>
  new Date(dateTimeString).toLocaleDateString('fr-CA', { timeZone: 'UTC' });

export type DateValue = string;
export type DateInputState = { start: DateValue; end: DateValue };
export type TimeValue = string;
export type TimeInputState = { start: TimeValue; end: TimeValue };

export default function LightningApp() {
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [dateInputState, setDateInputState] = useState<DateInputState>({
    start: '',
    end: '',
  });
  const [timeInputState, setTimeInputState] = useState({ start: '00:00', end: '23:59' });
  const [applied, setApplied] = useState<{ start: string; end: string } | null>(null);

  /**
   * The last completed fetch, tagged with the window it belongs to.
   *
   * Holding the result this way lets `loading` and `flashes` be derived rather
   * than stored, which keeps every setState inside an async continuation --
   * synchronously setting state in an effect body triggers cascading renders.
   */
  const [result, setResult] = useState<{
    key: string;
    flashes: Flash[];
    truncated: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<PlaybackMode>('all');
  const [speed, setSpeed] = useState(300);
  const [trailSeconds, setTrailSeconds] = useState(300);

  const [selected, setSelected] = useState<Flash | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const nonce = useRef(0);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const keyOf = (f: Flash) => `${f.flash_id}@${f.t}`;

  const setFormattedDateState = ({ start, end }: { start: string; end: string }): void =>
    setDateInputState({
      start: formatToDateString(start),
      end: formatToDateString(end),
    });

  // Discover the window the data actually covers, and open on it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/bounds');
        if (!response.ok) throw new Error(`bounds returned ${response.status}`);
        const data: Bounds = await response.json();
        if (cancelled) return;
        setBounds(data);
        if (data.earliest && data.latest) {
          // `end` is exclusive, so nudge past the final flash to include it.
          const end = new Date(Date.parse(data.latest) + 1000).toISOString();
          console.log({ end });
          setFormattedDateState({ start: data.earliest, end: data.latest });
          //  will need a seperate time state and set here
          setApplied({ start: data.earliest, end });
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const windowKey = applied ? `${applied.start}|${applied.end}` : null;

  // Fetch flashes for the applied window.
  useEffect(() => {
    if (!applied || !windowKey) return;
    let cancelled = false;

    (async () => {
      try {
        const query = new URLSearchParams({ start: applied.start, end: applied.end });
        const response = await fetch(`/api/flashes?${query}`);
        const data: FlashesResponse & { error?: string } = await response.json();
        if (!response.ok) throw new Error(data.error ?? `flashes returned ${response.status}`);
        if (cancelled) return;
        setResult({ key: windowKey, flashes: data.flashes, truncated: Boolean(data.truncated) });
        setError(null);
        setSelected(null);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applied, windowKey]);

  const fresh = result?.key === windowKey ? result : null;
  const flashes = fresh?.flashes ?? NO_FLASHES;
  const truncated = fresh?.truncated ?? false;
  const loading = error === null && (bounds === null || (windowKey !== null && fresh === null));

  const apply = useCallback(() => {
    if (Number.isNaN(Date.parse(dateInputState.start)) || Number.isNaN(Date.parse(dateInputState.end))) {
      setError('Both times must be valid ISO-8601, e.g. 2026-08-01T00:00:00Z');
      return;
    }
    if (Date.parse(dateInputState.end) <= Date.parse(dateInputState.start)) {
      setError('End must be after start.');
      return;
    }
    setError(null);
    setApplied({ start: dateInputState.start, end: dateInputState.end });
  }, [dateInputState.start, dateInputState.end]);

  const resetWindow = useCallback(() => {
    if (!bounds?.earliest || !bounds.latest) return;
    const end = new Date(Date.parse(bounds.latest) + 1000).toISOString();
    setFormattedDateState({ start: bounds.earliest, end: bounds.latest });
    // will need a time set here
    setApplied({ start: bounds.earliest, end });
  }, [bounds]);

  const focusFlash = useCallback((flash: Flash) => {
    setSelected(flash);
    nonce.current += 1;
    setFocus({ flash, nonce: nonce.current });
  }, []);

  // A pick on the globe highlights the row rather than moving the camera.
  const handleGlobeSelect = useCallback((flash: Flash | null) => {
    setSelected(flash);
    if (flash) {
      rowRefs.current
        .get(`${flash.flash_id}@${flash.t}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, []);

  const summary = useMemo(() => {
    if (!flashes.length) return null;
    const energies = flashes.map((f) => f.energy_j ?? 0).filter(Boolean);
    return {
      first: flashes[0].t,
      last: flashes[flashes.length - 1].t,
      peak: energies.length ? Math.max(...energies) : null,
    };
  }, [flashes]);

  return (
    <div className={styles.shell}>
      <aside className={styles.panel}>
        <header className={styles.header}>
          <h1>GOES-19 Lightning Flashes</h1>
          <h2>GLM flash detections over the Northern Rockies</h2>
        </header>

        <section className={styles.section}>
          <h2>Time window (UTC)</h2>
          <DateInput
            value={dateInputState}
            onChange={setFormattedDateState}
            min={bounds?.earliest ? formatToDateString(bounds.earliest) : ''}
            max={bounds?.latest ? formatToDateString(bounds.latest) : ''}
          />
          <TimeInput value={timeInputState} onChange={setTimeInputState} />
          <div className={styles.buttonRow}>
            <button type="button" className={styles.primary} onClick={apply} disabled={loading}>
              Apply
            </button>
            <button type="button" className={styles.button} onClick={resetWindow} disabled={!bounds}>
              Full extent
            </button>
          </div>
          {bounds?.earliest && (
            <p className={styles.hint}>
              Dataset holds {bounds.count} flashes, {clockTime(bounds.earliest)} – {clockTime(bounds.latest!)}{' '}
              on {bounds.earliest.slice(0, 10)}.
            </p>
          )}
        </section>

        <section className={styles.section}>
          <h2>Display</h2>
          <div className={styles.buttonRow}>
            <button
              type="button"
              className={mode === 'all' ? styles.toggleActive : styles.toggle}
              onClick={() => setMode('all')}
            >
              All at once
            </button>
            <button
              type="button"
              className={mode === 'playback' ? styles.toggleActive : styles.toggle}
              onClick={() => setMode('playback')}
            >
              Playback
            </button>
          </div>

          {mode === 'playback' && (
            <>
              <label className={styles.field}>
                <span>Speed</span>
                <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                  {SPEEDS.map((s) => (
                    <option key={s} value={s}>
                      {s}× real time
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Flash lingers</span>
                <select value={trailSeconds} onChange={(e) => setTrailSeconds(Number(e.target.value))}>
                  {TRAILS.map((s) => (
                    <option key={s} value={s}>
                      {s}s of data time
                    </option>
                  ))}
                </select>
              </label>
              <p className={styles.hint}>
                Use the dial and timeline at the bottom of the globe to scrub, pause and change direction.
              </p>
            </>
          )}
        </section>

        <section className={styles.sectionGrow}>
          <h2>
            Flashes <span className={styles.count}>{loading ? '…' : flashes.length}</span>
          </h2>
          {error && <p className={styles.error}>{error}</p>}
          {truncated && <p className={styles.warning}>Result hit the row limit — narrow the window.</p>}
          {summary && (
            <p className={styles.hint}>
              {clockTime(summary.first)} – {clockTime(summary.last)}
              {summary.peak ? `, peak ${summary.peak.toExponential(2)} J` : ''}
            </p>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Lat</th>
                  <th>Lon</th>
                  <th>Energy J</th>
                  <th>km²</th>
                </tr>
              </thead>
              <tbody>
                {flashes.map((flash) => {
                  const key = keyOf(flash);
                  const isSelected = selected !== null && keyOf(selected) === key;
                  return (
                    <tr
                      key={key}
                      ref={(el) => {
                        if (el) rowRefs.current.set(key, el);
                        else rowRefs.current.delete(key);
                      }}
                      className={isSelected ? styles.rowSelected : undefined}
                      onClick={() => focusFlash(flash)}
                    >
                      <td>{clockTime(flash.t)}</td>
                      <td>{flash.lat.toFixed(3)}</td>
                      <td>{flash.lon.toFixed(3)}</td>
                      <td>{formatEnergy(flash.energy_j)}</td>
                      <td>{flash.area_km2?.toFixed(0) ?? '—'}</td>
                    </tr>
                  );
                })}
                {!loading && !flashes.length && !error && (
                  <tr>
                    <td colSpan={5} className={styles.empty}>
                      No flashes in this window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </aside>

      <LightningGlobe
        flashes={flashes}
        mode={mode}
        trailSeconds={trailSeconds}
        speed={speed}
        windowStart={applied?.start ?? null}
        windowEnd={applied?.end ?? null}
        focus={focus}
        onSelect={handleGlobeSelect}
      />
    </div>
  );
}
