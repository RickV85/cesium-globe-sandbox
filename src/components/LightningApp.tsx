'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';

import {
  DateInputState,
  ErrorState,
  flashKey,
  type Summary,
  type Bounds,
  type Flash,
  type FlashesResponse,
} from '@/lib/types';
import type { FocusRequest } from './LightningGlobe';
import styles from './LightningApp.module.css';
import DateTimeInput from './DateTimeInput';
import FlashWindowPicker from './FlashWindowPicker';
import { MAX_LIMIT, ONE_DAY_IN_MS, TEN_MIN_IN_SEC } from '@/constants';
import SummaryDisplay from './SummaryDisplay';
import { isEqual } from 'lodash';
import { useSession } from 'next-auth/react';
import SignOutButton from './SignOutButton';

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

function addOneSecondToDateTime(date: string | number, isUtc = false) {
  if (!date) return '';
  const parsedDate = typeof date === 'string' ? Date.parse(isUtc ? date + 'Z' : date) : date;
  return new Date(parsedDate + 1000).toISOString();
}

export const removeMsFromIsoString = (isoString: string | null | undefined) => {
  if (!isoString) return '';
  return isoString.slice(0, 19);
};

function createFormattedDateInputState(dtInputState: DateInputState, addZ = false): DateInputState {
  const formatted = {
    start: removeMsFromIsoString(dtInputState.start),
    end: removeMsFromIsoString(dtInputState.end),
  };
  if (addZ) {
    formatted.start += 'Z';
    formatted.end += 'Z';
  }
  return formatted;
}

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

