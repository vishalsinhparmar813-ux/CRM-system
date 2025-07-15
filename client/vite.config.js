// import { defineConfig } from "vite";
// import { fileURLToPath } from 'node:url';
// import react from "@vitejs/plugin-react";
// import { nodePolyfills } from 'vite-plugin-node-polyfills'

// export default defineConfig({
//   resolve: {
//     alias: [
//       { find: "@",  replacement: fileURLToPath(new URL('./src', import.meta.url))},
//       { find: "@images",  replacement: fileURLToPath(new URL('./src/assets/images', import.meta.url))},
//     ],
//   },
//   plugins: [
//     nodePolyfills({
//       globals: {
//         global: true,
//         process: true,
//         Buffer: true,
//       },
//     }),
//     react(),
//   ],
// });

import { defineConfig } from "vite";
import { fileURLToPath } from 'node:url';
import react from "@vitejs/plugin-react";
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import viteCompression from 'vite-plugin-compression';
import history from 'connect-history-api-fallback';


export default defineConfig({
  build: {
    minify: 'terser', // Ensure minification using Terser
    terserOptions: {
      ecma: 2015,
      compress: {
        drop_console: true, // Remove console logs in production
      }
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Split vendor code to separate chunks
            return 'vendor';
          }
        },
      }
    }
  },
  resolve: {
    alias: [
       { find: "@",  replacement: fileURLToPath(new URL('./src', import.meta.url))},
       { find: "@images",  replacement: fileURLToPath(new URL('./src/assets/images', import.meta.url))},
     ],
   },
  plugins: [
    react(),
    nodePolyfills({
      exclude: [
        'fs',
      ],
      globals: {
        Buffer: true,
        global: true,
        process: true,
        eventEmitter: true
      },
      protocolImports: true,
    }),
    viteCompression({
      verbose: true,
      disable: false,
      algorithm: 'gzip',
      ext: '.gz',
    }),
    viteCompression({
      verbose: true,
      disable: false,
      algorithm: 'brotliCompress',
      ext: '.br',
    }),
  ],
  server: {
    proxy: {
      '/transaction': 'http://localhost:3010', // Updated to match backend port
    },
    middlewareMode: false,
    setupMiddlewares: (middlewares, devServer) => {
      middlewares.use(history());
      return middlewares;
    },
  }
});

