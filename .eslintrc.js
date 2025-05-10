module.exports = {
  env: {
    es2022: true,
    node: true
  },
  extends: [],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  rules: {
    "require-await": "error",
    "no-return-await": "error",
    "@typescript-eslint/await-thenable": "error",
    "curly": "off"
  }
};