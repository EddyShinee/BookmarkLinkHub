import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SettingsProvider, useSettings } from '../contexts/SettingsContext';
import { getT } from '../lib/i18n';
import { useAuth } from '../hooks/useAuth';
import Dashboard from '../pages/Dashboard';
import Login from '../pages/Login';
import Register from '../pages/Register';
import EmailConfirmed from '../pages/EmailConfirmed';
import Landing from '../pages/Landing';
import PrivacyPolicy from '../pages/PrivacyPolicy';
import TermsOfService from '../pages/TermsOfService';
import Support from '../pages/Support';

interface HomeRouteProps {
  initialAddBookmark: { url: string; title: string } | null;
  initialOpenAuthenticator: boolean;
  initialOpenItTools: boolean;
  initialOpenSettings: boolean;
}

function HomeRoute({
  initialAddBookmark,
  initialOpenAuthenticator,
  initialOpenItTools,
  initialOpenSettings,
}: HomeRouteProps) {
  const { startOnLanding } = useSettings();
  const location = useLocation();

  // Nếu có tham số đặc biệt (add bookmark / mở modal), luôn vào Dashboard
  const search = location.search;
  const forceDashboard = search.includes('add=1') || search.includes('open=');

  if (forceDashboard || !startOnLanding) {
    return (
      <Dashboard
        initialAddBookmark={initialAddBookmark ?? undefined}
        initialOpenAuthenticator={initialOpenAuthenticator}
        initialOpenItTools={initialOpenItTools}
        initialOpenSettings={initialOpenSettings}
      />
    );
  }

  return <Landing />;
}

export default function NewTabApp() {
  const { session, loading } = useAuth();
  const [addParams, setAddParams] = useState<{ url: string; title: string } | null>(null);
  const [openAuthenticator, setOpenAuthenticator] = useState(false);
  const [openItTools, setOpenItTools] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);

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
    if (params.get('open') === 'settings') setOpenSettings(true);
  }, []);

  if (loading) {
    // Use default language (vi) while auth is loading; NewTabApp is not yet wrapped in SettingsProvider here.
    const t = getT('vi');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse text-gray-500">{t.loadingAuth}</div>
      </div>
    );
  }

  return (
    <SettingsProvider>
      <Routes>
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/support" element={<Support />} />
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={session ? <Navigate to="/" replace /> : <Register />} />
        <Route path="/email-confirmed" element={<EmailConfirmed />} />
        <Route
          path="/"
          element={
            session ? (
              <HomeRoute
                initialAddBookmark={addParams}
                initialOpenAuthenticator={openAuthenticator}
                initialOpenItTools={openItTools}
                initialOpenSettings={openSettings}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/bookmarks"
          element={
            session ? (
              <Dashboard
                initialAddBookmark={addParams ?? undefined}
                initialOpenAuthenticator={openAuthenticator}
                initialOpenItTools={openItTools}
                initialOpenSettings={openSettings}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/landing"
          element={session ? <Landing /> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SettingsProvider>
  );
}
