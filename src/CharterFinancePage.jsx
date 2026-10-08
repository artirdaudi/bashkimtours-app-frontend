import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Printer, RefreshCw, Search } from "lucide-react";
import { charterPaymentsApi, chartersApi } from "./api";
import DateInput from "./DateInput";
import bashkimToursLogo from "./assets/bashkimtours_logo.png";
import CharterPaymentReceipt from "./CharterPaymentReceipt";
import { charterAmountInEUR, charterCurrency, formatCharterMoney, MKD_PER_EUR } from "./charterCurrency";

const billingType = (value) => ({ CASH: "Kesh", INVOICE: "Faturë" })[value] || "—";
const dateTime = (value) => value ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value)) : "—";
const localDateKey = (value) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};
const dateOnly = (value) => { const key = localDateKey(value); return key ? key.split("-").reverse().join("/") : "—"; };
const localToday = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};
function rangeFor(period, day, month, year) {
  if (period === "day") return [day, day];
  if (period === "month") {
    const [y, m] = month.split("-").map(Number);
    return [`${month}-01`, `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`];
  }
  return [`${year}-01-01`, `${year}-12-31`];
}
async function loadAllCharters() {
  const all = [];
  let batch;
  do {
    batch = await chartersApi.list({ limit: 1000, offset: all.length });
    all.push(...batch);
  } while (batch.length === 1000);
  return all;
}
async function loadAllPayments(charters) {
  const results = [];
  let failed = 0;
  for (let start = 0; start < charters.length; start += 6) {
    const batch = await Promise.allSettled(charters.slice(start, start + 6).map(async (charter) => {
      const response = await charterPaymentsApi.list(charter.id);
      return (response.items || []).map((payment) => ({ ...payment, charter }));
    }));
    for (const result of batch) {
      if (result.status === "fulfilled") results.push(...result.value);
      else failed += 1;
    }
  }
  if (failed === charters.length && failed > 0) throw new Error("Pagesat e charterëve nuk mund të ngarkohen.");
  return { items: results, failed };
}

