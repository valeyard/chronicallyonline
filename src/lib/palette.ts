// Single brand hue used for every magnitude chart (leaderboard bars, trend
// bars, table swatches). Bars are sorted by daily rank, so any two
// politicians can end up adjacent — a per-entity categorical palette would
// need to be pairwise-distinguishable for all 6, which the validated
// 8-hue set only guarantees for 3 (see dataviz skill palette.md). Every row
// already carries a full name label, so color isn't the identity channel
// here; one validated hue avoids the collision entirely.
export const SERIES_COLOR = { light: "#2a78d6", dark: "#3987e5" };

// Per-party identity colors for the trend-lines chart, where each politician
// keeps one fixed line/color for the life of the chart (never re-sorted the
// way leaderboard bars are), so a categorical assignment is the right tool
// here — unlike SERIES_COLOR above. Real party hex codes fail the CVD
// validator hard (Green vs Lib Dem orange: ΔE 3.3 protan, deep in FAIL
// territory; SNP yellow also fails contrast). These are the closest
// same-hue-family stand-ins from the dataviz skill's validated 8-hue set,
// reordered so no two adjacent-in-legend colors clash — validated with
// scripts/validate_palette.js against both light and dark surfaces (all
// PASS; two CVD checks land in the 6-8 WARN band, which is why the trend
// chart also carries a legend, a hover tooltip, and a table fallback rather
// than relying on color alone).
export const PARTY_COLOR: Record<string, { light: string; dark: string }> = {
  Labour: { light: "#e34948", dark: "#e66767" },
  Conservative: { light: "#2a78d6", dark: "#3987e5" },
  "Liberal Democrats": { light: "#eb6834", dark: "#d95926" },
  "Reform UK": { light: "#1baf7a", dark: "#199e70" },
  SNP: { light: "#eda100", dark: "#c98500" },
  Green: { light: "#008300", dark: "#008300" },
};
