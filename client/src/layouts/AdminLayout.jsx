import Sidebar from "../components/admin/Sidebar";
import Header from "../components/admin/Header";

// Pass userEmail + onLogout from your auth context once implemented
export default function AdminLayout({ children, userEmail, onLogout }) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar — fixed, 256px wide */}
      <Sidebar />

      {/* Main content — offset by sidebar width on large screens */}
      <div className="flex flex-col flex-1 lg:ml-64 min-h-screen overflow-x-hidden">
        <Header userEmail={userEmail} onLogout={onLogout} />
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
