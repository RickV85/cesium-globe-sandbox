import { Summary } from '@/lib/types';
import sharedStyles from './LightningApp.module.css';

interface Props {
  data: Summary;
}

export default function SummaryDisplay({ data }: Props) {
  if (!data) return undefined;
  return (
    <div style={{ margin: '12px 0px' }}>
      <h2>Summary of selected flash data</h2>
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
              <td>{data.averageEnergy}</td>
              <td>{data.averageArea}</td>
            </tr>
            <tr>
              <td>Peak</td>
              <td>{data.peakEnergy}</td>
              <td>{data.peakArea}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
