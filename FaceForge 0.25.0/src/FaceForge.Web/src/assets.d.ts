// Stylesheets are bundled by Vite. TypeScript 6 and later check side-effect imports, so the compiler has to be
// told that `import "./styles.css"` is a module that exists.
declare module "*.css";
