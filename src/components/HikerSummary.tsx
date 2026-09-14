import sharedStyles from '../components/LightningApp.module.css';
import { getAverageFlashTime } from '@/lib/summaryCalcs/hiker';
import { Flash } from '@/lib/types';
import clsx from 'clsx';

interface Props {
  isLoading: boolean;
  flashes: Flash[];
}

function convertTo12Hour(timeStr: string | null) {
  if (timeStr === null) {
    return 'Error';
  }
  const dummyDate = new Date(`1970-01-01T${timeStr}:00`);

  return dummyDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function HikerSummary({ flashes, isLoading }: Props) {
  const averageTimeOfDay = isLoading ? 'Loading...' : convertTo12Hour(getAverageFlashTime(flashes));

  return (
    <div className={sharedStyles.tableWrap}>
      <table
        className={clsx(sharedStyles.table, sharedStyles.tableNonInteractive, sharedStyles.tableFixedWidth)}
      >
        <tbody>
          <tr>
            <td>Average Time of Day (MDT)</td>
            <td>{averageTimeOfDay}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
