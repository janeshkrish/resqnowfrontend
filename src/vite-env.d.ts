/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_MAPPLS_MAP_SDK_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
