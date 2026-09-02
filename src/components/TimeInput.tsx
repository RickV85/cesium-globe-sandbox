import sharedStyles from './LightningApp.module.css';
import { TimeValue, TimeInputState } from './LightningApp';

interface Props {
  tzOffset: string;
  value: { start: TimeValue; end: TimeValue };
  onChange: (newValue: TimeInputState) => void;
}

export default function DateInput({ tzOffset, value, onChange }: Props) {
  return (
    <div>
      <label className={sharedStyles.field}>
        <span>Start time</span>
        <input
          value={value.start}
          onChange={(e) => onChange({ start: e.target.value, end: value.end })}
          type="time"
        />
      </label>
      <label className={sharedStyles.field}>
        <span>End time</span>
        <input
          value={value.end}
          onChange={(e) => onChange({ end: e.target.value, start: value.start })}
          type="time"
        />
      </label>
      <p className={sharedStyles.hint}>{`Your browser's TZ offset from UTC is ${tzOffset}`}</p>
    </div>
  );
}
