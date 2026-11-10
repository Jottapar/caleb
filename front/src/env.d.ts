/// <reference types="vite/client" />

// Tipa las variables del .env. Sin esto, import.meta.env.VITE_API_URL seria
// `any` y un error de nombre no se notaria hasta ejecutar.
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
