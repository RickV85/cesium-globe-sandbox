'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';

import {
  DateInputState,
  ErrorState,
  flashKey,
  type Bounds,
  type Flash,
  type FlashesResponse,
} from '@/lib/types';
import type { FocusRequest } from './LightningGlobe';
import styles from './LightningApp.module.css';
import DateTimeInput from './DateTimeInput';
import FlashWindowPicker from './FlashWindowPicker';
import { MAX_LIMIT } from '@/constants';

// Cesium touches `window` on import, so the globe can never render on the
// server. Everything else on this page is happy to.
const LightningGlobe = dynamic(() => import('./LightningGlobe'), {
  ssr: false,
  loading: () => <div className={styles.globeLoading}>Loading globe…</div>,
});

/** Stable empty array: `?? []` would allocate per render and break memo deps. */
const NO_FLASHES: Flash[] = [];

/** "2026-08-01T00:00:03.447777Z" -> "00:00:03.447" */
function clockTime(iso: string): string {
  return iso.slice(11, 23);
}

function formatEnergy(j: number | null): string {
  return j === null ? '—' : j.toExponential(2);
}

export const removeMsFromIsoString = (isoString: string | null | undefined) => {
  if (!isoString) return '';
  return isoString.slice(0, 19);
};

const formatIsoDateTimeForDisplay = (dateTimeString: string | null | undefined) => {
  if (!dateTimeString) return 'unknown date';
  return new Date(dateTimeString).toLocaleString('en-US', { timeZone: 'UTC' });
};

const getBrowserTzOffset = () => {
  const utcOffsetInMinutes = new Date().getTimezoneOffset();
  if (Number.isNaN(utcOffsetInMinutes)) return 'unknown';
  const utcOffsetInHours = -utcOffsetInMinutes / 60; // invert due to getTimezone offset returning inverted values by default
  return `${utcOffsetInHours} hours`;
};

export const TEN_MIN_IN_SEC = 600;

