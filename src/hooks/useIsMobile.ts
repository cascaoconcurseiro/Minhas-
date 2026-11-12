import { useEffect, useState } from 'react';

const QUERY = '(max-width: 767px)';

/** Verdadeiro em celular (largura menor que 768 px). Sem suporte a matchMedia, considera tela grande. */
export function useIsMobile(): boolean {
  const read = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
  const [isMobile, setIsMobile] = useState(read);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(QUERY);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return isMobile;
}
