/// <reference types="vite-plugin-pwa/client" />
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {PwaUpdateNotice} from './pwa/PwaUpdateNotice';

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
  <>
    <App />
    <PwaUpdateNotice />
  </>
);
