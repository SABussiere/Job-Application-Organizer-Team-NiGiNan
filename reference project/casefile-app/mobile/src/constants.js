export const STAGES = ["applied", "interview", "offer", "rejected"];

export const STAGE_META = {
  applied: { label: "Applied", color: "#3A5A78" },
  interview: { label: "Interview", color: "#6B8F71" },
  offer: { label: "Offer", color: "#C89B3C" },
  rejected: { label: "Rejected", color: "#A8503A" }
};

export const COLORS = {
  navy: "#1B2430",
  navy2: "#263241",
  manila: "#E8DCC0",
  manilaDark: "#d8c9a0",
  paper: "#F7F3E8",
  ink: "#2A2118",
  muted: "#786d59",
  offer: "#C89B3C"
};

export function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
