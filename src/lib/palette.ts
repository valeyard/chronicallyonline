// Single brand hue used for every magnitude chart (leaderboard bars, trend
// bars, table swatches). Bars are sorted by daily rank, so any two
// politicians can end up adjacent — a per-entity categorical palette would
// need to be pairwise-distinguishable for all 6, which the validated
// 8-hue set only guarantees for 3 (see dataviz skill palette.md). Every row
// already carries a full name label, so color isn't the identity channel
// here; one validated hue avoids the collision entirely.
export const SERIES_COLOR = { light: "#2a78d6", dark: "#3987e5" };
