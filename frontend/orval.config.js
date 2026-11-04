import { defineConfig } from 'orval';

export default defineConfig({
  laprizza: {
    input: {
      target: '../backend/src/api/openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: 'src/api/generated',
      schemas: 'src/api/model',
      client: 'react-query',
      httpClient: 'axios',
      clean: true,
      override: {
        mutator: {
          path: 'src/api/orval-mutator.js',
          name: 'axiosInstance',
        },
      },
    },
  },
});
