/// <reference types="vite-plugin-pwa/client" />
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {PwaUpdateNotice} from './pwa/PwaUpdateNotice';

createRoot(document.getElementById('root')!).render(
  <>
    <App />
    <PwaUpdateNotice />
  </>
);
