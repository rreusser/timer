import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the built app works from any path: an S3 key prefix,
// a GitHub Pages project subpath, or the filesystem.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      // Not autoUpdate: that reloads the page the moment a new worker takes
      // over, which would kill a training session mid-round. The app asks
      // first, and never while a session is running.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'Reaction Trainer',
        short_name: 'Reaction',
        description: 'Train your reaction time against a configurable par-time beep.',
        lang: 'en',
        dir: 'ltr',
        categories: ['sports', 'health', 'utilities'],
        theme_color: '#353237',
        background_color: '#353237',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        // Reuse the open window instead of stacking new ones.
        launch_handler: { client_mode: 'navigate-existing' },
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Separate artwork: Android crops to an arbitrary shape and only
          // the inner 80% circle is guaranteed to survive.
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Unlocks the richer install dialog on Android.
        screenshots: [
          {
            src: 'screenshots/menu-narrow.png',
            sizes: '390x780',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Set the delay, goal time and round interval',
          },
          {
            src: 'screenshots/train-narrow.png',
            sizes: '390x780',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Go on the beep, stop on your goal time',
          },
          {
            src: 'screenshots/menu-wide.png',
            sizes: '1280x800',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Set the delay, goal time and round interval',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Store screenshots are for the install dialog only; there is no
        // reason to spend a user's cache on them.
        globIgnores: ['**/screenshots/**'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: true,
  },
});
