import styles from './FlashWindowPicker.module.css';
import { useContext, useEffect, useState } from 'react';
import type { Dispatch } from 'react';
import { ErrorState, TEN_MIN_IN_SEC } from './LightningApp';
import sharedStyles from './LightningApp.module.css';
import { Button } from '@mui/material';
import clsx from 'clsx';
import { AppContext } from '@/app/contexts/AppContext';

interface Props {
  windowSeconds: number;
  setErrorState: Dispatch<React.SetStateAction<ErrorState>>;
  setWindowSeconds: (newNumSeconds: number) => void;
}

const ONE_MIN = 60;
const ONE_HOUR = ONE_MIN * 60;
const convertWinSecForDisplay = (winSec: number) => {
  const hours = Math.floor(winSec / ONE_HOUR);
  const minutes = (winSec % ONE_HOUR) / ONE_MIN;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export default function FlashWindowPicker({ windowSeconds, setErrorState, setWindowSeconds }: Props) {
  const { isTimeWindowEnabled, setIsTimeWindowEnabled } = useContext(AppContext);
  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(TEN_MIN_IN_SEC / 60);

  useEffect(() => {
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
  }, [hours, minutes, setErrorState, setWindowSeconds, windowSeconds]);

  const handleWindowEnableSelect = () => {
    setIsTimeWindowEnabled(!isTimeWindowEnabled);
  };

  return (
    <section className={sharedStyles.section}>
      <h2>Select playback window for timeline playback in minutes</h2>
      <label className={sharedStyles.field}>
        <span>Hours</span>
        <input
          type="number"
          value={Number.isNaN(hours) ? '' : hours}
          onChange={(e) => setHours(e.target.valueAsNumber)}
          min={0}
        />
      </label>
      <label className={sharedStyles.field}>
        <span>Minutes</span>
        <input
          type="number"
          value={Number.isNaN(minutes) ? '' : minutes}
          onChange={(e) => setMinutes(e.target.valueAsNumber)}
          max={59}
          min={0}
        />
      </label>
      <div className={styles.windowPickerAndInfo}>
        <Button
          variant="outlined"
          classes={{ root: clsx(sharedStyles.button, sharedStyles.primary, styles.timeWindowButton) }}
          onClick={handleWindowEnableSelect}
        >
          {isTimeWindowEnabled ? 'Show all flashes' : 'Enable time window'}
        </Button>
        {isTimeWindowEnabled && (
          <p className={sharedStyles.hint} style={{ margin: 0 }}>
            Window length:
            <span className={sharedStyles.count}>{convertWinSecForDisplay(windowSeconds)}</span>
          </p>
        )}
      </div>
    </section>
  );
}
