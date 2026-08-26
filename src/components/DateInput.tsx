import sharedStyles from './LightningApp.module.css';
import { DateInputState, DateValue } from './LightningApp';

interface Props {
  value: { start: DateValue; end: DateValue };
  onChange: (newValue: DateInputState) => void;
  min: string;
  max: string;
}

export default function DateInput({ value, onChange, min, max }: Props) {
  return (
    <div>
      <label className={sharedStyles.field}>
        <span>Start date</span>
        <input
          max={max}
          min={min}
          value={value.start}
          onChange={(e) =>
            onChange({
              start: new Date(e.target.value).toLocaleDateString('fr-CA', { timeZone: 'UTC' }),
              end: value.end,
            })
          }
          type="date"
        />
      </label>
      <label className={sharedStyles.field}>
        <span>End date</span>
        <input
          max={max}
          min={min}
          value={value.end}
          onChange={(e) =>
            onChange({
              end: new Date(e.target.value).toLocaleDateString('fr-CA', { timeZone: 'UTC' }),
              start: value.start,
            })
          }
          type="date"
        />
      </label>
    </div>
  );
}
