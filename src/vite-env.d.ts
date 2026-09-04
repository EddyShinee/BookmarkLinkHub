/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css?inline' {
  const css: string;
  export default css;
}

declare module '*?script' {
  const path: string;
  export default path;
}
