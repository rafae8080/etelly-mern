import DashboardCard from "../components/admin/DashboardCard";
import {
  Bell,
  Map,
  Waves,
  MapPin,
  Package,
  Users,
  Volume2,
  Dam,
  InfoIcon,
  HandHelpingIcon,
} from "lucide-react";

const modules = [
  {
    title: "Alerts",
    description: "Manage disaster alerts and view reports",
    icon: Bell,
    href: "/alerts",
    color: "bg-red-600",
  },
  {
    title: "Reports",
    description: "Manage disaster alerts and view reports",
    icon: Volume2,
    href: "/reports",
    color: "bg-blue-800",
  },
  {
    title: "Hazard Mapping",
    description: "Manual confirm hazard incidents",
    icon: Map,
    href: "/hazard-map",
    color: "bg-orange-500",
  },
  {
    title: "Evacuation Centers",
    description: "Manage evacuation center locations",
    icon: MapPin,
    href: "/evacuation",
    color: "bg-green-500",
  },
  {
    title: "Resources",
    description: "Track resource inventory and updates",
    icon: Package,
    href: "/resources",
    color: "bg-yellow-500",
  },
  {
    title: "Community Sharing",
    description: "Manage community resource sharing",
    icon: HandHelpingIcon,
    href: "/community-sharing",
    color: "bg-purple-600",
  },
  {
    title: "Safety Tips",
    description: "Manage safety tips and guidelines",
    icon: InfoIcon,
    href: "/safety-tips",
    color: "bg-indigo-700",
  },
  {
    title: "Manage Users",
    description: "Manage user accounts and permissions",
    icon: Users,
    href: "/manage-users",
    color: "bg-gray-600",
    adminOnly: true,
  },
];

export default function DashboardPage() {
  const userRole = localStorage.getItem("user")
    ? JSON.parse(localStorage.getItem("user")).role
    : null;

  const visibleModules = modules.filter(
    (module) => !module.adminOnly || userRole === "admin",
  );

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-600 mt-2">
          Welcome to E-Telly Admin Dashboard — Disaster Preparedness & Community
          Resource Management
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Total Active Alerts</p>
          <p className="text-3xl font-bold text-gray-900">3</p>
          <p className="text-sm text-blue-600 mt-2">↑ 2 new today</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Pending Requests</p>
          <p className="text-3xl font-bold text-gray-900">24</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Dam Level</p>
          <p className="text-3xl font-bold text-gray-900">68.67 M</p>
        </div>
      </div>

      {/* Module Cards */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleModules.map((module) => (
            <DashboardCard key={module.href} {...module} />
          ))}
        </div>
      </div>
    </div>
  );
}
