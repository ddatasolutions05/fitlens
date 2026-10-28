import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import { palette, type Colors } from './tokens';

export type ThemePreference = 'black' | 'white' | 'system';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: Colors;
  reducedMotion: boolean;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const STORAGE_KEY = 'fitlens.theme';

const ThemeContext = createContext<Theme>({
  scheme: 'dark',
  colors: palette.dark,
  reducedMotion: false,
  preference: 'black',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('black');
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (mounted && (v === 'black' || v === 'white' || v === 'system')) setPreferenceState(v);
      })
      .catch(() => {});
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) setReducedMotion(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const scheme: 'light' | 'dark' = preference === 'white' ? 'light' : preference === 'system' && system === 'light' ? 'light' : 'dark';

  const value = useMemo<Theme>(
    () => ({ scheme, colors: palette[scheme], reducedMotion, preference, setPreference }),
    [scheme, reducedMotion, preference, setPreference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
