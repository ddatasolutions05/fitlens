import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import { palette, type Colors } from './tokens';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: Colors;
  reducedMotion: boolean;
}

const ThemeContext = createContext<Theme>({
  scheme: 'light',
  colors: palette.light,
  reducedMotion: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
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

  const value = useMemo<Theme>(
    () => ({ scheme, colors: palette[scheme], reducedMotion }),
    [scheme, reducedMotion],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
