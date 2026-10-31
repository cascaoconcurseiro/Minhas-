import { useCallback, useRef, useState } from 'react';
import { shouldCancelLongPress } from '../utils/gestureRules';

interface UsePressAndHoldOptions {
  onLongPress: () => void;
  delayMs?: number;
  touchSlop?: number;
}

export function usePressAndHold({
  onLongPress,
  delayMs = 450,
  touchSlop = 10,
}: UsePressAndHoldOptions) {
  const [isPressing, setIsPressing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasTriggeredRef = useRef(false);

  const startPress = useCallback(
    (clientX: number, clientY: number) => {
      hasTriggeredRef.current = false;
      startPosRef.current = { x: clientX, y: clientY };
      setIsPressing(true);

      timerRef.current = setTimeout(() => {
        hasTriggeredRef.current = true;
        setIsPressing(false);
        // Provide gentle haptic vibration if supported
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate?.(40);
          } catch {
            // ignore
          }
        }
        onLongPress();
      }, delayMs);
    },
    [onLongPress, delayMs]
  );

  const cancelPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
    setIsPressing(false);
  }, []);

  const movePress = useCallback(
    (clientX: number, clientY: number) => {
      if (!startPosRef.current || hasTriggeredRef.current) return;
      if (
        shouldCancelLongPress(
          startPosRef.current.x,
          startPosRef.current.y,
          clientX,
          clientY,
          touchSlop
        )
      ) {
        cancelPress();
      }
    },
    [cancelPress, touchSlop]
  );

  const bindPress = {
    onPointerDown: (e: React.PointerEvent) => {
      // Only primary mouse button or touch
      if (e.button !== 0) return;
      startPress(e.clientX, e.clientY);
    },
    onPointerMove: (e: React.PointerEvent) => {
      movePress(e.clientX, e.clientY);
    },
    onPointerUp: () => {
      cancelPress();
    },
    onPointerCancel: () => {
      cancelPress();
    },
    onContextMenu: (e: React.MouseEvent) => {
      // If triggered by long-press on mobile, prevent default context menu
      if (hasTriggeredRef.current) {
        e.preventDefault();
      }
    },
  };

  return {
    isPressing,
    bindPress,
    hasTriggered: hasTriggeredRef.current,
  };
}
