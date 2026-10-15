import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// Old URLs from before the Oct 2026 restructure keep working.
const moved = {
  '/hobbies': '/blog',
  '/research': '/blog',
  '/cv': '/about#cv',
  '/contact': '/about#contact',
};
for (const s of ['mountain-biking', 'sewing', 'van', 'trail-range']) moved[`/hobbies/${s}`] = `/blog/${s}`;
for (const s of ['45x-map', 'mache-natural-experiment', 'ptfe-dry-electrode']) moved[`/research/${s}`] = `/blog/${s}`;

export default defineConfig({
  integrations: [tailwind()],
  redirects: moved,
});
