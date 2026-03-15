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

// ✅ Redirect to dashboard if already logged in
function PublicRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? <Navigate to="/dashboard" replace /> : children;
}

// ✅ Redirect to login if NOT logged in
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const userEmail = localStorage.getItem("user")
    ? JSON.parse(localStorage.getItem("user")).email
    : "";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  const withLayout = (Page) => (
    <ProtectedRoute>
      <AdminLayout userEmail={userEmail} onLogout={handleLogout}>
        <Page />
      </AdminLayout>
    </ProtectedRoute>
  );

  return (
    <BrowserRouter>
      <Routes>
        {/* Root → login or dashboard depending on auth */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public — if already logged in, go to dashboard */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        {/* Protected admin pages */}
        <Route path="/dashboard" element={withLayout(DashboardPage)} />
        <Route path="/alerts" element={withLayout(AlertsPage)} />
        <Route path="/hazard-map" element={withLayout(HazardMapPage)} />
        <Route path="/evacuation" element={withLayout(EvacuationPage)} />
        <Route
          path="/community-sharing"
          element={withLayout(CommunitySharingPage)}
        />
        <Route path="/safety-tips" element={withLayout(SafetyTipsPage)} />
        <Route path="/resources" element={withLayout(ResourcesPage)} />
        <Route path="/manage-users" element={withLayout(ManageUsersPage)} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
