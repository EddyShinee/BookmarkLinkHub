import React from 'react';
import ReactDOM from 'react-dom/client';
import { SettingsProvider } from '../contexts/SettingsContext';
import { prefetchFontStyles } from '../lib/fontCache';
import PopupApp from './PopupApp';
import '../styles/globals.css';
import './popup.css';

prefetchFontStyles([
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@24,400,0&display=swap',
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsProvider>
      <PopupApp />
    </SettingsProvider>
  </React.StrictMode>
);
