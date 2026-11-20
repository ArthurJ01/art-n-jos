// Vercel turns every file in the top-level /api folder into a serverless function.
// This one hands all /api/* requests to our Express app (see the rewrites in vercel.json).
//
// It imports the API *bundle* built by `npm run build --workspace apps/api` (esbuild),
// so our shared TypeScript package is already compiled into it.
export { default } from '../apps/api/dist/vercel.js';
