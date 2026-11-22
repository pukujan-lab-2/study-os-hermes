// node web/build.mjs : bundles the page for the browser. Needs esbuild, react, react-dom and @tanstack/react-query
// somewhere node can find them (NODE_PATHS, colon separated; ESBUILD_FROM when esbuild is elsewhere).
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const paths = (process.env.NODE_PATHS || join(here, 'node_modules')).split(':')
const es = createRequire(join(process.env.ESBUILD_FROM || paths[0], 'x.js'))('esbuild')
await es.build({ entryPoints: [join(here, 'src/main.js')], bundle: true, format: 'esm', minify: true, legalComments: 'none', outfile: join(here, 'static/app.js'), alias: { '@hermes/plugin-sdk': join(here, 'src/sdk.js') }, nodePaths: paths, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error' })
