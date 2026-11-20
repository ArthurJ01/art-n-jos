// Bundles the API into dist/ with esbuild.
// Our own workspace packages (@art-web/*) are compiled INTO the bundle (they're TypeScript source),
// while third-party packages stay external and are loaded from node_modules at runtime.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts', 'src/vercel.ts', 'src/db/migrate.ts'],
  outdir: 'dist',
  outbase: 'src',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  logLevel: 'info',
  plugins: [
    {
      name: 'externalize-node-modules',
      setup(b) {
        b.onResolve({ filter: /^[^./]/ }, (args) =>
          args.path.startsWith('@art-web/') ? undefined : { path: args.path, external: true },
        );
      },
    },
  ],
});
