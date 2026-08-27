import { useEffect, useRef, useState } from 'react';
import { TEN_MIN_IN_SEC } from './LightningApp';
import sharedStyles from './LightningApp.module.css';

interface Props {
  windowSeconds: number;
  setError: (newErrorState: string | null) => void;
  setWindowSeconds: (newNumSeconds: number) => void;
}

const ONE_MIN = 60;
const ONE_HOUR = 600;

// const convertWinSecForDisplay = (winSec: number) => {
//   const hours = winSec % ONE_HOUR;
//   console.log({ hours });
//   const min = (winSec - hours * 60) / ONE_MIN;
//   return `${hours}:${min}`;
// };

export default function FlashWindowPicker({ windowSeconds, setError, setWindowSeconds }: Props) {
  const DEFAULT_MIN_STATE = TEN_MIN_IN_SEC / 60;
  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(DEFAULT_MIN_STATE);

  const windowSecondsRef = useRef(windowSeconds);

  useEffect(() => {
    if (minutes >= 60) {
      setError('Enter a value 0 - 59 minutes. Use Hours input for window values over 1 hour.');
      return;
    }

    const updatedCurrentTotalSeconds = hours * 60 * 60 + minutes * 60;
    if (windowSecondsRef.current !== updatedCurrentTotalSeconds) {
      setWindowSeconds(updatedCurrentTotalSeconds);
    }
  }, [hours, minutes, setError, setWindowSeconds]);

  return (
    <div className={sharedStyles.section}>
      <h2>Select playback window for timeline playback in minutes</h2>
      {/* <p>{`Current window length: ${convertWinSecForDisplay(windowSeconds)}`}</p> */}
      <label className={sharedStyles.field}>
        <span>Hours</span>
        <input type="number" value={hours} onChange={(e) => setHours(e.target.valueAsNumber)} min={0} />
      </label>
      <label className={sharedStyles.field}>
        <span>Minutes</span>
        <input
          type="number"
          value={minutes}
          onChange={(e) => setMinutes(e.target.valueAsNumber)}
          max={59}
          min={0}
        />
      </label>
    </div>
  );
}
