'use client';
import { createContext, JSX, useMemo, useState } from 'react';

export type AppContext = {
  isTimeWindowEnabled: boolean;
  setIsTimeWindowEnabled: (newValue: boolean) => void;
};

const defaultState: {
  isTimeWindowEnabled: boolean;
  setIsTimeWindowEnabled: (newValue: boolean) => void;
} = {
  isTimeWindowEnabled: true,
  setIsTimeWindowEnabled: () => undefined,
};

export const AppContext = createContext(defaultState);

function AppContextValue(): AppContext {
  const [isTimeWindowEnabled, setIsTimeWindowEnabled] = useState(defaultState.isTimeWindowEnabled);

  const value = useMemo(
    () => ({
      isTimeWindowEnabled,
      setIsTimeWindowEnabled,
    }),
    [isTimeWindowEnabled],
  );

  return value;
}

export function AppContextProvider({ children }: { children: JSX.Element }) {
  return <AppContext value={AppContextValue()}>{children}</AppContext>;
}
