const prettierRecommended = require("eslint-plugin-prettier/recommended");
const jestPlugin = require("eslint-plugin-jest");

// This flat config is the single source of truth for ESLint in this repo.
// It ports the intent of the legacy package.json "eslintConfig" block
// (eslintrc format, ignored by ESLint 9/10) into flat config.
//
// Consciously dropped from the legacy config (see handoff for full rationale):
// - "eslint-config-uber-es2015" (extends): not an installed dependency.
// - "babel-eslint" (parser) / "eslint-plugin-babel" (plugin): both deprecated
//   upstream in favor of @babel/eslint-parser / @babel/eslint-plugin, and
//   neither replacement nor the originals are installed. Source is plain
//   modern JS (no experimental syntax needing a Babel parser), so the
//   default espree parser at ecmaVersion 2022 covers it.
//
// Ported (kept, using packages that ARE installed):
// - eslint-plugin-prettier's "recommended" flat config, which folds in
//   eslint-config-prettier to disable stylistic rules that conflict with
//   Prettier and reports Prettier diffs as "prettier/prettier" errors.
// - eslint-plugin-jest, scoped to the test files, matching the legacy
//   env: { "jest/globals": true } + plugins: ["jest"].
// - The explicit rule overrides from the legacy "rules" block, translated
//   1:1 where the rule still exists under the same name in ESLint 10.
//   "indent" and "quote-props" were dropped: eslint-config-prettier already
//   turns them off, and re-enabling them fought Prettier's own formatting
//   (tabs vs spaces, quoted vs unquoted keys), causing eslint --fix to loop
//   forever between the two. Prettier is configured via .prettierrc
//   (useTabs, trailingComma) to match the codebase's existing style instead.

module.exports = [
  {
    files: ["src/**/*.js", "test/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        jest: "readonly",
      },
    },
    plugins: {
      prettier: prettierRecommended.plugins.prettier,
    },
    rules: {
      ...prettierRecommended.rules,

      // --- ported 1:1 from legacy eslintConfig.rules ---
      complexity: "off",
      "valid-jsdoc": "off",
      "no-var": "off",
      "max-len": "off",
      "prefer-spread": "warn",
      "prefer-template": "warn",
      "spaced-comment": "warn",
      "max-params": "off",
      "no-multiple-empty-lines": "warn",
      "no-process-env": "off",
      "no-inline-comments": "off",
      "no-invalid-this": "off",
      "no-unused-expressions": "off",
      camelcase: "off",
      "consistent-return": "off",
      "comma-dangle": "warn",
      "no-magic-numbers": [
        "error",
        {
          ignore: [-1, 0, 1, 2, 100],
          enforceConst: true,
        },
      ],
      "func-names": "off",
      "max-statements": "off",
      "no-console": "off",
    },
  },
  {
    files: ["test/**/*.js"],
    plugins: {
      jest: jestPlugin,
    },
    languageOptions: {
      globals: {
        ...jestPlugin.environments.globals.globals,
      },
    },
    rules: {
      ...jestPlugin.configs.recommended.rules,
    },
  },
];