export default function LightningApp() {
  const session = useSession();
  const userGroup = session.data?.user.userGroup;

  const [applied, setApplied] = useState<DateInputState | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [dateInputState, setDateInputState] = useState<DateInputState>({
    start: '',
    end: '',
  });
  const [errorState, setErrorState] = useState<ErrorState>({});
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [selected, setSelected] = useState<Flash | null>(null);
  const [windowSeconds, setWindowSeconds] = useState(TEN_MIN_IN_SEC);
  /**
   * The last completed fetch, tagged with the window it belongs to.
   *
   * Holding the result this way lets `isLoading` and `flashes` be derived rather
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

  // Refs
  const nonce = useRef(0);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const prevFetchAppliedRef = useRef<DateInputState | null>(null);

  // Variables
  const windowKey = applied ? `${applied.start}|${applied.end}` : null;
  const dateInputStateAsAppliedTimeWindow =
    !dateInputState.start || !dateInputState.end
      ? null
      : createFormattedDateInputState(
          {
            start: dateInputState.start,
            end: addOneSecondToDateTime(dateInputState.end, true),
          },
          true,
        );
  const hasAppliedBeenFetched = isEqual(prevFetchAppliedRef.current, dateInputStateAsAppliedTimeWindow);
  const hasError = Object.values(errorState).some((msg) => !!msg);
  const fresh = result?.key === windowKey ? result : null;
  const flashes = fresh?.flashes ?? NO_FLASHES;
  const isLoading = !hasError && (bounds === null || (windowKey !== null && fresh === null));
  const truncated = fresh?.truncated ?? false;

  const tzOffset = useSyncExternalStore(
    () => () => {}, // subscribe: value never changes post-mount
    () => getBrowserTzOffset(), // client snapshot
    () => 'unknown', // server snapshot
  );

  const setAppliedToFullExtent = useCallback((bounds: Bounds | null) => {
    if (!bounds?.earliest || !bounds.latest) return;
    setApplied(
      createFormattedDateInputState(
        { start: bounds.earliest, end: addOneSecondToDateTime(bounds.latest) },
        true,
      ),
    );
    setDateInputState(createFormattedDateInputState({ start: bounds.earliest, end: bounds.latest }));
  }, []);

  // Get and set initial bounds, date ranges available
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
          const latestEpoch = Date.parse(data.latest);
          // `end` is exclusive, so nudge past the final flash to include it.
          const earliestEpoch = Date.parse(data.earliest);

          if (latestEpoch - ONE_DAY_IN_MS > earliestEpoch) {
            // Set start to latest flash time minus 24 hours
            const start = new Date(latestEpoch - ONE_DAY_IN_MS).toISOString();
            setApplied(
              createFormattedDateInputState({ start, end: addOneSecondToDateTime(latestEpoch) }, true),
            );
            setDateInputState(createFormattedDateInputState({ start, end: data.latest }));
          } else {
            setAppliedToFullExtent(data);
          }
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
  }, [setAppliedToFullExtent]);

  // Fetch flashes for the applied window.
  useEffect(() => {
    if (!applied || !windowKey || hasAppliedBeenFetched) return;
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
        prevFetchAppliedRef.current = applied;
      } catch (cause) {
        if (!cancelled) {
          setErrorState((prev) => {
            return {
              ...prev,
              fetchErr: cause instanceof Error ? cause.message : String(cause),
            };
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applied, hasAppliedBeenFetched, windowKey]);

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
    // Reset date and fetch error state, flashWinErr reset in picker component
    setErrorState((prev) => ({ ...prev, dateErr: '', fetchErr: '' }));
    setApplied(dateInputStateAsAppliedTimeWindow);
  }, [dateInputStateAsAppliedTimeWindow, dateInputState]);

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

  const summaryData: Summary = useMemo(() => {
    if (!flashes.length) return null;

    const resultData = flashes.reduce(
      (result: Record<string, number>, f) => {
        if (f.energy_j && f.energy_j > 0) {
          result.totalEnergy += f.energy_j;
          if (result.peakEnergy < f.energy_j) {
            result.peakEnergy = f.energy_j;
          }
          result.countEnergy++;
        }
        if (f.area_km2 && f.area_km2 > 0) {
          result.totalArea += f.area_km2;
          if (result.peakArea < f.area_km2) {
            result.peakArea = f.area_km2;
          }
          result.countArea++;
        }

        return result;
      },
      { peakEnergy: 0, totalEnergy: 0, countEnergy: 0, peakArea: 0, totalArea: 0, countArea: 0 },
    );

    return {
      peakEnergy: `${resultData.peakEnergy.toExponential(2).toString()} J`,
      averageEnergy: `${(resultData.totalEnergy / resultData.countEnergy).toExponential(2)} J`,
      peakArea: `${resultData.peakArea.toFixed(0)} km²`,
      averageArea: `${(resultData.totalArea / resultData.countArea).toFixed(0)} km²`,
    };
  }, [flashes]);

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
          <div className={styles.headerContainer}>
            <h1>GOES-19 Lightning Flashes</h1>
            <SignOutButton />
          </div>
          <h2 style={{ marginBottom: '0' }}>GLM flash detections over the Northern Rockies</h2>
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
            <button
              type="button"
              className={styles.primary}
              onClick={apply}
              disabled={isLoading || hasAppliedBeenFetched}
            >
              Apply
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => setAppliedToFullExtent(bounds)}
              disabled={!bounds}
            >
              Full extent
            </button>
          </div>
          <FlashWindowPicker
            setWindowSeconds={setWindowSeconds}
            setErrorState={setErrorState}
            windowSeconds={windowSeconds}
          />
        </section>
        <section className={styles.sectionGrow}>
          {errorDisplay}
          {result && truncated && (
            <p className={styles.warning}>
              WARNING - Only the first {MAX_LIMIT} flash results between (
              {formatIsoDateTimeForDisplay(result.first)}) and ({formatIsoDateTimeForDisplay(result.last)})
              are being displayed below and on the map.
            </p>
          )}
          <SummaryDisplay
            data={summaryData}
            flashCount={flashes.length}
            isLoading={isLoading}
            userGroup={userGroup}
          />
          <h2>Selected flash data</h2>
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
                {!isLoading && !flashes.length && !hasError && (
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
