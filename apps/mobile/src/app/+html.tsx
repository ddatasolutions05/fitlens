import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const base = (process.env.EXPO_PUBLIC_BASE_PATH || '').replace(/\/$/, '');

/** Root HTML for the web build: viewport, theme colour and home-screen install metadata. */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, shrink-to-fit=no" />
        <meta name="theme-color" content="#F4F1EA" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#151614" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FitLens" />
        <meta name="description" content="Understand what you eat, track how you move, and know what to adjust." />
        <link rel="manifest" href={`${base}/manifest.webmanifest`} />
        <link rel="apple-touch-icon" href={`${base}/icons/apple-touch-icon.png`} />
        <title>FitLens</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'html, body, #root { height: 100%; } body { margin: 0; background: #F4F1EA; } @media (prefers-color-scheme: dark) { body { background: #151614; } }' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
