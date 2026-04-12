import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./layouts/AdminLayout";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AlertsPage from "./pages/AlertsPage";
import HazardMapPage from "./pages/HazardMapPage";
import EvacuationPage from "./pages/EvacuationPage";
import CommunitySharingPage from "./pages/CommunitySharingPage";
import SafetyTipsPage from "./pages/SafetyTipsPage";
import ResourcesPage from "./pages/ResourcesPage";
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
          path="/resources"
          element={<ProtectedLayout Page={ResourcesPage} />}
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
