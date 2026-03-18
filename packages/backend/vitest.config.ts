import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      BETTER_AUTH_SECRET: 'test-secret-for-vitest',
      SITE_URL: 'http://localhost:3001',
    },
    globals: true,
  },
});
