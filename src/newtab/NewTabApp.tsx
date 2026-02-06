import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SettingsProvider } from '../contexts/SettingsContext';
import { useAuth } from '../hooks/useAuth';
import Dashboard from '../pages/Dashboard';
import Login from '../pages/Login';
import Register from '../pages/Register';

export default function NewTabApp() {
  const { session, loading } = useAuth();
  const [addParams, setAddParams] = useState<{ url: string; title: string } | null>(null);
  const [openAuthenticator, setOpenAuthenticator] = useState(false);
  const [openItTools, setOpenItTools] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('add') === '1') {
      setAddParams({
        url: params.get('url') ?? '',
        title: params.get('title') ?? '',
      });
    }
    if (params.get('open') === 'authenticator') setOpenAuthenticator(true);
    if (params.get('open') === 'it-tools') setOpenItTools(true);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse text-gray-500">Đang tải...</div>
      </div>
    );
  }

  return (
    <SettingsProvider>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={session ? <Navigate to="/" replace /> : <Register />} />
        <Route
          path="/"
          element={
            session ? (
              <Dashboard
                initialAddBookmark={addParams ?? undefined}
                initialOpenAuthenticator={openAuthenticator}
                initialOpenItTools={openItTools}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SettingsProvider>
  );
}
