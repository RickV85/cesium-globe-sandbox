import { Flash, Summary } from '@/lib/types';
import { useMemo } from 'react';
import sharedStyles from './LightningApp.module.css';
import clsx from 'clsx';

interface Props {
  isLoading: boolean;
  flashes: Flash[];
}

const createDisplayString = (data: string | undefined, isLoading: boolean) => {
  if (isLoading) {
    return 'Loading...';
  } else if (data) {
    return data;
  }
  return 'N/A';
};

export default function DefaultSummary({ flashes, isLoading }: Props) {
  const summaryData: Summary = useMemo(() => {
    if (!flashes.length) return null;

    const resultData = flashes.reduce(
      (result: Record<string, number>, f) => {
        if (f.energy_j && f.energy_j > 0) {
          result.totalEnergy += f.energy_j;
          if (result.peakEnergy < f.energy_j) {
            result.peakEnergy = f.energy_j;
          }
          result.countEnergy++;
        }
        if (f.area_km2 && f.area_km2 > 0) {
          result.totalArea += f.area_km2;
          if (result.peakArea < f.area_km2) {
            result.peakArea = f.area_km2;
          }
          result.countArea++;
        }

        return result;
      },
      { peakEnergy: 0, totalEnergy: 0, countEnergy: 0, peakArea: 0, totalArea: 0, countArea: 0 },
    );

    return {
      peakEnergy: `${resultData.peakEnergy.toExponential(2).toString()} J`,
      averageEnergy: `${(resultData.totalEnergy / resultData.countEnergy).toExponential(2)} J`,
      peakArea: `${resultData.peakArea.toFixed(0)} km²`,
      averageArea: `${(resultData.totalArea / resultData.countArea).toFixed(0)} km²`,
    };
  }, [flashes]);

  return (
    <div className={sharedStyles.tableWrap}>
      <table
        className={clsx(sharedStyles.table, sharedStyles.tableNonInteractive, sharedStyles.tableFixedWidth)}
      >
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
            <td>{createDisplayString(summaryData?.averageEnergy, isLoading)}</td>
            <td>{createDisplayString(summaryData?.averageArea, isLoading)}</td>
          </tr>
          <tr>
            <td>Peak</td>
            <td>{createDisplayString(summaryData?.peakEnergy, isLoading)}</td>
            <td>{createDisplayString(summaryData?.peakArea, isLoading)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
