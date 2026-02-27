import { defineConfig } from "tsup";
import pkg from "./package.json";
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
  target: "es2020",
  external: ["@virid/core", "reflect-metadata", "electron"],
  // 添加 banner
  banner: {
    js: `/**
 *  ${pkg.name} v${pkg.version}
 *  ${pkg.description}
 */`,
  },
});
