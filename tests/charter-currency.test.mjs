import assert from "node:assert/strict";
import test from "node:test";
import { charterAmountInEUR, charterCurrency, totalsByCurrency } from "../src/charterCurrency.js";

test("charter payments convert MKD to EUR at 61.5 for income totals", () => {
  const payments = [
    { amount: "100.00", currency: "EUR" },
    { amount: "6150.00", currency: "MKD" },
    { amount: "25.50", currency: "EUR" },
  ];
  assert.deepEqual(totalsByCurrency(payments), { EUR: 125.5, MKD: 6150 });
  assert.equal(charterCurrency({ currency: "MKD" }), "MKD");
  assert.equal(payments.reduce((sum, payment) => sum + charterAmountInEUR(payment), 0), 225.5);
});
