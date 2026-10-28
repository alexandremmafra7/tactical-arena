import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * A stamp identifying this build, baked in at compile time.
 *
 * The offline save lives in `localStorage` on the player's own device, so it outlives any number of new
 * builds installed over it. While the game is still being changed daily that is a liability rather than a
 * feature: a save written by yesterday's build carries yesterday's world, and this week that meant a career
 * full of clubs that no longer exist. The offline engine compares this against what the save was written
 * with and starts over when they differ.
 *
 * When the game stops changing under its saves, replace this with a hand-written number bumped only on a
 * breaking change, so a player's career survives an update that does not need to break it.
 */
const BUILD_STAMP = 'v0.1.0';

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_STAMP__: JSON.stringify(BUILD_STAMP),
  },
  server: {
    port: 5173,
  },
  build: {
    sourcemap: true,
  },
});
