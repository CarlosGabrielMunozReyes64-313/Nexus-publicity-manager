import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: ["dist/**", "public/**", "node_modules/**"] },
  ...tseslint.configs.recommended,
);
