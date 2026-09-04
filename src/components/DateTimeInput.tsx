import sharedStyles from './LightningApp.module.css';
import { DateValue, DateInputState } from '@/lib/types';

interface Props {
  min: string;
  max: string;
  tzOffset: string;
  value: { start: DateValue; end: DateValue };
  onChange: (newValue: DateInputState) => void;
}

export default function DateTimeInput({ min, max, tzOffset, value, onChange }: Props) {
  return (
    <div>
      <label className={sharedStyles.field}>
        <span>Start</span>
        <input
          min={min}
          max={max}
          value={value.start.slice(0, 19)}
          onChange={(e) => onChange({ start: e.target.value, end: value.end })}
          type="datetime-local"
        />
      </label>
      <label className={sharedStyles.field}>
        <span>End</span>
        <input
          min={min}
          max={max}
          value={value.end.slice(0, 19)}
          onChange={(e) => {
            onChange({ end: e.target.value, start: value.start });
          }}
          type="datetime-local"
        />
      </label>

      <p className={sharedStyles.hint}>
        Your browser&apos;s TZ offset from UTC: <span className={sharedStyles.count}>{tzOffset}</span>
      </p>
    </div>
  );
}
