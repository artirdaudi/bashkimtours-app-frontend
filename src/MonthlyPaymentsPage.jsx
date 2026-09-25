import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Printer,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { monthlyPaymentsApi } from "./api";
import DateInput from "./DateInput";
import { formatDate, formatDateTime } from "./dateUtils";
import { PaymentReceipt } from "./StudentsPage";
import { groupRelatedMonthlyPayments } from "./monthlyPaymentGrouping";
import bashkimToursLogo from "./assets/bashkimtours_logo.png";

const localIsoDate = () => {
  const value = new Date();
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 10);
};

const displayDate = (value) => {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};

const displayDateTime = formatDateTime;

const money = (value) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));

const monthNames = [
  "Janar",
  "Shkurt",
  "Mars",
  "Prill",
  "Maj",
  "Qershor",
  "Korrik",
  "Gusht",
  "Shtator",
  "Tetor",
  "Nëntor",
  "Dhjetor",
];

function rangeFor(period, day, month, year) {
  if (period === "day") return [day, day];
  if (period === "month") {
    const [selectedYear, selectedMonth] = month.split("-").map(Number);
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    return [
      `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`,
      `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${lastDay}`,
    ];
  }
  return [`${year}-01-01`, `${year}-12-31`];
}

async function getAllPayments(params) {
  const first = await monthlyPaymentsApi.list({
    ...params,
    page: 1,
    page_size: 100,
    sort_by: "payment_date",
    sort_order: "desc",
  });
  if (first.total_pages <= 1) return first.items;
  const remaining = await Promise.all(
    Array.from({ length: first.total_pages - 1 }, (_, index) =>
      monthlyPaymentsApi.list({
        ...params,
        page: index + 2,
        page_size: 100,
        sort_by: "payment_date",
        sort_order: "desc",
      }),
    ),
  );
  return [first, ...remaining].flatMap((response) => response.items);
}

