export interface ModalScrollMetrics {
  isScrollable: boolean;
  isAtTop: boolean;
  isAtBottom: boolean;
  showTopShadow: boolean;
  showBottomShadow: boolean;
  scrollProgressPercent: number;
}

const SCROLL_EPSILON_PX = 4;

/**
 * Computes scroll state and shadow visibility for an independent scrollable modal body.
 */
export function computeModalScrollState(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number
): ModalScrollMetrics {
  const safeClient = Math.max(0, clientHeight);
  const safeScroll = Math.max(safeClient, scrollHeight);
  const maxScrollTop = Math.max(0, safeScroll - safeClient);
  const clampedScrollTop = Math.min(Math.max(0, scrollTop), maxScrollTop);

  const isScrollable = maxScrollTop > SCROLL_EPSILON_PX;
  const isAtTop = clampedScrollTop <= SCROLL_EPSILON_PX;
  const isAtBottom = !isScrollable || maxScrollTop - clampedScrollTop <= SCROLL_EPSILON_PX;

  const scrollProgressPercent = isScrollable
    ? Math.round((clampedScrollTop / maxScrollTop) * 100)
    : 100;

  return {
    isScrollable,
    isAtTop,
    isAtBottom,
    showTopShadow: isScrollable && !isAtTop,
    showBottomShadow: isScrollable && !isAtBottom,
    scrollProgressPercent,
  };
}
