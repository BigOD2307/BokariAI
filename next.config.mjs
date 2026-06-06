import pkg from './package.json' with { type: 'json' };

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        hostname: 's2.googleusercontent.com',
      },
    ],
  },
  serverExternalPackages: ['pdf-parse', 'sql.js'],
  outputFileTracingIncludes: {
    '/api/**': [
      './node_modules/@napi-rs/canvas/**',
      './node_modules/@napi-rs/canvas-linux-x64-gnu/**',
      './node_modules/@napi-rs/canvas-linux-x64-musl/**',
    ],
    // sql.js loads its .wasm at runtime; tracing misses .wasm, so force-include
    // it for every route that touches SQLite (blog, data, discover, api).
    '/**': ['./node_modules/sql.js/dist/sql-wasm.wasm'],
  },
  env: {
    NEXT_PUBLIC_VERSION: pkg.version,
  },
};

export default nextConfig;
