import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts so unit tests do not start the IWSDK dev plugin.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
