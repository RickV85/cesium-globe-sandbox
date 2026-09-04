import { Summary } from '@/lib/types';
import sharedStyles from './LightningApp.module.css';

interface Props {
  data: Summary;
}

export default function SummaryDisplay({ data }: Props) {
  if (!data) return undefined;
  return (
    <section className={sharedStyles.section}>
      <h2>Summary of selected flashes</h2>
      {/* Maybe make a reduce based on missing data.value */}
      {Object.entries(data).map(([dType, summaryData]) => (
        <p key={dType} className={sharedStyles.hint}>
          {summaryData.displayName}: {summaryData.value}
        </p>
      ))}
    </section>
  );
}