export default function MonthlyPaymentsPage() {
  const today = localIsoDate();
  const [period, setPeriod] = useState("day");
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, setYear] = useState(today.slice(0, 4));
  const [search, setSearch] = useState("");
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [receiptPayments, setReceiptPayments] = useState(null);
  const [printingList, setPrintingList] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [paymentDateFrom, paymentDateTo] = rangeFor(
      period,
      day,
      month,
      year,
    );
    try {
      const paymentItems = await getAllPayments({
        payment_date_from: paymentDateFrom,
        payment_date_to: paymentDateTo,
      });
      setPayments(paymentItems);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [period, day, month, year]);

  useEffect(() => {
    const request = window.setTimeout(load, 0);
    return () => window.clearTimeout(request);
  }, [load]);

  useEffect(() => {
    if (!receiptPayments && !printingList) return undefined;
    const finish = () => {
      setReceiptPayments(null);
      setPrintingList(false);
    };
    window.addEventListener("afterprint", finish, { once: true });
    const request = window.setTimeout(() => window.print(), 120);
    return () => {
      window.clearTimeout(request);
      window.removeEventListener("afterprint", finish);
    };
  }, [receiptPayments, printingList]);

  async function deletePaymentGroup(group) {
    const months = group.payments
      .map(
        (payment) =>
          monthNames[Number(payment.month) - 1] || payment.month_name,
      )
      .join(", ");
    const confirmed = window.confirm(
      `A jeni të sigurt që dëshironi ta fshini këtë pagesë${group.payments.length > 1 ? ` me ${group.payments.length} muaj` : ""}?\n\nMuajt: ${months}\nShuma: ${money(group.totalAmount)}\n\nPas fshirjes, detyrimet mujore përkatëse do të rikthehen në statusin Në pritje.`,
    );
    if (!confirmed) return;
    setDeletingGroup(group.key);
    setError("");
    try {
      await Promise.all(
        group.payments.map((payment) => monthlyPaymentsApi.remove(payment.id)),
      );
      await load();
    } catch (requestError) {
      setError(requestError.message);
      await load();
    } finally {
      setDeletingGroup("");
    }
  }

  const groups = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("sq");
    const filtered = payments.filter((payment) => {
      if (payment.created_by_username?.toLowerCase() === "admin") return false;
      if (!term) return true;
      return [
        payment.student_first_name,
        payment.student_last_name,
        payment.parent_name,
        payment.parent_phone,
        payment.area_name,
        payment.comment,
        payment.created_by_username,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("sq")
        .includes(term);
    });
    const grouped = new Map();
    groupRelatedMonthlyPayments(filtered).forEach((paymentGroup) => {
      const username =
        paymentGroup.firstPayment.created_by_username || "Përdorues i panjohur";
      if (!grouped.has(username)) grouped.set(username, []);
      grouped.get(username).push(paymentGroup);
    });
    grouped.forEach((items) => {
      items.sort((a, b) => {
        const paymentDateOrder = String(b.firstPayment.payment_date).localeCompare(
          String(a.firstPayment.payment_date),
        );
        if (paymentDateOrder) return paymentDateOrder;
        return new Date(b.firstPayment.created_at).getTime() - new Date(a.firstPayment.created_at).getTime();
      });
    });
    return [...grouped.entries()]
      .map(([username, items]) => ({
        username,
        items,
        total: items.reduce((sum, item) => sum + item.totalAmount, 0),
      }))
      .sort((a, b) => a.username.localeCompare(b.username));
  }, [payments, search]);

  const visibleCount = groups.reduce((sum, group) => sum + group.items.length, 0);
  const visibleTotal = groups.reduce((sum, group) => sum + group.total, 0);

  return (
    <div className="bt-page bt-ops-page bt-payments-page">
      <header className="bt-page-header">
        <div>
          <span className="bt-eyebrow">Bashkim Tours · Maarif</span>
          <h1>Pagesat</h1>
          <p>Pagesat ditore, mujore dhe vjetore të ndara sipas zyrës.</p>
        </div>
        <button
          className="bt-btn-secondary"
          disabled={loading || !groups.length}
          onClick={() => setPrintingList(true)}
        >
          <Printer /> Printo listën
        </button>
      </header>

      <div className="bt-payments-controls">
        <div className="bt-period-tabs" aria-label="Periudha e pagesave">
          <button className={period === "day" ? "active" : ""} onClick={() => setPeriod("day")}>Ditore</button>
          <button className={period === "month" ? "active" : ""} onClick={() => setPeriod("month")}>Mujore</button>
          <button className={period === "year" ? "active" : ""} onClick={() => setPeriod("year")}>Vjetore</button>
        </div>
        <label className="bt-payment-period-input">
          <CalendarDays />
          {period === "day" && <DateInput value={day} onChange={setDay} required />}
          {period === "month" && <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />}
          {period === "year" && <input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} />}
        </label>
        <label className="bt-payment-search">
          <Search />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kërko nxënës, prind, zonë ose zyrë…" />
        </label>
      </div>
      <p className="bt-payment-filter-range">
        Periudha: {formatDate(rangeFor(period, day, month, year)[0])} –{" "}
        {formatDate(rangeFor(period, day, month, year)[1])}
      </p>

      {!loading && !error && (
        <section className="bt-payments-summary">
          <article><span>Pagesa</span><strong>{visibleCount}</strong></article>
          <article><span>Shuma totale</span><strong>{money(visibleTotal)}</strong></article>
          <article><span>Zyra</span><strong>{groups.length}</strong></article>
        </section>
      )}

      {loading ? (
        <div className="bt-state-message"><RefreshCw className="bt-spin" /> Duke ngarkuar pagesat…</div>
      ) : error ? (
        <p className="bt-inline-error">{error}</p>
      ) : groups.length ? (
        <div className="bt-payment-user-groups">
          {groups.map((group) => (
            <section key={group.username} className="bt-payment-user-group">
              <header>
                <div><span>Regjistruar nga</span><h2>{group.username}</h2></div>
                <div><strong>{money(group.total)}</strong><span>{group.items.length} pagesa</span></div>
              </header>
              <div className="bt-history-table-wrap">
                <table className="bt-history-table bt-payments-table">
                  <thead><tr><th>Data</th><th>Nxënësi</th><th>Prindi</th><th>Zona</th><th>Muaji i paguar</th><th>Shuma</th><th>Regjistruar më</th><th>Komenti</th><th aria-label="Veprimet"></th></tr></thead>
                  <tbody>
                    {group.items.map((payment) => (
                      <tr key={payment.key}>
                        {(() => {
                          const item = payment.firstPayment;
                          return <>
                            <td><strong>{displayDate(item.payment_date)}</strong></td>
                            <td><strong>{item.student_first_name} {item.student_last_name}</strong><small>ID: {payment.payments.map((entry) => entry.id).join(", ")}</small></td>
                            <td><strong>{item.parent_name}</strong><small>{item.parent_phone}</small></td>
                            <td>{item.area_name}</td>
                            <td>{payment.payments.map((entry) => `${monthNames[Number(entry.month) - 1] || entry.month_name} ${entry.calendar_year}`).join(", ")}<small>{payment.payments.length > 1 ? `${payment.payments.length} muaj të paguar së bashku` : `Semestri ${item.semester}`}</small></td>
                            <td><strong>{money(payment.totalAmount)}</strong></td>
                            <td>{displayDateTime(item.created_at)}</td>
                            <td>{item.comment || "—"}</td>
                            <td><div className="bt-history-row-actions"><button className="bt-history-print-button" title="Printo vërtetimin" aria-label="Printo vërtetimin" onClick={() => setReceiptPayments(payment.payments)}><Printer /></button><button className="bt-history-delete-button" title="Fshije pagesën" aria-label="Fshije pagesën" disabled={deletingGroup === payment.key} onClick={() => deletePaymentGroup(payment)}>{deletingGroup === payment.key ? <RefreshCw className="bt-spin" /> : <Trash2 />}</button></div></td>
                          </>;
                        })()}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="bt-empty-state"><CalendarDays /><h3>Nuk ka pagesa</h3><p>Nuk u gjetën pagesa për periudhën e zgjedhur.</p></div>
      )}
      {receiptPayments && <PaymentReceipt payments={receiptPayments} />}
      {printingList && (
        <PaymentsListPrintSheet
          groups={groups}
          from={rangeFor(period, day, month, year)[0]}
          to={rangeFor(period, day, month, year)[1]}
          total={visibleTotal}
        />
      )}
    </div>
  );
}

function PaymentsListPrintSheet({ groups, from, to, total }) {
  return (
    <div className="bt-print-sheet bt-payments-list-print">
      <header>
        <img src={bashkimToursLogo} alt="Bashkim Tours" />
        <div><strong>Bashkim Tours</strong><span>Dervish Cara Nr. 4 · 1200 Tetovë, Maqedoni</span><span>+389 44 338 003 · +389 75 312 015</span></div>
      </header>
      <div className="bt-print-title">
        <div><h1>Lista e pagesave</h1><p>{displayDate(from)} – {displayDate(to)}</p></div>
        <span>Shuma totale: <strong>{money(total)}</strong></span>
      </div>
      {groups.map((group) => (
        <section className="bt-print-section" key={group.username}>
          <h2>{group.username}<span>{group.items.length} pagesa · {money(group.total)}</span></h2>
          <table>
            <thead><tr><th>Data</th><th>Nxënësi</th><th>Muajt</th><th>Shuma</th><th>Regjistruar më</th><th>Komenti</th></tr></thead>
            <tbody>{group.items.map((payment) => {
              const item = payment.firstPayment;
              return <tr key={payment.key}><td>{displayDate(item.payment_date)}</td><td><strong>{item.student_first_name} {item.student_last_name}</strong></td><td>{payment.payments.map((entry) => monthNames[Number(entry.month) - 1] || entry.month_name).join(", ")}</td><td><strong>{money(payment.totalAmount)}</strong></td><td>{displayDateTime(item.created_at)}</td><td>{item.comment || "—"}</td></tr>;
            })}</tbody>
          </table>
        </section>
      ))}
      <footer><span>bashkimtours.com · instagram.com/bashkim_tours_official</span><strong>Bashkim Tours</strong></footer>
    </div>
  );
}
