/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ORIGIN_URL: string;
  readonly VITE_EDGE_US_URL: string;
  readonly VITE_EDGE_EU_URL: string;
  readonly VITE_EDGE_AP_URL: string;
  readonly VITE_USE_DEV_PROXY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
