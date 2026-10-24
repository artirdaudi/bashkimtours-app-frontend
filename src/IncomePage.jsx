import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Building2,
  CalendarDays,
  Info,
  Layers3,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { charterPaymentsApi, monthlyPaymentsApi, maarifReportingApi } from "./api";
import maarifLogo from "./assets/maarif_logo.jpeg";
import bashkimToursLogo from "./assets/bashkimtours_logo.png";
import DateInput from "./DateInput";
import { charterAmountInEUR, MKD_PER_EUR } from "./charterCurrency";

const euro = new Intl.NumberFormat("sq-AL", {
  style: "currency",
  currency: "EUR",
});
const money = (value) => euro.format(Number(value || 0));
const localDate = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};
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

const incomeSources = [
  {
    id: "maarif",
    name: "Maarif",
    description: "Pagesat e transportit të nxënësve",
    logo: maarifLogo,
    color: "#0faab7",
  },
  {
    id: "charters",
    name: "Charterët",
    description: "Pagesat e udhëtimeve me porosi",
    logo: bashkimToursLogo,
    color: "#073878",
  },
];

const skopjeDate = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Skopje", year: "numeric", month: "2-digit", day: "2-digit" });
const skopjeHour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Skopje", hour: "2-digit", hourCycle: "h23" });
const dateKey = (value) => {
  const parts = Object.fromEntries(skopjeDate.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const rangeFor = (period, selectedDay, selectedMonth, selectedYear) => {
  if (period === "day") return [selectedDay, selectedDay];
  if (period === "month") {
    const [year, month] = selectedMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return [
      `${year}-${String(month).padStart(2, "0")}-01`,
      `${year}-${String(month).padStart(2, "0")}-${lastDay}`,
    ];
  }
  return [`${selectedYear}-01-01`, `${selectedYear}-12-31`];
};

async function getPaymentsForDay(day) {
  const first = await monthlyPaymentsApi.list({
    payment_date_from: day,
    payment_date_to: day,
    page: 1,
    page_size: 100,
    sort_by: "created_at",
    sort_order: "asc",
  });
  if (first.total_pages <= 1) return first.items;
  const remaining = await Promise.all(
    Array.from({ length: first.total_pages - 1 }, (_, index) =>
      monthlyPaymentsApi.list({
        payment_date_from: day,
        payment_date_to: day,
        page: index + 2,
        page_size: 100,
        sort_by: "created_at",
        sort_order: "asc",
      }),
    ),
  );
  return [first, ...remaining].flatMap((response) => response.items);
}

const aggregateTimeline = (
  items,
  period,
  selectedMonth,
  hourlyPayments,
) => {
  if (period === "day") {
    const hours = Array.from({ length: 24 }, (_, hour) => ({
      key: hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      total: 0,
    }));
    hourlyPayments.forEach((payment) => {
      const createdAt = new Date(payment.created_at);
      if (!Number.isNaN(createdAt.getTime()))
        hours[Number(skopjeHour.format(createdAt))].total += Number(payment.amount || 0);
    });
    return hours;
  }
  if (period === "month") {
    const [year, month] = selectedMonth.split("-").map(Number);
    const totals = new Map(
      items.map((item) => [item.payment_date, Number(item.total_income || 0)]),
    );
    return Array.from({ length: new Date(year, month, 0).getDate() }, (_, index) => {
      const day = index + 1;
      const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { key, label: String(day), total: totals.get(key) || 0 };
    });
  }
  const monthly = new Map(
    monthNames.map((name, index) => [
      index + 1,
      { key: index + 1, label: name, total: 0 },
    ]),
  );
  items.forEach((item) => {
    const month = Number(item.payment_date.slice(5, 7));
    monthly.get(month).total += Number(item.total_income || 0);
  });
  return [...monthly.values()];
};

export default function IncomePage() {
  const today = localDate();
  const [period, setPeriod] = useState("year");
  const [selectedDay, setSelectedDay] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(today.slice(0, 4));
  const [sourceId, setSourceId] = useState("all");
  const [incomeData, setIncomeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const years = Array.from(
    { length: 9 },
    (_, index) => Number(today.slice(0, 4)) + 2 - index,
  );
  const [dateFrom, dateTo] = rangeFor(
    period,
    selectedDay,
    selectedMonth,
    selectedYear,
  );

  useEffect(() => {
    let cancelled = false;
    const request = window.setTimeout(() => {
      setLoading(true);
      setError("");
      const filters = {
        payment_date_from: dateFrom,
        payment_date_to: dateTo,
      };
      Promise.all([
        maarifReportingApi.summary(filters),
        maarifReportingApi.byUser(filters),
        maarifReportingApi.byDate(filters),
        period === "day" ? getPaymentsForDay(selectedDay) : Promise.resolve([]),
        charterPaymentsApi.all(filters),
      ])
        .then(([summaryData, users, dates, dayPayments, charterResponse]) => {
          if (cancelled) return;
          setIncomeData({ summaryData, users, dates, dayPayments, charterPayments: charterResponse.items });
        })
        .catch((requestError) => {
          if (!cancelled) setError(requestError.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(request);
    };
  }, [dateFrom, dateTo, period, selectedDay]);

  const { summary, byUser, byDate, hourlyPayments, sourceTotals } = useMemo(() => {
    if (!incomeData) return { summary: null, byUser: [], byDate: [], hourlyPayments: [], sourceTotals: { maarif: 0, charters: 0 } };
    const { summaryData, users, dates, dayPayments, charterPayments } = incomeData;
    const sourceTotals = {
      maarif: Number(summaryData.total_income || 0),
      charters: charterPayments.reduce((total, payment) => total + charterAmountInEUR(payment), 0),
    };
    const includeMaarif = sourceId === "all" || sourceId === "maarif";
    const includeCharters = sourceId === "all" || sourceId === "charters";
    const dateTotals = new Map();
    if (includeMaarif) dates.forEach((item) => dateTotals.set(item.payment_date, Number(item.total_income || 0)));
    if (includeCharters) charterPayments.forEach((payment) => {
      const day = dateKey(payment.payment_date);
      dateTotals.set(day, (dateTotals.get(day) || 0) + charterAmountInEUR(payment));
    });
    const userTotals = new Map();
    if (includeMaarif) users.forEach((user) => userTotals.set(user.username, Number(user.total_income || 0)));
    if (includeCharters) charterPayments.forEach((payment) => {
      const username = payment.created_by_user?.username || "Përdorues i panjohur";
      userTotals.set(username, (userTotals.get(username) || 0) + charterAmountInEUR(payment));
    });
    return {
      summary: { total_income: (includeMaarif ? sourceTotals.maarif : 0) + (includeCharters ? sourceTotals.charters : 0) },
      byUser: [...userTotals].map(([username, total_income]) => ({ user_id: username, username, total_income })).sort((a, b) => b.total_income - a.total_income),
      byDate: [...dateTotals].map(([payment_date, total_income]) => ({ payment_date, total_income })),
      hourlyPayments: [...(includeMaarif ? dayPayments : []), ...(includeCharters ? charterPayments.map((payment) => ({ created_at: payment.payment_date, amount: charterAmountInEUR(payment) })) : [])],
      sourceTotals,
    };
  }, [incomeData, sourceId]);

  const timeline = useMemo(
    () => aggregateTimeline(byDate, period, selectedMonth, hourlyPayments),
    [byDate, period, selectedMonth, hourlyPayments],
  );
  const maximumIncome = Math.max(
    ...timeline.map((item) => Number(item.total || 0)),
    1,
  );
  const totalIncome = Number(summary?.total_income || 0);
  const periodLabel =
    period === "day"
      ? selectedDay.split("-").reverse().join("/")
      : period === "month"
      ? `${monthNames[Number(selectedMonth.slice(5, 7)) - 1]} ${selectedMonth.slice(0, 4)}`
      : selectedYear;

  return (
    <div className="bt-page bt-ops-page bt-finance-page">
      <header className="bt-finance-header">
        <div>
          <span className="bt-eyebrow">Bashkim Tours · Financa</span>
          <h1>Të hyrat</h1>
          <p>
            Përmbledhja e të hyrave në EUR nga Maarif dhe Charterët, e organizuar
            sipas burimit dhe datës së arkëtimit.
          </p>
        </div>
      </header>

      <div className="bt-income-notice" role="status">
        <Info aria-hidden="true" />
        <div>
          <strong>Kjo faqe është ende në përpunim</strong>
          <p>Faqja e të hyrave kërkon ende punë shtesë për të qenë plotësisht funksionale. Disa të dhëna dhe funksione mund të mos jenë ende të plota.</p>
        </div>
      </div>

      <section className="bt-finance-filterbar bt-finance-filterbar--calendar">
        <label>
          <span>Burimi</span>
          <div>
            <Layers3 />
            <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
              <option value="all">Të gjitha burimet</option>
              {incomeSources.map((source) => (
                <option value={source.id} key={source.id}>{source.name}</option>
              ))}
            </select>
          </div>
        </label>
        <div className="bt-finance-period-filter">
          <span>Periudha</span>
          <div>
            <button className={period === "day" ? "active" : ""} onClick={() => setPeriod("day")}>Ditë</button>
            <button className={period === "month" ? "active" : ""} onClick={() => setPeriod("month")}>Muaj</button>
            <button className={period === "year" ? "active" : ""} onClick={() => setPeriod("year")}>Vit</button>
          </div>
        </div>
        <label>
          <span>{period === "day" ? "Dita" : period === "month" ? "Muaji" : "Viti"}</span>
          <div>
            <CalendarDays />
            {period === "day" ? (
              <DateInput value={selectedDay} onChange={setSelectedDay} required />
            ) : period === "month" ? (
              <div className="bt-finance-month-picker">
                <select
                  aria-label="Muaji"
                  value={Number(selectedMonth.slice(5, 7))}
                  onChange={(event) => setSelectedMonth(`${selectedMonth.slice(0, 4)}-${String(event.target.value).padStart(2, "0")}`)}
                >
                  {monthNames.map((name, index) => <option value={index + 1} key={name}>{name}</option>)}
                </select>
                <select
                  aria-label="Viti i muajit"
                  value={selectedMonth.slice(0, 4)}
                  onChange={(event) => setSelectedMonth(`${event.target.value}-${selectedMonth.slice(5, 7)}`)}
                >
                  {years.map((year) => <option value={year} key={year}>{year}</option>)}
                </select>
              </div>
            ) : (
              <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
                {years.map((year) => <option value={year} key={year}>{year}</option>)}
              </select>
            )}
          </div>
        </label>
      </section>

      {error && <p className="bt-inline-error">{error}</p>}
      {!summary && loading ? (
        <div className="bt-state-message"><RefreshCw className="bt-spin" /> Duke përgatitur të hyrat…</div>
      ) : summary ? (
        <>
          <section className="bt-finance-overview bt-finance-overview--total-only">
            <article className="bt-finance-total-card">
              <div>
                <span>{sourceId === "all" ? "TË HYRAT GJITHSEJ" : `TË HYRAT NGA ${sourceId === "maarif" ? "MAARIF" : "CHARTERËT"}`}</span>
              </div>
              <strong>{money(summary.total_income)}</strong>
              <div className="bt-finance-total-meta">
                <span><TrendingUp /> Gjithsej për periudhën e zgjedhur</span>
                {loading && <RefreshCw className="bt-spin" />}
              </div>
            </article>
          </section>

          <div className="bt-finance-section-heading bt-finance-section-heading--simple">
            <div><h2>Burimet</h2></div>
          </div>
          <section className="bt-income-source-grid">
            {incomeSources.map((source) => (
              <article key={source.id} style={{ "--source-color": source.color }}>
                <header>
                  <img src={source.logo} alt="" />
                  <div><h3>{source.name}</h3><p>{source.description}</p></div>
                </header>
                <div className="bt-income-source-value bt-income-source-value--clean">
                  <strong>{money(sourceTotals[source.id])}</strong>
                </div>
                <div className="bt-income-source-share">
                  <span style={{ width: sourceTotals.maarif + sourceTotals.charters ? `${(sourceTotals[source.id] / (sourceTotals.maarif + sourceTotals.charters)) * 100}%` : "0%" }} />
                  <small>{sourceTotals.maarif + sourceTotals.charters ? `${((sourceTotals[source.id] / (sourceTotals.maarif + sourceTotals.charters)) * 100).toFixed(1)}% e të hyrave të regjistruara` : "Pa të hyra në këtë periudhë"}</small>
                </div>
              </article>
            ))}
          </section>

          <section className="bt-finance-dashboard-grid">
            <article className="bt-finance-panel bt-finance-monthly-panel">
              <header>
                <div><span>ECURIA</span><h2>Të hyrat · {periodLabel}</h2></div>
                <CalendarDays />
              </header>
              {timeline.some((item) => item.total) ? (
                <div className={`bt-finance-month-bars ${period === "month" ? "daily" : period === "day" ? "hourly" : ""}`}>
                  {timeline.map((item) => (
                    <div key={item.key}>
                      <strong>{money(item.total)}</strong>
                      <span><i style={{ height: `${Math.max(4, (item.total / maximumIncome) * 100)}%` }} /></span>
                      <small>{item.label}</small>
                    </div>
                  ))}
                </div>
              ) : <p className="bt-income-empty">Nuk ka të hyra për këtë periudhë.</p>}
            </article>

            <article className="bt-finance-panel bt-finance-office-panel">
              <header>
                <div><span>ARKËTIMI</span><h2>Sipas zyrës</h2></div>
                <Building2 />
              </header>
              <div className="bt-finance-ranking">
                {byUser.length ? byUser.map((user) => {
                  const percentage = totalIncome ? (Number(user.total_income) / totalIncome) * 100 : 0;
                  return (
                    <div key={user.user_id}>
                      <span className="bt-finance-rank-icon">{user.username.slice(0, 1).toUpperCase()}</span>
                      <div><strong>{user.username}</strong><small>{percentage.toFixed(1)}% e totalit</small><i><b style={{ width: `${percentage}%` }} /></i></div>
                      <strong>{money(user.total_income)}</strong>
                    </div>
                  );
                }) : <p className="bt-income-empty">Nuk ka të dhëna sipas zyrës.</p>}
              </div>
            </article>
          </section>

          <footer className="bt-finance-footer-note">
            <Banknote />
            <div><strong>Të hyrat bazohen në datën reale të arkëtimit</strong><span>Pagesat e Charterëve në MKD paraqiten në EUR me kursin 1 EUR = {MKD_PER_EUR} MKD.</span></div>
          </footer>
        </>
      ) : null}
    </div>
  );
}
