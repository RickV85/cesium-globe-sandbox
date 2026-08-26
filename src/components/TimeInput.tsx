import sharedStyles from './LightningApp.module.css';
import { TimeValue, TimeInputState } from './LightningApp';

interface Props {
  value: { start: TimeValue; end: TimeValue };
  onChange: (newValue: TimeInputState) => void;
}

export default function DateInput({ value, onChange }: Props) {
  return (
    <div>
      <label className={sharedStyles.field}>
        <span>Start date</span>
        <input
          value={value.start}
          onChange={(e) => onChange({ start: e.target.value, end: value.end })}
          type="time"
        />
      </label>
      <label className={sharedStyles.field}>
        <span>End date</span>
        <input
          value={value.end}
          onChange={(e) => onChange({ end: e.target.value, start: value.start })}
          type="time"
        />
      </label>
    </div>
  );
}