export default function LightningApp() {
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [dateInputState, setDateInputState] = useState<DateInputState>({
    start: '',
    end: '',
  });
  const [applied, setApplied] = useState<{ start: string; end: string } | null>(null);

  const [windowSeconds, setWindowSeconds] = useState(TEN_MIN_IN_SEC);

  /**
   * The last completed fetch, tagged with the window it belongs to.
   *
   * Holding the result this way lets `loading` and `flashes` be derived rather
   * than stored, which keeps every setState inside an async continuation --
   * synchronously setting state in an effect body triggers cascading renders.
   */
  const [result, setResult] = useState<{
    key: string;
    flashes: FlashesResponse['flashes'];
    first: FlashesResponse['first'];
    last: FlashesResponse['last'];
    truncated: boolean;
  } | null>(null);
  const [errorState, setErrorState] = useState<ErrorState>({});
  const [selected, setSelected] = useState<Flash | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const nonce = useRef(0);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const hasError = Object.values(errorState).some((msg) => !!msg);

  const setFormattedDateState = ({ start, end }: { start: string; end: string }): void =>
    setDateInputState({
      start: removeMsFromIsoString(start),
      end: removeMsFromIsoString(end),
    });

  const tzOffset = useSyncExternalStore(
    () => () => {}, // subscribe: value never changes post-mount
    () => getBrowserTzOffset(), // client snapshot
    () => 'unknown', // server snapshot
  );

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
          setApplied({ start: data.earliest, end });
          setFormattedDateState({ start: data.earliest, end: data.latest });
        }
      } catch (cause) {
        if (!cancelled)
          setErrorState((prev) => {
            return {
              ...prev,
              fetchErr: cause instanceof Error ? cause.message : String(cause),
            };
          });
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

        const { flashes, first, last, truncated } = data;
        setResult({ key: windowKey, flashes, first, last, truncated: Boolean(truncated) });
        setErrorState((prev) => ({ ...prev, fetchErr: '' }));
        setSelected(null);
      } catch (cause) {
        if (!cancelled)
          setErrorState((prev) => {
            return {
              ...prev,
              fetchErr: cause instanceof Error ? cause.message : String(cause),
            };
          });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applied, windowKey]);

  const fresh = result?.key === windowKey ? result : null;
  const flashes = fresh?.flashes ?? NO_FLASHES;
  const truncated = fresh?.truncated ?? false;
  const loading = !hasError && (bounds === null || (windowKey !== null && fresh === null));

  const apply = useCallback(() => {
    const startTime = new Date(dateInputState.start).getTime();
    const endTime = new Date(dateInputState.end).getTime();

    if (!startTime || !endTime) {
      setErrorState((prev) => ({ ...prev, dateErr: 'Pick a date and a time for both ends of the window.' }));
      return;
    }
    if (endTime <= startTime) {
      setErrorState((prev) => ({ ...prev, dateErr: 'End must be after start.' }));
      return;
    }
    setErrorState((prev) => ({ ...prev, dateErr: '' }));
    // Add Z for UTZ / Zulu time
    setApplied({ start: dateInputState.start.concat('Z'), end: dateInputState.end.concat('Z') });
  }, [dateInputState]);

  const resetWindow = useCallback(() => {
    if (!bounds?.earliest || !bounds.latest) return;
    const end = new Date(Date.parse(bounds.latest) + 1000).toISOString();
    setFormattedDateState({ start: bounds.earliest, end: bounds.latest });
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
      rowRefs.current.get(flashKey(flash))?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, []);

  // const summary = useMemo(() => {
  //   if (!flashes.length) return null;
  //   const energies = flashes.map((f) => f.energy_j ?? 0).filter(Boolean);
  //   return {
  //     first: flashes[0].flash_time,
  //     last: flashes[flashes.length - 1].flash_time,
  //     peak: energies.length ? Math.max(...energies) : null,
  //   };
  // }, [flashes]);

  const errorDisplay = useMemo(
    () =>
      Object.entries(errorState)
        .filter(([, errMsg]) => !!errMsg)
        .map(([errName, errMsg]) => (
          <p key={errName} className={styles.error}>
            {errMsg}
          </p>
        )),
    [errorState],
  );

  return (
    <div className={styles.shell}>
      <aside className={styles.panel}>
        <header className={styles.header}>
          <h1>GOES-19 Lightning Flashes</h1>
          <h2>GLM flash detections over the Northern Rockies</h2>
        </header>
        <section className={styles.section}>
          <h2>Flash data range (UTC)</h2>
          {bounds?.earliest && (
            <p className={styles.hint}>
              Database holds {bounds.count} flash records between {bounds.earliest.slice(0, 10)} and{' '}
              {bounds.latest?.slice(0, 10)}.
            </p>
          )}
          <DateTimeInput
            min={removeMsFromIsoString(bounds?.earliest)}
            max={removeMsFromIsoString(bounds?.latest)}
            tzOffset={tzOffset}
            value={dateInputState}
            onChange={setDateInputState}
          />
          <div className={styles.buttonRow}>
            <button type="button" className={styles.primary} onClick={apply} disabled={loading}>
              Apply
            </button>
            <button type="button" className={styles.button} onClick={resetWindow} disabled={!bounds}>
              Full extent
            </button>
          </div>
          <FlashWindowPicker
            windowSeconds={windowSeconds}
            setWindowSeconds={setWindowSeconds}
            setErrorState={setErrorState}
          />
        </section>
        <section className={styles.sectionGrow}>
          <h2>
            Flashes in date / time window:{' '}
            <span className={styles.count}>{loading ? '…' : flashes.length}</span>
          </h2>
          {errorDisplay}
          {result && truncated && (
            <p className={styles.warning}>
              WARNING - Only the first {MAX_LIMIT} flash results between (
              {formatIsoDateTimeForDisplay(result.first)}) and ({formatIsoDateTimeForDisplay(result.last)})
              are being displayed below and on the map.
            </p>
          )}
          {/* {summary && (
            <p className={styles.hint}>
              {clockTime(summary.first)} – {clockTime(summary.last)}
              {summary.peak ? `, peak ${summary.peak.toExponential(2)} J` : ''}
            </p>
          )} */}

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
                  const key = flashKey(flash);
                  const isSelected = selected !== null && flashKey(selected) === key;
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
                      <td>{clockTime(flash.flash_time)}</td>
                      <td>{flash.lat.toFixed(3)}</td>
                      <td>{flash.lon.toFixed(3)}</td>
                      <td>{formatEnergy(flash.energy_j)}</td>
                      <td>{flash.area_km2?.toFixed(0) ?? '—'}</td>
                    </tr>
                  );
                })}
                {!loading && !flashes.length && !hasError && (
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
        focus={focus}
        onSelect={handleGlobeSelect}
        windowSeconds={windowSeconds}
      />
    </div>
  );
}
