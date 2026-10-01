import test from "node:test";
import assert from "node:assert/strict";
import { summarizeBatchMessages } from "../src/whatsappBatchStats.js";

test("later webhook milestones remain counted as sent and delivered", () => {
  const counts = summarizeBatchMessages([
    { status: "READ", read_at: "2026-10-01T10:00:00Z" },
    { status: "READ" },
    { status: "DELIVERED", delivered_at: "2026-10-01T10:01:00Z" },
  ]);
  assert.deepEqual(counts, { total: 3, sent: 3, delivered: 3, read: 2, failed: 0, pending: 0, accepted: 0 });
});

test("failed after sent can contribute to both milestone counts", () => {
  const counts = summarizeBatchMessages([
    { status: "FAILED", sent_at: "2026-10-01T10:00:00Z", failed_at: "2026-10-01T10:02:00Z" },
    { status: "FAILED", failed_at: "2026-10-01T10:03:00Z" },
  ]);
  assert.equal(counts.total, 2);
  assert.equal(counts.sent, 1);
  assert.equal(counts.failed, 2);
});
