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

/**
 * Calculates the target scrollTop to ensure an expanded section inside the modal
 * is fully visible above the pinned footer.
 */
export function calculateTargetScrollTopForExpansion(
  currentScrollTop: number,
  containerClientHeight: number,
  sectionOffsetTop: number,
  sectionOffsetHeight: number,
  bottomPaddingBuffer = 24
): number {
  if (containerClientHeight <= 0) return Math.max(0, currentScrollTop);

  const sectionBottom = sectionOffsetTop + sectionOffsetHeight + bottomPaddingBuffer;
  const visibleBottom = currentScrollTop + containerClientHeight;

  if (sectionBottom > visibleBottom) {
    return Math.max(0, sectionBottom - containerClientHeight);
  }

  if (sectionOffsetTop < currentScrollTop) {
    return Math.max(0, sectionOffsetTop - 16);
  }

  return Math.max(0, currentScrollTop);
}
