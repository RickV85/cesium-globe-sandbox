import LightningApp from '@/components/LightningApp';
import { AppContextProvider } from './contexts/AppContext';

export default function Home() {
  return (
    <AppContextProvider>
      <LightningApp />
    </AppContextProvider>
  );
}
