/** @type {import('next').NextConfig} */

// A production build and a dev server both write to .next by default, so
// running `next build` while someone has `next dev` up leaves one clobbering
// the other: stale chunks, a half-written build manifest, or a webpack cache
// that holds both development and production entries at once.
//
// Setting CASEFILE_DIST_DIR sends a build somewhere else, so a compile check
// never touches a running dev server:
//
//   CASEFILE_DIST_DIR=.next-verify npx next build
//
const nextConfig = {
  reactStrictMode: true,
  ...(process.env.CASEFILE_DIST_DIR ? { distDir: process.env.CASEFILE_DIST_DIR } : {})
};

module.exports = nextConfig;
