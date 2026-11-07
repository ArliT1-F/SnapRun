import { defineConfig } from 'tsup';
export default defineConfig({ noExternal: ['@snaprun/shared'], splitting: false });
