import React from 'react';
import ReactDOM from 'react-dom/client';
import { SettingsProvider } from '../contexts/SettingsContext';
import PopupApp from './PopupApp';
import '../styles/globals.css';
import './popup.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsProvider>
      <PopupApp />
    </SettingsProvider>
  </React.StrictMode>
);
