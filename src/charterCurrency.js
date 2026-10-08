export const charterCurrency = (item) => item?.currency === "MKD" ? "MKD" : "EUR";

export const MKD_PER_EUR = 61.5;

export const charterAmountInEUR = (item) => {
  const amount = Number(item?.amount || 0);
  return charterCurrency(item) === "MKD" ? amount / MKD_PER_EUR : amount;
};

export const formatCharterMoney = (value, currency = "EUR") => value == null ? "—" :
  new Intl.NumberFormat("sq-AL", { style: "currency", currency: currency === "MKD" ? "MKD" : "EUR" }).format(Number(value));

export const totalsByCurrency = (items) => items.reduce((totals, item) => {
  const currency = charterCurrency(item);
  totals[currency] += Number(item.amount || 0);
  return totals;
}, { EUR: 0, MKD: 0 });

export const formatCurrencyTotals = (totals) => ["EUR", "MKD"]
  .filter((currency) => totals[currency] !== 0)
  .map((currency) => formatCharterMoney(totals[currency], currency))
  .join(" + ") || formatCharterMoney(0, "EUR");
