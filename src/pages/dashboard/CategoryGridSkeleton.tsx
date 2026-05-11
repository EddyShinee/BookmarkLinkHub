import React from 'react';
import { categoryGridColsClass } from './boardGrid';

export function CategoryGridSkeleton({ numCols }: { numCols: number }) {
  const n = Math.min(6, Math.max(2, Math.round(numCols)));
  return (
    <div
      className={`category-grid ${categoryGridColsClass(n)}`}
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="category-grid-item space-y-3">
          <div className="rounded-xl border border-white/10 overflow-hidden glass-panel min-h-[200px]">
            <div className="h-10 border-b border-white/10 skeleton-shimmer" />
            <div className="p-3 space-y-2.5">
              <div className="h-9 skeleton-shimmer rounded-lg" />
              <div className="h-9 skeleton-shimmer rounded-lg" />
              <div className="h-9 skeleton-shimmer rounded-lg" />
              <div className="h-9 skeleton-shimmer rounded-lg w-4/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
