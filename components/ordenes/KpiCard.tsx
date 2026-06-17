import { TrendingUp, ShoppingCart, FileText, FileCheck, Percent } from "lucide-react";
import { formatMXN, formatUSD } from "@/lib/utils";

type KpiVariant = "ventas" | "pipeline" | "conversion" | "borradores" | "totales";

interface KpiCardProps {
  variant: KpiVariant;
  value: number;
  label: string;
  sublabel?: string;
  extraMXN?: number;
  extraUSD?: number;
  formatAsCurrency?: boolean;
}

const VARIANT_CONFIG: Record<
  KpiVariant,
  { icon: React.ElementType; iconBg: string; iconColor: string; valueColor: string }
> = {
  ventas: {
    icon: TrendingUp,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    valueColor: "text-green-700",
  },
  pipeline: {
    icon: FileCheck,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    valueColor: "text-blue-700",
  },
  conversion: {
    icon: Percent,
    iconBg: "bg-orange-100",
    iconColor: "text-orange",
    valueColor: "text-orange",
  },
  borradores: {
    icon: FileText,
    iconBg: "bg-gray-100",
    iconColor: "text-gray-500",
    valueColor: "text-gray-700",
  },
  totales: {
    icon: ShoppingCart,
    iconBg: "bg-navy/10",
    iconColor: "text-navy",
    valueColor: "text-navy",
  },
};

export default function KpiCard({
  variant,
  value,
  label,
  sublabel,
  extraMXN,
  extraUSD,
  formatAsCurrency = false,
}: KpiCardProps) {
  const { icon: Icon, iconBg, iconColor, valueColor } = VARIANT_CONFIG[variant];

  const formattedValue =
    formatAsCurrency || variant === "ventas" || variant === "pipeline"
      ? formatMXN(value)
      : variant === "conversion"
      ? `${value}%`
      : String(value);

  return (
    <div className="kpi-card flex items-start gap-4">
      <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
        <Icon size={20} className={iconColor} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xl font-bold leading-tight ${valueColor}`}>{formattedValue}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
        {(extraMXN !== undefined || extraUSD !== undefined) && (
          <div className="mt-1.5 space-y-0.5">
            {extraMXN !== undefined && extraMXN > 0 && (
              <p className="text-xs text-gray-600">
                <span className="font-medium">{formatMXN(extraMXN)}</span>{" "}
                <span className="text-gray-400">MXN</span>
              </p>
            )}
            {extraUSD !== undefined && extraUSD > 0 && (
              <p className="text-xs text-gray-600">
                <span className="font-medium">{formatUSD(extraUSD)}</span>{" "}
                <span className="text-gray-400">USD</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
