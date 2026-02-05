import type { Board, Category, Bookmark } from '../hooks/useBookmarks';

/** Tạo file HTML Netscape Bookmark format từ boards/categories/bookmarks */
export function buildBookmarksHtml(
  boards: Board[],
  categories: { category: Category; bookmarks: Bookmark[] }[]
): string {
  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file. -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];

  boards.forEach((board) => {
    lines.push('    <DT><H3>', escapeHtml(board.name), '</H3>');
    lines.push('    <DL><p>');
    const boardCats = categories.filter((c) => c.category.board_id === board.id);
    boardCats.forEach(({ category, bookmarks }) => {
      lines.push('        <DT><H3>', escapeHtml(category.name), '</H3>');
      lines.push('        <DL><p>');
      bookmarks.forEach((b) => {
        const addDate = Math.floor(new Date(b.created_at).getTime() / 1000);
        lines.push(
          '            <DT><A HREF="',
          escapeHtml(b.url),
          '" ADD_DATE="',
          addDate,
          '">',
          escapeHtml(b.title || b.url),
          '</A>'
        );
      });
      lines.push('        </DL><p>');
    });
    lines.push('    </DL><p>');
  });

  lines.push('</DL><p>');
  return lines.join('');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Trigger download of HTML file */
export function downloadHtml(html: string, filename = 'linkhub-bookmarks.html') {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
