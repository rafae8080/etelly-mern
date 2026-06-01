import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import AdminLayout from "./layouts/AdminLayout";
import InstallPrompt from "./components/pwa/InstallPrompt";

import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import DashboardPage from "./pages/DashboardPage";
import AlertsPage from "./pages/AlertsPage";
import HazardMapPage from "./pages/HazardMapPage";
import EvacuationPage from "./pages/EvacuationPage";
import CommunitySharingPage from "./pages/CommunitySharingPage";
import SafetyTipsPage from "./pages/SafetyTipsPage";
import SafetyTipDetailPage from "./pages/SafetyTipDetailPage";
import ManageUsersPage from "./pages/ManageUsersPage";
import ReportsPage from "./pages/ReportPage";

// ── Token validation ───────────────────────────────────────────────────────────
// Checks both presence AND expiry of the JWT so stale dev-session tokens
// don't permanently bypass the login page.
function isTokenValid() {
  const token = localStorage.getItem("token");
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // exp is in seconds; Date.now() is in milliseconds
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      // Token is expired — clean up so we don't keep checking
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return false;
    }
    return true;
  } catch {
    // Token is malformed; treat as invalid
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    return false;
  }
}

// ── Route guards ──────────────────────────────────────────────────────────────

// Redirect to dashboard if already logged in (e.g. hitting /login again)
function PublicRoute({ children }) {
  return isTokenValid() ? <Navigate to="/dashboard" replace /> : children;
}

// Redirect to login if NOT logged in or token expired
function ProtectedRoute({ children }) {
  return isTokenValid() ? children : <Navigate to="/login" replace />;
}

// Auth required but no AdminLayout — used for /change-password
function AuthOnlyRoute({ Page }) {
  return isTokenValid() ? <Page /> : <Navigate to="/login" replace />;
}

// ── Session expiry warning banner ─────────────────────────────────────────────
function SessionExpiryBanner() {
  const [minutesLeft, setMinutesLeft] = useState(null);

  useEffect(() => {
    function check() {
      const token = localStorage.getItem("token");
      if (!token) return setMinutesLeft(null);
      try {
        const { exp } = JSON.parse(atob(token.split(".")[1]));
        if (!exp) return setMinutesLeft(null);
        const mins = Math.floor((exp * 1000 - Date.now()) / 60000);
        setMinutesLeft(mins <= 30 && mins > 0 ? mins : null);
      } catch {
        setMinutesLeft(null);
      }
    }
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, []);

  if (minutesLeft === null) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white text-sm font-medium px-4 py-2 flex items-center justify-between shadow-md">
      <span>Your session expires in {minutesLeft} minute{minutesLeft !== 1 ? "s" : ""}. Save your work and log in again to continue.</span>
      <a
        href="/login"
        onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("user"); }}
        className="ml-4 underline font-bold whitespace-nowrap hover:text-amber-100"
      >
        Log in again
      </a>
    </div>
  );
}

// ── Layout wrapper (moved outside App to prevent remounts on re-render) ───────
function ProtectedLayout({ Page }) {
  const userEmail = localStorage.getItem("user")
    ? JSON.parse(localStorage.getItem("user")).email
    : "";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <ProtectedRoute>
      <SessionExpiryBanner />
      <AdminLayout userEmail={userEmail} onLogout={handleLogout}>
        <Page />
      </AdminLayout>
    </ProtectedRoute>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <InstallPrompt />
      <Routes>
        {/* Root → login or dashboard depending on auth */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public — redirect to dashboard if already authenticated */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Auth required, no sidebar layout */}
        <Route
          path="/change-password"
          element={<AuthOnlyRoute Page={ChangePasswordPage} />}
        />

        {/* Protected pages */}
        <Route
          path="/dashboard"
          element={<ProtectedLayout Page={DashboardPage} />}
        />
        <Route path="/alerts" element={<ProtectedLayout Page={AlertsPage} />} />
        <Route
          path="/reports"
          element={<ProtectedLayout Page={ReportsPage} />}
        />
        <Route
          path="/hazard-map"
          element={<ProtectedLayout Page={HazardMapPage} />}
        />
        <Route
          path="/evacuation"
          element={<ProtectedLayout Page={EvacuationPage} />}
        />
        <Route
          path="/community-sharing"
          element={<ProtectedLayout Page={CommunitySharingPage} />}
        />
        <Route
          path="/safety-tips"
          element={<ProtectedLayout Page={SafetyTipsPage} />}
        />
        <Route
          path="/safety-tips/:slug"
          element={<ProtectedLayout Page={SafetyTipDetailPage} />}
        />
        <Route
          path="/manage-users"
          element={<ProtectedLayout Page={ManageUsersPage} />}
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
