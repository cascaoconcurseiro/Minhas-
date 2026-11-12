declare module '*.css';

declare module '*.svg?url' {
  const assetUrl: string;
  export default assetUrl;
}

/** Versão publicada, definida no build (vite.config.ts). */
declare const __APP_BUILD__: { sha: string; builtAt: string };
