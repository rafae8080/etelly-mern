import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import ResourcesPage from "./pages/ResourcesPage";
import ManageUsersPage from "./pages/ManageUsersPage";
import ReportsPage from "./pages/ReportPage";

// ---- START OF TEST CODE — delete from here ----
import { usePushNotifications } from "./hooks/usePushNotifications";
function PushTestPage() {
  const { permission, subscribed, loading, isSupported, subscribe, unsubscribe } =
    usePushNotifications();
  const sendTest = () =>
    fetch("/api/push/test", { method: "POST" }).then((r) => r.json()).then(alert);
  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h2>Push Notification Test</h2>
      <p>Supported: {String(isSupported)}</p>
      <p>Permission: {permission}</p>
      <p>Subscribed: {String(subscribed)}</p>
      <br />
      <button onClick={subscribed ? unsubscribe : subscribe} disabled={loading}
        style={{ marginRight: 12, padding: "8px 16px" }}>
        {loading ? "..." : subscribed ? "Unsubscribe" : "Subscribe"}
      </button>
      <button onClick={sendTest} disabled={!subscribed}
        style={{ padding: "8px 16px", background: subscribed ? "#3b82f6" : "#ccc", color: "#fff" }}>
        Send Test Push
      </button>
      {!subscribed && <p style={{ color: "gray", marginTop: 8 }}>Subscribe first, then send test.</p>}
    </div>
  );
}
// ---- END OF TEST CODE — delete up to here ----

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
          path="/resources"
          element={<ProtectedLayout Page={ResourcesPage} />}
        />
        <Route
          path="/manage-users"
          element={<ProtectedLayout Page={ManageUsersPage} />}
        />

        {/* ---- START OF TEST ROUTE — delete this line */}
        <Route path="/push-test" element={<PushTestPage />} />
        {/* ---- END OF TEST ROUTE — delete up to here */}

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
