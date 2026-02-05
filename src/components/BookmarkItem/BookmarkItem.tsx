import type { Bookmark } from '../../hooks/useBookmarks';

interface BookmarkItemProps {
  bookmark: Bookmark;
  onEdit?: (b: Bookmark) => void;
  onDelete?: (id: string) => void;
}

export default function BookmarkItem({ bookmark, onEdit, onDelete }: BookmarkItemProps) {
  const open = () => chrome.tabs.create({ url: bookmark.url });

  return (
    <div className="group flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700">
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.preventDefault();
          open();
        }}
        className="flex-1 min-w-0 text-left"
      >
        <span className="font-medium text-gray-900 dark:text-gray-100 truncate block">
          {bookmark.title || bookmark.url}
        </span>
        {bookmark.description && (
          <span className="text-sm text-gray-500 dark:text-gray-400 truncate block">
            {bookmark.description}
          </span>
        )}
      </a>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(bookmark)}
            className="p-1 rounded text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
            aria-label="Sửa"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(bookmark.id)}
            className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            aria-label="Xóa"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
