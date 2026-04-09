import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // 1. 全局忽略配置 (必须是首项且只有 ignores 键)
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/temp/**",
      "**/.next/**", // 如果有 Next.js 子包
      "package-lock.json",
      "pnpm-lock.yaml",
    ],
  },

  // 2. 基础配置：直接传入数组/对象
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 3. 自定义规则配置
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
