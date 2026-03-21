import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Volume2,
  Bell,
  Map,
  Droplets,
  MapPin,
  Package,
  Users,
  Menu,
  X,
  Dam,
  InfoIcon,
  HandHelpingIcon,
} from "lucide-react";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Bell, label: "Alerts", href: "/alerts" },
  { icon: Volume2, label: "Reports", href: "/reports" },
  { icon: Map, label: "Hazard Map", href: "/hazard-map" },
  { icon: MapPin, label: "Evacuation Centers", href: "/evacuation" },
  { icon: Package, label: "Resources", href: "/resources" },
  {
    icon: HandHelpingIcon,
    label: "Community Sharing",
    href: "/community-sharing",
  },
  { icon: InfoIcon, label: "Safety Tips", href: "/safety-tips" },
  {
    icon: Users,
    label: "Manage Users",
    href: "/manage-users",
    adminOnly: true,
  },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const userRole = localStorage.getItem("user")
    ? JSON.parse(localStorage.getItem("user")).role
    : null;

  const visibleMenuItems = menuItems.filter(
    (item) => !item.adminOnly || userRole === "admin",
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-white shadow-lg"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          "fixed top-0 left-0 z-40 h-screen transition-transform lg:translate-x-0",
          "w-64 bg-white border-r border-gray-200",
          isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="h-full px-3 py-4 overflow-y-auto">
          {/* Logo */}
          <div className="mb-8 px-3">
            <h1 className="text-2xl font-bold text-red-600">E-Telly</h1>
            <p className="text-xs text-gray-500 mt-1">Admin Dashboard</p>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={[
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm",
                    isActive
                      ? "bg-blue-50 text-red-600 font-medium"
                      : "text-gray-700 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
