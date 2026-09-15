import { useContext } from 'react';
import sharedStyles from './LightningApp.module.css';
import { AppContext } from '@/app/contexts/AppContext';

export default function LiveReplayToggle() {
  const { isLive, setIsLive } = useContext(AppContext);
  return (
    <div className={sharedStyles.buttonRow}>
      <button
        type="button"
        className={isLive ? sharedStyles.button : sharedStyles.primary}
        aria-pressed={!isLive}
        onClick={() => setIsLive(false)}
      >
        Replay
      </button>
      <button
        type="button"
        className={isLive ? sharedStyles.primary : sharedStyles.button}
        aria-pressed={isLive}
        onClick={() => setIsLive(true)}
      >
        Live
      </button>
    </div>
  );
}
