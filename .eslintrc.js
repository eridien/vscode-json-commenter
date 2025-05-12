module.exports = {
  env: {
    es2022: true,
    node: true
  },
  extends: ["eslint:recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  rules: {
    "require-await": "error",
    "no-return-await": "error",
    "@typescript-eslint/await-thenable": "error",
    "curly": "off",
    "no-unused-vars": "off", 
    "@typescript-eslint/no-unused-vars": "off"
  }
};