import { Summary } from '@/lib/types';
import sharedStyles from './LightningApp.module.css';
import { UserGroup } from '@/lib/auth/users';

interface Props {
  data: Summary;
  flashCount: number;
  isLoading: boolean;
  userGroup: UserGroup | undefined;
}

export default function SummaryDisplay({ data, flashCount, isLoading }: Props) {
  return (
    <div style={{ margin: '0.5rem 0 0.75rem 0' }}>
      <h2>Summary of selected flash data</h2>
      <p className={sharedStyles.hint}>
        Flashes in date / time range:{' '}
        <span className={sharedStyles.count}>{isLoading ? '…' : flashCount}</span>
      </p>
      <div className={sharedStyles.tableWrap}>
        <table className={sharedStyles.table}>
          <thead>
            <tr>
              <th></th>
              <th>Energy</th>
              <th>Area</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Average</td>
              <td>{data?.averageEnergy || 'N/A'}</td>
              <td>{data?.averageArea || 'N/A'}</td>
            </tr>
            <tr>
              <td>Peak</td>
              <td>{data?.peakEnergy || 'N/A'}</td>
              <td>{data?.peakArea || 'N/A'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
