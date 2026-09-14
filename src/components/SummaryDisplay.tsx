import { Flash } from '@/lib/types';
import sharedStyles from './LightningApp.module.css';
import { UserGroup } from '@/lib/auth/users';
import HikerSummary from './HikerSummary';
import DefaultSummary from './DefaultSummary';

interface Props {
  flashes: Flash[];
  isLoading: boolean;
  userGroup: UserGroup | undefined;
}

export default function SummaryDisplay({ flashes, isLoading, userGroup }: Props) {
  const flashCount = flashes.length;

  const createTableDisplay = () => {
    if (userGroup === 'hike') {
      return <HikerSummary flashes={flashes} isLoading={isLoading} />;
    } else if (userGroup === 'default') {
      return <DefaultSummary flashes={flashes} isLoading={isLoading} />;
    } else {
      return null;
    }
  };

  return (
    <div style={{ margin: '0.5rem 0 0.75rem 0' }}>
      <h2>Summary of selected flash data</h2>
      <p className={sharedStyles.hint}>
        Flashes in date / time range:{' '}
        <span className={sharedStyles.count}>{isLoading ? '…' : flashCount}</span>
      </p>
      {createTableDisplay()}
    </div>
  );
}
