import { Bounds, DateInputState, ErrorState } from '@/lib/types';
import DateTimeInput from './DateTimeInput';
import FlashWindowPicker from './FlashWindowPicker';
import { removeMsFromIsoString } from './LightningApp';
import sharedStyles from './LightningApp.module.css';
import { SetStateAction, useSyncExternalStore } from 'react';

const getBrowserTzOffset = () => {
  const utcOffsetInMinutes = new Date().getTimezoneOffset();
  if (Number.isNaN(utcOffsetInMinutes)) return 'unknown';
  const utcOffsetInHours = -utcOffsetInMinutes / 60; // invert due to getTimezone offset returning inverted values by default
  return `${utcOffsetInHours} hours`;
};

interface Props {
  apply: () => void;
  bounds: Bounds | null;
  dateInputState: DateInputState;
  hasAppliedBeenFetched: boolean;
  isLoading: boolean;
  setAppliedToFullExtent: (bounds: Bounds | null) => void;
  setDateInputState: React.Dispatch<SetStateAction<DateInputState>>;
  setErrorState: React.Dispatch<SetStateAction<ErrorState>>;
  setWindowSeconds: React.Dispatch<SetStateAction<number>>;
  windowSeconds: number;
}

export default function ReplayControls({
  apply,
  bounds,
  dateInputState,
  isLoading,
  hasAppliedBeenFetched,
  setAppliedToFullExtent,
  setDateInputState,
  setWindowSeconds,
  setErrorState,
  windowSeconds,
}: Props) {
  const tzOffset = useSyncExternalStore(
    () => () => {}, // subscribe: value never changes post-mount
    () => getBrowserTzOffset(), // client snapshot
    () => 'unknown', // server snapshot
  );
  return (
    <section className={sharedStyles.section}>
      <h2>Flash data range (UTC)</h2>
      {bounds?.earliest && (
        <p className={sharedStyles.hint}>
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
      <div className={sharedStyles.buttonRow}>
        <button
          type="button"
          className={sharedStyles.primary}
          onClick={apply}
          disabled={isLoading || hasAppliedBeenFetched}
        >
          Apply
        </button>
        <button
          type="button"
          className={sharedStyles.button}
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
  );
}
