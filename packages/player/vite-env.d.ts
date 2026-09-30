/// <reference types="vite/client" />

// SCSS 文件作为 side-effect import
declare module "*.scss" {
  const content: Record<string, string>;
  export default content;
}
