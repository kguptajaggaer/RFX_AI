export type ConfidenceLabel = "high" | "medium" | "low" | "not_found" | "ambiguous" | "conflicted";

export function scoreToLabel(score: number): ConfidenceLabel {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  if (score > 0) return "low";
  return "not_found";
}

export function isAwardBlocking(
  label: ConfidenceLabel,
  isPriceField: boolean
): boolean {
  if (!isPriceField) return false;
  return label === "low" || label === "not_found" || label === "conflicted";
}

export const CONFIDENCE_COLORS: Record<ConfidenceLabel, string> = {
  high: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-red-100 text-red-800 border-red-200",
  not_found: "bg-gray-100 text-gray-500 border-gray-200",
  ambiguous: "bg-orange-100 text-orange-800 border-orange-200",
  conflicted: "bg-purple-100 text-purple-800 border-purple-200",
};

export const CONFIDENCE_LABELS: Record<ConfidenceLabel, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
  not_found: "Not found",
  ambiguous: "Ambiguous",
  conflicted: "Conflicted",
};
