import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { COLUMN_DROP_PREFIX } from './boardGrid';

export function ColumnDroppable({
  columnId,
  children,
  className,
  isEmpty,
  emptyDropLabel,
}: {
  columnId: string;
  children: React.ReactNode;
  className?: string;
  isEmpty?: boolean;
  /** Shown when column is empty and user drags over (i18n). */
  emptyDropLabel?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: COLUMN_DROP_PREFIX + columnId });
  return (
    <div
      ref={setNodeRef}
      className={[
        className ?? '',
        'rounded-xl transition-all duration-200',
        isOver
          ? 'bg-accent/15 ring-2 ring-accent/50 ring-offset-0 min-h-[120px] transition-[box-shadow,background-color] duration-150'
          : '',
      ].join(' ')}
    >
      {children}
      {isEmpty && isOver && emptyDropLabel && (
        <div className="flex items-center justify-center h-20 text-accent/60 text-xs font-medium select-none">
          <span className="material-symbols-outlined text-base mr-1">add_circle</span>
          {emptyDropLabel}
        </div>
      )}
    </div>
  );
}
