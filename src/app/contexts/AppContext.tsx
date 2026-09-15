'use client';
import { createContext, JSX, useMemo, useState } from 'react';

export type AppContext = {
  /** Live reads NOAA's bucket directly; replay reads ingested flashes from the database. */
  isLive: boolean;
  setIsLive: (newValue: boolean) => void;
  isTimeWindowEnabled: boolean;
  setIsTimeWindowEnabled: (newValue: boolean) => void;
};

const defaultState: AppContext = {
  isLive: false,
  setIsLive: () => undefined,
  isTimeWindowEnabled: false,
  setIsTimeWindowEnabled: () => undefined,
};

export const AppContext = createContext(defaultState);

function AppContextValue(): AppContext {
  const [isLive, setIsLive] = useState(defaultState.isLive);
  const [isTimeWindowEnabled, setIsTimeWindowEnabled] = useState(defaultState.isTimeWindowEnabled);

  const value = useMemo(
    () => ({
      isLive,
      setIsLive,
      isTimeWindowEnabled,
      setIsTimeWindowEnabled,
    }),
    [isLive, isTimeWindowEnabled],
  );

  return value;
}

export function AppContextProvider({ children }: { children: JSX.Element }) {
  return <AppContext value={AppContextValue()}>{children}</AppContext>;
}
