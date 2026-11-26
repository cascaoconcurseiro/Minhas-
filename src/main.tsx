/// <reference types="vite-plugin-pwa/client" />
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
// Fontes servidas pelo próprio site (antes vinham do Google e travavam a primeira pintura da tela).
// O navegador só baixa os arquivos dos caracteres e estilos que a tela usa.
import '@fontsource-variable/dm-sans/opsz.css';
import '@fontsource-variable/dm-sans/opsz-italic.css';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './index.css';
import {PwaUpdateNotice} from './pwa/PwaUpdateNotice';
import {ErrorBoundary} from './components/layout/ErrorBoundary';

// Depois de uma nova publicação, uma aba aberta pode pedir arquivos antigos que não existem mais (404).
// Recarrega uma vez para buscar a versão nova; se falhar de novo em 30 s, deixa o erro aparecer.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  try {
    const key = 'minhas-chunk-reload-at';
    const last = Number(window.sessionStorage.getItem(key) || 0);
    if (Date.now() - last > 30_000) {
      window.sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    }
  } catch {
    // Sem sessionStorage não há como evitar laço de recarga: não recarrega.
  }
});

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary scope="app">
    <App />
    <PwaUpdateNotice />
  </ErrorBoundary>
);
