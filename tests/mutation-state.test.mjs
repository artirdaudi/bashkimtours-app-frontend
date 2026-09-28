import assert from "node:assert/strict";
import test from "node:test";
import { getMutationCount, runMutation, subscribeMutations } from "../src/api/mutationState.js";

test("identical pending mutations share one request and clear after success", async () => {
  let calls = 0;
  let finish;
  const snapshots = [];
  const unsubscribe = subscribeMutations(() => snapshots.push(getMutationCount()));
  const request = () => {
    calls += 1;
    return new Promise((resolve) => { finish = resolve; });
  };

  const first = runMutation("POST:/students:{}", request);
  const second = runMutation("POST:/students:{}", request);
  assert.equal(first, second);
  assert.equal(calls, 1);
  assert.equal(getMutationCount(), 1);

  finish({ id: 12 });
  assert.deepEqual(await Promise.all([first, second]), [{ id: 12 }, { id: 12 }]);
  assert.equal(getMutationCount(), 0);
  assert.deepEqual(snapshots, [1, 0]);
  unsubscribe();
});

test("failed mutations release the busy state for retry", async () => {
  await assert.rejects(runMutation("POST:/retry", () => Promise.reject(new Error("offline"))), /offline/);
  assert.equal(getMutationCount(), 0);
  assert.equal(await runMutation("POST:/retry", () => Promise.resolve("saved")), "saved");
  assert.equal(getMutationCount(), 0);
});
