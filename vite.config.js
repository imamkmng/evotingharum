import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        vote: resolve(__dirname, 'vote.html'),
        success: resolve(__dirname, 'success.html'),
        realcount: resolve(__dirname, 'realcount.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});
