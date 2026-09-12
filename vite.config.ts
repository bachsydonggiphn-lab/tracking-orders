import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      allowedHosts: true,
      watch: {
        ignored: [
          '**/data/**',
          '**/*.sqlite*',
          '**/*.sqlite-wal*',
          '**/*.sqlite-shm*',
          '**/*.json',
          '**/batch_results*'
        ],
      },
    },
  };
});
