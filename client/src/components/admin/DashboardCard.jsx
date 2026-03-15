import { Link } from "react-router-dom";

export default function DashboardCard({
  title,
  description,
  icon: Icon,
  href,
  color,
  count,
}) {
  return (
    <Link
      to={href}
      className="block p-6 bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all hover:-translate-y-1"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
        {count !== undefined && (
          <span className="text-2xl font-bold text-gray-900">{count}</span>
        )}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </Link>
  );
}
