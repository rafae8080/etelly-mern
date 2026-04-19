import { AlertTriangle, Eye, Zap } from "lucide-react";

// ─── Severity icon ─────────────────────────────────────────────────────────────

export default function SeverityIcon({ severity, size = 16 }) {
  if (severity === "evacuate" || severity === "critical")
    return <AlertTriangle size={size} />;
  if (severity === "warning") return <Zap size={size} />;
  return <Eye size={size} />;
}
