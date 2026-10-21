import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { SUPABASE_URL, SUPABASE_ANON } from './src/config.js'

// Fonts the first screen of almost every page uses (nav 700, headings 800/900, body text 400).
// Preloaded so the text does not wait for the CSS to be parsed before the font download starts.
const PRELOAD_FONTS = [
  /^montserrat-latin-700-normal-.*\.woff2$/,
  /^montserrat-latin-800-normal-.*\.woff2$/,
  /^montserrat-latin-900-normal-.*\.woff2$/,
  /^poppins-latin-400-normal-.*\.woff2$/,
]

/* <head> hints, added at build time:
   - the site data (one GET, see src/lib/siteData.js) starts downloading while the HTML parses,
     in parallel with the JS — the URL must match SITE_DATA_URL exactly to be reused
   - preconnect to Supabase (storage images, the data) and font preloads */
function headHints() {
  return {
    name: 'fra-head-hints',
    transformIndexHtml(html, ctx) {
      const tag = (attrs) => `<link ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}>`
      const tags = [
        tag({ rel: 'preconnect', href: SUPABASE_URL, crossorigin: 'anonymous' }),
        tag({ rel: 'preload', as: 'fetch', crossorigin: 'anonymous', href: `${SUPABASE_URL}/rest/v1/rpc/site_data?apikey=${SUPABASE_ANON}` }),
      ]
      if (ctx.bundle) {
        for (const f of Object.keys(ctx.bundle)) {
          const name = f.split('/').pop()
          if (PRELOAD_FONTS.some((re) => re.test(name))) tags.push(tag({ rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: 'anonymous', href: `/${f}` }))
        }
      }
      // right after <meta charset> (the charset must stay in the first 1024 bytes)
      return html.replace(/(<meta charset="UTF-8" \/>)/, `$1\n    ${tags.join('\n    ')}`)
    },
  }
}

// Custom domain (fastlineracingacademy.pl) -> base '/'
export default defineConfig({
  // every <img> gets a responsive srcset through the app's JSX runtime (src/jsx, src/lib/img.js)
  plugins: [react({ jsxImportSource: 'fra-jsx' }), headHints()],
  resolve: { alias: [{ find: /^fra-jsx\/(jsx-runtime|jsx-dev-runtime)$/, replacement: fileURLToPath(new URL('./src/jsx/$1.js', import.meta.url)) }] },
  base: '/',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
})
