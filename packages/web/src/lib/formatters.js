// Phase 0 stub. Full implementation as needed.
export function formatTimestamp(timestamp) {
    if (timestamp === null || timestamp === undefined)
        return "";
    if (typeof timestamp === "object" &&
        "toDate" in timestamp &&
        typeof timestamp.toDate === "function") {
        return (timestamp.toDate()).toLocaleString("es-CL");
    }
    return String(timestamp);
}
