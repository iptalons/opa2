
export const API_BASE = "https://api.openalex.org";
export const MAILTO = "developer@iptalons.com";
export const CURRENT_YEAR = new Date().getFullYear();

export const OA_COLORS: Record<string, string> = {
  closed: "#94A3B8",
  green: "#22C55E",
  gold: "#EAB308",
  hybrid: "#A855F7",
  bronze: "#F59E0B",
  diamond: "#06B6D4",
  unknown: "#64748B",
};

export const PALETTE = [
  "#22C55E",
  "#EAB308",
  "#A855F7",
  "#06B6D4",
  "#F59E0B",
  "#F97316",
  "#3B82F6",
  "#10B981",
  "#EF4444",
  "#6366F1",
];

export const RISK_CHIP = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-rose-100 text-rose-800",
} as const;

export const RISK_HEX = { low: "#10B981", medium: "#F59E0B", high: "#EF4444" } as const;
