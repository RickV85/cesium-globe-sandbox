import styles from './FlashWindowPicker.module.css';
import { useContext, useState } from 'react';
import type { Dispatch } from 'react';
import { TEN_MIN_IN_SEC } from './LightningApp';
import sharedStyles from './LightningApp.module.css';
import { Button } from '@mui/material';
import clsx from 'clsx';
import { AppContext } from '@/app/contexts/AppContext';
import { ErrorState } from '@/lib/types';

interface Props {
  currentFlashCount: number;
  isLoading: boolean;
  setErrorState: Dispatch<React.SetStateAction<ErrorState>>;
  setWindowSeconds: (newNumSeconds: number) => void;
  windowSeconds: number;
}

const ONE_MIN = 60;
const ONE_HOUR = ONE_MIN * 60;
const convertWinSecForDisplay = (winSec: number) => {
  const hours = Math.floor(winSec / ONE_HOUR);
  const minutes = (winSec % ONE_HOUR) / ONE_MIN;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export default function FlashWindowPicker({
  currentFlashCount,
  isLoading,
  setErrorState,
  setWindowSeconds,
  windowSeconds,
}: Props) {
  const { isTimeWindowEnabled, setIsTimeWindowEnabled } = useContext(AppContext);
  const [hours, setHours] = useState<number>(0);
  // Maybe should make this default state calc'd on the initial data set for better UX
  const [minutes, setMinutes] = useState<number>(TEN_MIN_IN_SEC / 60);

  const handleTimeWindowUpdate = () => {
    if (minutes >= 60 || minutes < 0) {
      setErrorState((prev) => ({
        ...prev,
        flashWinErr: 'Enter a numerical value 0 - 59. Use Hours input for window values over 1 hour.',
      }));
      return;
    } else if (hours < 0) {
      setErrorState((prev) => ({ ...prev, flashWinErr: 'Enter a positive numerical hour value.' }));
      return;
    } else {
      setErrorState((prev) => ({ ...prev, flashWinErr: '' }));
    }

    const calcHours = Number.isNaN(hours) ? 0 : hours;
    const calcMin = Number.isNaN(minutes) ? 0 : minutes;
    const newValue = calcHours * ONE_HOUR + calcMin * ONE_MIN;
    if (windowSeconds !== newValue) {
      setWindowSeconds(newValue);
    }
  };

  const handleTimeWindowEnable = () => {
    setIsTimeWindowEnabled(!isTimeWindowEnabled);
  };

  return (
    <section className={styles.timeWindowSection}>
      <h2>Time window playback range</h2>
      <div className={styles.windowInfo}>
        <p className={sharedStyles.hint}>
          Flashes in window: <span className={sharedStyles.count}>{isLoading ? '…' : currentFlashCount}</span>
        </p>
        <p>|</p>
        <p className={sharedStyles.hint}>
          {isTimeWindowEnabled ? 'Current window length:' : 'Time window disabled'}
          {isTimeWindowEnabled && (
            <span className={sharedStyles.count}>{convertWinSecForDisplay(windowSeconds)}</span>
          )}
        </p>
      </div>
      <label className={sharedStyles.field}>
        <span>Hours</span>
        <input
          disabled={!isTimeWindowEnabled}
          type="number"
          value={Number.isNaN(hours) ? '' : hours}
          onChange={(e) => setHours(e.target.valueAsNumber)}
          min={0}
        />
      </label>
      <label className={sharedStyles.field}>
        <span>Minutes</span>
        <input
          disabled={!isTimeWindowEnabled}
          type="number"
          value={Number.isNaN(minutes) ? '' : minutes}
          onChange={(e) => setMinutes(e.target.valueAsNumber)}
          max={59}
          min={0}
        />
      </label>
      <div className={styles.windowButtonGroup}>
        <Button
          disabled={!isTimeWindowEnabled}
          variant="outlined"
          classes={{ root: clsx(sharedStyles.button, sharedStyles.primary, styles.timeWindowButton) }}
          onClick={handleTimeWindowUpdate}
        >
          Apply time window
        </Button>
        <Button
          variant="outlined"
          classes={{ root: clsx(sharedStyles.button, styles.timeWindowButton) }}
          onClick={handleTimeWindowEnable}
        >
          {isTimeWindowEnabled ? 'Show all flashes' : 'Enable time window'}
        </Button>
      </div>
    </section>
  );
}
