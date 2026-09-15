'use client';
import { createContext, JSX, useMemo, useState } from 'react';

/** Replay reads ingested flashes from the database; live reads NOAA's bucket directly. */
export type AppMode = 'replay' | 'live';

export type AppContext = {
  isLive: boolean;
  isTimeWindowEnabled: boolean;
  setIsTimeWindowEnabled: (newValue: boolean) => void;
  mode: AppMode;
  setMode: (newValue: AppMode) => void;
};

const defaultState: AppContext = {
  isLive: false,
  isTimeWindowEnabled: false,
  setIsTimeWindowEnabled: () => undefined,
  mode: 'replay',
  setMode: () => undefined,
};

export const AppContext = createContext(defaultState);

function AppContextValue(): AppContext {
  const [isTimeWindowEnabled, setIsTimeWindowEnabled] = useState(defaultState.isTimeWindowEnabled);
  const [mode, setMode] = useState(defaultState.mode);
  const isLive = mode === 'live';

  const value = useMemo(
    () => ({
      isLive,
      isTimeWindowEnabled,
      setIsTimeWindowEnabled,
      mode,
      setMode,
    }),
    [isLive, isTimeWindowEnabled, mode],
  );

  return value;
}

export function AppContextProvider({ children }: { children: JSX.Element }) {
  return <AppContext value={AppContextValue()}>{children}</AppContext>;
}
