'use client';

import LightningApp from '@/components/LightningApp';
import { AppContextProvider } from './contexts/AppContext';
import { SessionProvider } from 'next-auth/react';

export default function Home() {
  return (
    <SessionProvider>
      <AppContextProvider>
        <LightningApp />
      </AppContextProvider>
    </SessionProvider>
  );
}
