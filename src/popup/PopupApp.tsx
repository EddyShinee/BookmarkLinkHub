/** Popup tối giản: mở tab mới (New Tab = LinkHub) hoặc thêm trang hiện tại. */
const NEWTAB_PATH = 'src/newtab/index.html';

export default function PopupApp() {
  const openNewTab = (query?: string) => {
    const url = query
      ? chrome.runtime.getURL(NEWTAB_PATH) + query
      : chrome.runtime.getURL(NEWTAB_PATH);
    chrome.tabs.create({ url });
  };

  const addCurrentPage = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.url && !tab.url.startsWith('chrome://')) {
        const q = new URLSearchParams({ add: '1', url: tab.url, title: tab.title ?? '' });
        openNewTab('?' + q.toString());
      }
    });
  };

  return (
    <div className="p-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-[13px]">
      <h1 className="text-sm font-semibold mb-2.5 text-primary-600">LinkHub</h1>
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => openNewTab()}
          className="w-full py-1.5 px-2.5 rounded-lg text-xs bg-primary-600 hover:bg-primary-700 text-white font-medium"
        >
          Mở trang Dấu trang
        </button>
        <button
          type="button"
          onClick={addCurrentPage}
          className="w-full py-1.5 px-2.5 rounded-lg text-xs border border-primary-600 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 font-medium"
        >
          Thêm trang này
        </button>
      </div>
    </div>
  );
}