export default function CharterFinancePage() {
  const today = localToday();
  const [period, setPeriod] = useState("day");
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, setYear] = useState(today.slice(0, 4));
  const [search, setSearch] = useState("");
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [failedCharters, setFailedCharters] = useState(0);
  const [printing, setPrinting] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const all = await loadAllCharters();
      const paymentResult = await loadAllPayments(all);
      setPayments(paymentResult.items);
      setFailedCharters(paymentResult.failed);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const request = window.setTimeout(load, 0); return () => window.clearTimeout(request); }, [load]);
  useEffect(() => {
    if (!printing && !receipt) return undefined;
    const finish = () => { setPrinting(false); setReceipt(null); };
    window.addEventListener("afterprint", finish, { once: true });
    const request = window.setTimeout(() => window.print(), 120);
    return () => { window.clearTimeout(request); window.removeEventListener("afterprint", finish); };
  }, [printing, receipt]);

  const remainingByPayment = useMemo(() => {
    const byCharter = new Map();
    for (const payment of payments) {
      if (!byCharter.has(payment.charter_id)) byCharter.set(payment.charter_id, []);
      byCharter.get(payment.charter_id).push(payment);
    }
    const remaining = new Map();
    for (const history of byCharter.values()) {
      history.sort((a, b) => new Date(a.created_at || a.payment_date) - new Date(b.created_at || b.payment_date) || Number(a.id) - Number(b.id));
      const charter = history[0].charter;
      const recordedTotal = history.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      let paid = Math.max(0, Number(charter.paid_amount || 0) - recordedTotal);
      for (const payment of history) {
        paid += Number(payment.amount || 0);
        remaining.set(payment.id, Math.max(0, Number(charter.price || 0) - paid));
      }
    }
    return remaining;
  }, [payments]);

  const [from, to] = rangeFor(period, day, month, year);
  const groups = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("sq-AL");
    const filtered = payments.filter((payment) => {
      const paymentDay = localDateKey(payment.payment_date);
      if (paymentDay < from || paymentDay > to) return false;
      if (!term) return true;
      return [payment.charter.contractor, payment.charter.route, billingType(payment.charter.billing_type), payment.comment, payment.created_by_user?.username]
        .some((value) => String(value || "").toLocaleLowerCase("sq-AL").includes(term));
    });
    const byUser = new Map();
    for (const payment of filtered) {
      const username = payment.created_by_user?.username || "Përdorues i panjohur";
      if (!byUser.has(username)) byUser.set(username, []);
      byUser.get(username).push(payment);
    }
    return [...byUser.entries()].map(([username, items]) => ({
      username,
      items: items.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)),
      totalEUR: items.reduce((sum, item) => sum + charterAmountInEUR(item), 0),
    })).sort((a, b) => a.username.localeCompare(b.username));
  }, [payments, from, to, search]);
  const visibleCount = groups.reduce((sum, group) => sum + group.items.length, 0);
  const visibleTotalEUR = groups.reduce((sum, group) => sum + group.totalEUR, 0);

  return <div className="bt-page bt-ops-page bt-payments-page bt-charter-payments-page">
    <header className="bt-page-header"><div><span className="bt-eyebrow">Bashkim Tours · Charterët</span><h1>Pagesat</h1><p>Pagesat ditore, mujore dhe vjetore të ndara sipas përdoruesit.</p></div><button type="button" className="bt-btn-secondary" disabled={loading || !groups.length} onClick={() => setPrinting(true)}><Printer /> Printo listën</button></header>
    <div className="bt-payments-controls"><div className="bt-period-tabs" aria-label="Periudha e pagesave"><button type="button" className={period === "day" ? "active" : ""} onClick={() => setPeriod("day")}>Ditore</button><button type="button" className={period === "month" ? "active" : ""} onClick={() => setPeriod("month")}>Mujore</button><button type="button" className={period === "year" ? "active" : ""} onClick={() => setPeriod("year")}>Vjetore</button></div><label className="bt-payment-period-input"><CalendarDays />{period === "day" && <DateInput value={day} onChange={setDay} required />}{period === "month" && <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />}{period === "year" && <input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} />}</label><label className="bt-payment-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kërko porositës, relacion ose përdorues…" /></label></div>
    <p className="bt-payment-filter-range">Periudha: {dateOnly(from)} – {dateOnly(to)}</p>
    {!loading && !error && <section className="bt-payments-summary"><article><span>Pagesa</span><strong>{visibleCount}</strong></article><article><span>Shuma totale (EUR)</span><strong>{formatCharterMoney(visibleTotalEUR)}</strong></article><article><span>Përdorues</span><strong>{groups.length}</strong></article></section>}
    {!loading && !error && <p className="bt-payment-filter-range">Pagesat në MKD llogariten me kursin 1 EUR = {MKD_PER_EUR} MKD.</p>}
    {!loading && !error && failedCharters > 0 && <p className="bt-inline-error" role="status">Pagesat për {failedCharters} charterë nuk u ngarkuan. Lista mund të jetë e paplotë.</p>}
    {loading ? <div className="bt-state-message"><RefreshCw className="bt-spin" /> Duke ngarkuar pagesat…</div> : error ? <p className="bt-inline-error" role="alert">{error}</p> : groups.length ? <div className="bt-payment-user-groups">{groups.map((group) => <section key={group.username} className="bt-payment-user-group"><header><div><span>Regjistruar nga</span><h2>{group.username}</h2></div><div><strong>{formatCharterMoney(group.totalEUR)}</strong><span>{group.items.length} pagesa</span></div></header><div className="bt-history-table-wrap"><table className="bt-history-table bt-payments-table bt-charter-payments-table"><thead><tr><th>Data</th><th>Porositësi</th><th>Relacioni</th><th>Faturimi</th><th>Shuma</th><th>Regjistruar më</th><th>Komenti</th><th aria-label="Veprimet" /></tr></thead><tbody>{group.items.map((payment) => <tr key={payment.id}><td><strong>{dateOnly(payment.payment_date)}</strong></td><td><strong>{payment.charter.contractor || `Charter ${payment.charter_id}`}</strong></td><td>{payment.charter.route || "—"}</td><td><span className={`bt-charter-billing-type ${payment.charter.billing_type === "CASH" ? "cash" : "invoice"}`}>{billingType(payment.charter.billing_type)}</span></td><td><strong>{formatCharterMoney(payment.amount, charterCurrency(payment))}</strong>{charterCurrency(payment) === "MKD" && <small> ≈ {formatCharterMoney(charterAmountInEUR(payment))}</small>}</td><td>{dateTime(payment.created_at)}</td><td>{payment.comment || "—"}</td><td><button type="button" className="bt-history-print-button" title="Printo vërtetimin" aria-label={`Printo vërtetimin e pagesës #${payment.id}`} onClick={() => setReceipt({ charter: payment.charter, payment, remaining: remainingByPayment.get(payment.id) })}><Printer /></button></td></tr>)}</tbody></table></div></section>)}</div> : <div className="bt-empty-state"><CalendarDays /><h3>Nuk ka pagesa</h3><p>Nuk u gjetën pagesa për periudhën e zgjedhur.</p></div>}
    {receipt && <CharterPaymentReceipt {...receipt} />}
    {printing && <div className="bt-print-sheet bt-payments-list-print"><header><img src={bashkimToursLogo} alt="Bashkim Tours" /><div><strong>Bashkim Tours</strong><span>Dervish Cara Nr. 4 · 1200 Tetovë, Maqedoni</span><span>+389 44 338 003 · +389 75 312 015</span></div></header><div className="bt-print-title"><div><h1>Lista e pagesave · Charterët</h1><p>{dateOnly(from)} – {dateOnly(to)}</p></div><span>Shuma totale: <strong>{formatCharterMoney(visibleTotalEUR)}</strong><br />1 EUR = {MKD_PER_EUR} MKD</span></div>{groups.map((group) => <section className="bt-print-section" key={group.username}><h2>{group.username}<span>{group.items.length} pagesa · {formatCharterMoney(group.totalEUR)}</span></h2><table><thead><tr><th>Data</th><th>Porositësi</th><th>Relacioni</th><th>Faturimi</th><th>Shuma</th><th>Regjistruar më</th><th>Komenti</th></tr></thead><tbody>{group.items.map((payment) => <tr key={payment.id}><td>{dateOnly(payment.payment_date)}</td><td>{payment.charter.contractor || `Charter ${payment.charter_id}`}</td><td>{payment.charter.route || "—"}</td><td>{billingType(payment.charter.billing_type)}</td><td>{formatCharterMoney(payment.amount, charterCurrency(payment))}{charterCurrency(payment) === "MKD" && ` ≈ ${formatCharterMoney(charterAmountInEUR(payment))}`}</td><td>{dateTime(payment.created_at)}</td><td>{payment.comment || "—"}</td></tr>)}</tbody></table></section>)}</div>}
  </div>;
}
