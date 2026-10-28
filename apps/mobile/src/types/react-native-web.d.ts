// react-native-web ships no types. Only the one export the app uses is declared.
declare module 'react-native-web' {
  import type { ReactElement } from 'react';

  export function unstable_createElement(type: string, props?: Record<string, unknown>): ReactElement;
}
