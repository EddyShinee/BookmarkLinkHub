import { useEffect } from 'react';
import { createDoubleShiftDetector } from '../lib/doubleShift';

export function useDoubleShiftShortcut(onTrigger: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    return createDoubleShiftDetector(onTrigger);
  }, [onTrigger, enabled]);
}
