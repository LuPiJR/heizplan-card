import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
  input: 'heizplan-card-v2.ts',
  output: {
    file: 'dist/heizplan-card-v2.js',
    format: 'iife',
    name: 'HeizplanCardV2',
    sourcemap: true
  },
  plugins: [
    nodeResolve({
      browser: true,
      preferBuiltins: false
    }),
    typescript({
      tsconfig: './tsconfig.json'
    }),
    terser({
      format: {
        comments: false
      }
    })
  ],
  external: []
};