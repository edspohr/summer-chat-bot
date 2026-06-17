// Phase 0 stub. Full implementation as needed.

export function formatTimestamp(timestamp: unknown): string {
  if (timestamp === null || timestamp === undefined) return "";
  if (
    typeof timestamp === "object" &&
    "toDate" in timestamp &&
    typeof (timestamp as { toDate: unknown }).toDate === "function"
  ) {
    return ((timestamp as { toDate: () => Date }).toDate()).toLocaleString(
      "es-CL"
    );
  }
  return String(timestamp);
}
