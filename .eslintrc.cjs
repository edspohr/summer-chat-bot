module.exports = {
  root: true,
  env: { es2022: true, node: true },
  extends: ["eslint:recommended"],
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  rules: {
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
  overrides: [
    {
      files: ["**/*.ts", "**/*.tsx"],
      parser: "@typescript-eslint/parser",
      extends: ["plugin:@typescript-eslint/recommended"],
      rules: {
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      },
    },
    {
      // React hooks rules — catch the LabChat-style bug at lint time.
      // Rules-of-hooks fires on early returns between hook calls; the
      // exhaustive-deps rule stays as a warning (it fires on legitimate
      // patterns like `useCallback` with a manual dependency comment).
      files: ["packages/web/**/*.{ts,tsx}"],
      plugins: ["react-hooks"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  ],
};
