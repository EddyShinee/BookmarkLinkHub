/** Double-tap Shift (không kèm phím khác) trong khoảng thời gian này. */
export const DOUBLE_SHIFT_WINDOW_MS = 400;
const MAX_SHIFT_HOLD_MS = 500;

function isShiftKey(e: KeyboardEvent): boolean {
  return e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight';
}

/**
 * Lắng nghe Shift-Shift trên `target` (mặc định window).
 * Không kích hoạt khi Shift được giữ để gõ hoa hoặc kèm Ctrl/⌘/Alt.
 */
export function createDoubleShiftDetector(
  onTrigger: () => void,
  target: Window | Document = window
): () => void {
  let lastShiftUpAt = 0;
  let shiftDownAt = 0;
  let contaminated = false;
  let armed = false;

  const onDown = (e: KeyboardEvent) => {
    if (e.repeat) return;

    if (!isShiftKey(e)) {
      if (e.shiftKey) contaminated = true;
      armed = false;
      return;
    }

    if (e.metaKey || e.ctrlKey || e.altKey) {
      contaminated = true;
      armed = false;
      return;
    }

    const now = Date.now();
    shiftDownAt = now;
    if (armed && !contaminated && now - lastShiftUpAt <= DOUBLE_SHIFT_WINDOW_MS) {
      e.preventDefault();
      e.stopPropagation();
      armed = false;
      lastShiftUpAt = 0;
      onTrigger();
      return;
    }

    armed = false;
    contaminated = false;
  };

  const onUp = (e: KeyboardEvent) => {
    if (!isShiftKey(e)) return;
    const held = Date.now() - shiftDownAt;
    if (contaminated || held > MAX_SHIFT_HOLD_MS) {
      armed = false;
      contaminated = false;
      lastShiftUpAt = 0;
      return;
    }
    lastShiftUpAt = Date.now();
    armed = true;
  };

  target.addEventListener('keydown', onDown, true);
  target.addEventListener('keyup', onUp, true);
  return () => {
    target.removeEventListener('keydown', onDown, true);
    target.removeEventListener('keyup', onUp, true);
  };
}
