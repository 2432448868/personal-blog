import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://personal-blog.stock-backend-wkl.workers.dev',
  output: 'server',
  adapter: cloudflare({
    configPath: './wrangler.jsonc',
    persistState: { path: './.wrangler/state' },
    imageService: 'passthrough'
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()]
  },
  server: {
    host: true,
    port: 4321
  }
});
