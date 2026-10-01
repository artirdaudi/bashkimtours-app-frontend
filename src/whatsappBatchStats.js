export function summarizeBatchMessages(items) {
  return {
    total: items.length,
    sent: items.filter((item) => item.sent_at || item.delivered_at || item.read_at || ["SENT", "DELIVERED", "READ"].includes(item.status)).length,
    delivered: items.filter((item) => item.delivered_at || item.read_at || ["DELIVERED", "READ"].includes(item.status)).length,
    read: items.filter((item) => item.read_at || item.status === "READ").length,
    failed: items.filter((item) => item.failed_at || item.status === "FAILED").length,
    pending: items.filter((item) => item.status === "PENDING").length,
    accepted: items.filter((item) => item.status === "ACCEPTED").length,
  };
}
