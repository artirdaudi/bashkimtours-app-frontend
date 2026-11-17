import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BusFront, ChevronDown, Download, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { fuelExternalCustomersApi, fuelLedgerApi, fuelReportsApi, fuelStaffVehiclesApi } from "./api";
import DateInput from "./DateInput";

const monthNames = ["Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor", "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"];
const number = (value, digits = 1) => value == null || !Number.isFinite(Number(value)) ? "—" : new Intl.NumberFormat("sq-AL", { maximumFractionDigits: digits }).format(Number(value));
const numeric = (value) => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
const normalize = (row) => ({ registration: String(row.registration_number ?? "").trim(), tank: numeric(row.liters_from_tank) ?? 0, outside: numeric(row.liters_outside_tank) ?? 0, liters: numeric(row.total_liters) ?? 0, km: numeric(row.kilometers), rate: numeric(row.liters_per_100_km), status: row.calculation_status });
const shiftMonth = (year, month, offset) => { const date = new Date(year, month - 1 + offset, 1); return [date.getFullYear(), date.getMonth() + 1]; };
const formatDate = (value) => new Intl.DateTimeFormat("sq-AL", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Skopje" }).format(new Date(value));
const dateKey = (value) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Skopje" }).format(new Date(value));
const dateRange = (year, month, mode, custom) => mode === "range" ? { date_from: custom.from, date_to: custom.to } : ({ date_from: `${year}-${String(mode === "year" ? 1 : month).padStart(2, "0")}-01`, date_to: mode === "year" ? `${year}-12-31` : new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) });
const MIN_FLEET_COMPARISON_KM = 500;
const MIN_FLEET_COMPARISON_RATE = 10;
const COMPARISON_CALCULATION_VERSION = 3;
const previousMonthRange = (dateFrom) => ({
  date_from: new Date(Date.UTC(Number(dateFrom.slice(0, 4)), Number(dateFrom.slice(5, 7)) - 2, 1)).toISOString().slice(0, 10),
  date_to: new Date(Date.parse(`${dateFrom}T00:00:00Z`) - 86400000).toISOString().slice(0, 10),
});
const litersOf = (rows) => rows.reduce((sum, row) => sum + (numeric(row.quantity_liters) ?? 0), 0);
function consumptionFromTransactions(transactions, previousTransactions) {
  const readings = [...transactions].filter((row) => numeric(row.odometer_km) != null).sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));
  const prior = [...previousTransactions].filter((row) => numeric(row.odometer_km) != null).sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date)).at(-1);
  const first = prior ?? readings[0] ?? null, last = readings.at(-1) ?? null;
  const startKm = numeric(first?.odometer_km), endKm = numeric(last?.odometer_km);
  const km = first && last && first !== last && endKm > startKm ? endKm - startKm : null;
  const measuredLiters = litersOf(transactions);
  return { first, last, km, measuredLiters, rate: km ? measuredLiters * 100 / km : null, firstIsPrior: Boolean(prior) };
}
const csvCell = (cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`;
function exportCsv(rows, year, month) {
  const lines = [["Targa", "Nga rezervari (L)", "Nga jashtë (L)", "Gjithsej (L)", "Kilometra", "L/100 km", "Statusi"], ...rows.map((row) => [row.registration, row.tank, row.outside, row.liters, row.km, row.rate, row.status])];
  const url = URL.createObjectURL(new Blob(["\uFEFF", lines.map((line) => line.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `nafta-autobuset-${year}-${String(month).padStart(2, "0")}.csv`; link.click(); URL.revokeObjectURL(url);
}
async function getAllTransactions(params) {
  const first = await fuelLedgerApi.list({ ...params, page: 1, page_size: 200, sort_order: "asc" });
  if (!Array.isArray(first?.items)) throw new Error("Transaksionet nuk janë të disponueshme.");
  const totalPages = first.pagination?.total_pages ?? 1;
  const rows = [...first.items];
  for (let page = 2; page <= totalPages; page += 1) {
    const response = await fuelLedgerApi.list({ ...params, page, page_size: 200, sort_order: "asc" });
    if (!Array.isArray(response?.items)) throw new Error("Transaksionet nuk janë të plota.");
    rows.push(...response.items);
  }
  return rows;
}
function FlowPanel({ flow, error }) {
  const max = Math.max(1, flow?.incoming ?? 0, flow?.outgoing ?? 0, flow?.outside ?? 0);
  return <section className="bt-fr-panel bt-fr-flow-panel"><div className="bt-fr-panel-head"><div><span>LËVIZJA E NAFTËS</span><h2>Garazha-Tanker dhe furnizimet jashtë</h2></div></div>
    {error && <p className="bt-inline-error" role="alert">{error}</p>}
    {!flow && !error && <p role="status" className="bt-fr-message">Duke ngarkuar lëvizjen e naftës…</p>}
    {flow && <div className="bt-fr-flow">
      <div className="bt-fr-flow-row"><span>Hyrje në Garazha-Tanker</span><strong>{number(flow.incoming)} L</strong><div className="bt-fr-flow-track"><i className="is-incoming" style={{ width: `${flow.incoming / max * 100}%` }} /></div></div>
      <div className="bt-fr-flow-row"><span>Dalje nga Garazha-Tanker</span><strong>{number(flow.outgoing)} L</strong><div className="bt-fr-flow-track bt-fr-flow-stacked" style={{ width: `${flow.outgoing / max * 100}%` }}><i className="is-bt" style={{ width: `${flow.outgoing ? flow.bt / flow.outgoing * 100 : 0}%` }} /><i className="is-customers" style={{ width: `${flow.outgoing ? flow.customers / flow.outgoing * 100 : 0}%` }} /><i className="is-staff" style={{ width: `${flow.outgoing ? flow.staff / flow.outgoing * 100 : 0}%` }} /></div></div>
      <div className="bt-fr-flow-breakdown"><div><i className="is-bt" /><span>Bashkim Tours / të tjera</span><strong>{number(flow.bt)} L</strong></div><div><i className="is-customers" /><span>Klientët e jashtëm</span><strong>{number(flow.customers)} L</strong></div><div><i className="is-staff" /><span>Stafi</span><strong>{number(flow.staff)} L</strong></div></div>
      <div className="bt-fr-flow-row bt-fr-flow-outside"><span>Naftë e marrë jashtë</span><strong>{number(flow.outside)} L</strong><div className="bt-fr-flow-track"><i className="is-outside" style={{ width: `${flow.outside / max * 100}%` }} /></div></div>
    </div>}
  </section>;
}
function VehiclePicker({ options, value, onChange, loading, error }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef(null);
  useEffect(() => {
    const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);
  const selected = options.find((option) => option.registration === value);
  const filtered = options.filter((option) => `${option.registration} ${option.name} ${option.group}`.toLocaleLowerCase("sq-AL").includes(query.trim().toLocaleLowerCase("sq-AL")));
  return <div className="bt-fr-vehicle-picker" ref={root}><button type="button" className="bt-fr-vehicle-trigger" aria-expanded={open} onClick={() => setOpen((current) => !current)}><BusFront size={19} /><span>{selected ? `${selected.registration} · ${selected.name}` : "Zgjidh automjetin"}</span><ChevronDown size={18} /></button>
    {open && <div className="bt-fr-vehicle-menu"><label className="bt-fr-vehicle-query"><Search size={17} /><input autoFocus type="search" placeholder="Kërko targën ose emrin…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="bt-fr-vehicle-options">{loading && <p>Duke ngarkuar mjetet…</p>}{error && <p className="bt-inline-error">{error}</p>}{["Autobusët", "Automjetet e stafit", "Klientët e jashtëm", "Të tjera"].map((group) => { const items = filtered.filter((option) => option.group === group); return items.length ? <div key={group}><strong>{group}</strong>{items.map((option) => <button type="button" key={option.registration} onClick={() => { onChange(option.registration); setOpen(false); setQuery(""); }}><span>{option.registration}</span><small>{option.name}</small></button>)}</div> : null; })}{!loading && !filtered.length && <p>Nuk u gjet automjet.</p>}</div></div>}
  </div>;
}
function ConsumptionChart({ rows, average, onChoose }) {
  const sorted = [...rows].sort((a, b) => b.rate - a.rate);
  const rates = [...rows].map((row) => row.rate).sort((a, b) => a - b);
  const scale = Math.max(80, (rates[Math.floor((rates.length - 1) * .9)] ?? 0) * 1.2);
  return <div className="bt-fr-consumption-chart" role="group" aria-label="Konsumi i të gjithë autobusëve"><div className="bt-fr-consumption-bars">{sorted.map((row) => <button type="button" key={row.registration} onClick={() => onChoose(row.registration)} title={`${row.registration}: ${number(row.rate)} L/100 km, ${number(row.km, 0)} km`}><strong>{number(row.rate)} <small>L/100 km</small></strong><span className="bt-fr-consumption-bar" style={{ height: `${Math.max(8, Math.min(1, row.rate / scale) * 170)}px` }} data-above={average != null && row.rate > average}>{row.rate > scale && <i>↑</i>}</span><small>{row.registration}</small></button>)}</div><p>Vlerat mbi {number(scale, 0)} L/100 km kanë shtyllë të kufizuar në lartësi; numri sipër është vlera e plotë.</p></div>;
}
function BusAnalysis({ registration, year, month, mode, custom, retry }) {
  const [transactions, setTransactions] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const range = dateRange(year, month, mode, custom);
    Promise.all([getAllTransactions({ registration_number: registration, ...range }), getAllTransactions({ registration_number: registration, ...previousMonthRange(range.date_from), min_odometer: 0 })]).then(([items, prior]) => {
      if (!active) return;
      setTransactions(items.filter((row) => row.registration_number?.trim().toUpperCase() === registration.toUpperCase()));
      setPrevious(prior.filter((row) => row.registration_number?.trim().toUpperCase() === registration.toUpperCase()));
    }).catch((cause) => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [registration, year, month, mode, custom, retry]);
  const summary = useMemo(() => {
    if (!transactions) return null;
    const tankRows = transactions.filter((row) => row.source_type === "BT_OUTGOING" || row.source_type === "STAFF_VEHICLE" || row.source_type === "EXTERNAL_CUSTOMER");
    const outsideRows = transactions.filter((row) => row.source_type === "EXTERNAL_REFUELLING");
    const tank = litersOf(tankRows), outside = litersOf(outsideRows);
    const range = dateRange(year, month, mode, custom);
    const { first, last, km, measuredLiters, rate, firstIsPrior } = consumptionFromTransactions(transactions, previous ?? []);
    const startKm = numeric(first?.odometer_km), endKm = numeric(last?.odometer_km);
    const grouping = mode === "year" || mode === "range" && (Date.parse(range.date_to) - Date.parse(range.date_from)) / 86400000 > 62 ? "month" : "day";
    const keys = [...new Set(transactions.map((row) => grouping === "month" ? dateKey(row.transaction_date).slice(0, 7) : dateKey(row.transaction_date)))].sort();
    const chart = keys.map((key) => { const rows = transactions.filter((row) => dateKey(row.transaction_date).startsWith(key)); const latestKm = rows.filter((row) => numeric(row.odometer_km) != null).at(-1); return { key, label: grouping === "month" ? `${monthNames[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}` : formatDate(`${key}T12:00:00Z`), tank: litersOf(rows.filter((row) => row.source_type !== "EXTERNAL_REFUELLING")), outside: litersOf(rows.filter((row) => row.source_type === "EXTERNAL_REFUELLING")), km: numeric(latestKm?.odometer_km) }; });
    return { tank, outside, total: tank + outside, startKm, endKm, km, measuredLiters, rate, first, last, chart, firstIsPrior };
  }, [transactions, previous, mode, year, month, custom]);
  const chartMax = Math.max(1, ...(summary?.chart ?? []).map((row) => row.tank + row.outside));
  return <div id="bt-fuel-bus-detail" className="bt-fr-bus-analysis">
    {loading && <p role="status" className="bt-fr-message">Duke ngarkuar analizën…</p>}
    {error && <p className="bt-inline-error" role="alert">{error}</p>}
    {summary && <>
      <div className="bt-fr-analysis-metrics"><div><small>Gjithsej naftë e marrë</small><strong>{number(summary.total)} L</strong></div><div><small>Naftë nga Garazha-Tanker</small><strong>{number(summary.tank)} L</strong></div><div><small>Naftë nga jashtë</small><strong>{number(summary.outside)} L</strong></div></div>
      <div className="bt-fr-odometer"><div><small>{summary.firstIsPrior ? "KM para fillimit të periudhës" : "KM në leximin e parë të periudhës"}</small><strong>{summary.startKm == null ? "—" : `${number(summary.startKm, 0)} km`}</strong><small>{summary.first ? formatDate(summary.first.transaction_date) : "Pa lexim"}</small></div><ArrowRight size={20} /><div><small>KM në leximin e fundit</small><strong>{summary.endKm == null ? "—" : `${number(summary.endKm, 0)} km`}</strong><small>{summary.last ? formatDate(summary.last.transaction_date) : "Pa lexim"}</small></div><div><small>KM të regjistruara në periudhë</small><strong>{summary.km == null ? "—" : `${number(summary.km, 0)} km`}</strong></div><div><small>Konsumi i periudhës</small><strong>{summary.rate == null ? "—" : `${number(summary.rate)} L/100 km`}</strong></div></div>
      {!summary.firstIsPrior && summary.first && summary.last && <p className="bt-fr-analysis-note">Litrat përfshijnë të gjitha furnizimet e periudhës. KM bazohen në leximet nga {formatDate(summary.first.transaction_date)} deri më {formatDate(summary.last.transaction_date)}.</p>}
      <div className="bt-fr-usage"><div className="bt-fr-usage-head"><h3>Furnizimet në periudhë</h3><div><span><i className="is-tank" /> Garazha-Tanker</span><span><i className="is-outside" /> Jashtë</span></div></div>{summary.chart.length ? <div className="bt-fr-usage-chart">{summary.chart.map((row) => <div className="bt-fr-usage-column" key={row.key}><strong>{number(row.tank + row.outside)} L</strong><div className="bt-fr-usage-column-track" style={{ height: `${Math.max(10, (row.tank + row.outside) / chartMax * 160)}px` }}><i className="is-outside" style={{ height: `${row.tank + row.outside ? row.outside / (row.tank + row.outside) * 100 : 0}%` }} /><i className="is-tank" style={{ height: `${row.tank + row.outside ? row.tank / (row.tank + row.outside) * 100 : 0}%` }} /></div><span>{row.label}</span><small>{row.km == null ? "KM —" : `KM ${number(row.km, 0)}`}</small></div>)}</div> : <p className="bt-fr-empty">Nuk ka furnizime për këtë periudhë.</p>}</div>
    </>}
  </div>;
}
export default function FuelReportsPage() {
  const [period, setPeriod] = useState(() => { const date = new Date(); return [date.getFullYear(), date.getMonth() + 1]; });
  const [mode, setMode] = useState("month");
  const [custom, setCustom] = useState(() => { const today = new Date(); const initial = dateRange(today.getFullYear(), today.getMonth() + 1, "month"); return { from: initial.date_from, to: initial.date_to }; });
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehiclesError, setVehiclesError] = useState("");
  const [report, setReport] = useState(null);
  const [fuelFlow, setFuelFlow] = useState(null);
  const [fuelFlowError, setFuelFlowError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState("");
  const [comparisonMode, setComparisonMode] = useState("month");
  const [comparisonData, setComparisonData] = useState(null);
  const [comparisonError, setComparisonError] = useState("");
  const [year, month] = period;
  useEffect(() => {
    let active = true;
    fuelReportsApi.monthlyBuses({ year, month }).then((response) => {
      if (!active) return;
      if (!Array.isArray(response?.items)) throw new Error("Përgjigjja e raportit nuk përmban listën e autobusëve.");
      setReport(response.items.map(normalize)); setError("");
    }).catch((cause) => { if (active) { setReport(null); setError(cause.message); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [year, month, retry]);
  useEffect(() => {
    let active = true;
    fuelLedgerApi.list({ ...dateRange(year, month, "month"), page: 1, page_size: 1 }).then((response) => {
      if (!active) return;
      if (!response?.summary) throw new Error("Përmbledhja e naftës nuk është e disponueshme.");
      const source = response.summary;
      const incoming = numeric(source.incoming_liters) ?? 0, bt = numeric(source.bt_outgoing_liters) ?? 0, customers = numeric(source.external_customer_liters) ?? 0, staff = numeric(source.staff_vehicle_liters) ?? 0, outside = numeric(source.external_refuelling_liters) ?? 0;
      setFuelFlow({ incoming, bt, customers, staff, outside, outgoing: bt + customers + staff });
      setFuelFlowError("");
    }).catch((cause) => { if (active) setFuelFlowError(cause.message); });
    return () => { active = false; };
  }, [year, month, retry]);
  useEffect(() => { const refresh = () => setRetry((value) => value + 1); window.addEventListener("bt:fuel-reconnected", refresh); return () => window.removeEventListener("bt:fuel-reconnected", refresh); }, []);
  useEffect(() => {
    let active = true;
    if (!report) return () => { active = false; };
    const range = dateRange(year, month, comparisonMode);
    Promise.all([getAllTransactions(range), getAllTransactions({ ...previousMonthRange(range.date_from), min_odometer: 0 })]).then(([entries, prior]) => {
      if (!active) return;
      setComparisonData({ key: `${COMPARISON_CALCULATION_VERSION}:${comparisonMode}:${year}:${month}`, entries, prior });
      setComparisonError("");
    }).catch((cause) => { if (active) setComparisonError(cause.message); });
    return () => { active = false; };
  }, [comparisonMode, year, month, report, retry]);
  useEffect(() => {
    let active = true;
    if (!report) return () => { active = false; };
    Promise.allSettled([fuelStaffVehiclesApi.list(), fuelExternalCustomersApi.list(), getAllTransactions(dateRange(year, month, "month"))]).then((responses) => {
      if (!active) return;
      const [staff, customers, entries] = responses.map((response) => response.status === "fulfilled" ? response.value : []);
      const known = new Set((report ?? []).map((row) => row.registration.toUpperCase()));
      const result = (report ?? []).map((row) => ({ registration: row.registration, name: "Autobus", group: "Autobusët" }));
      for (const item of staff) { const plate = item.registration_number?.trim().toUpperCase(); if (plate && !known.has(plate)) { known.add(plate); result.push({ registration: plate, name: item.owner_name || "Staf", group: "Automjetet e stafit" }); } }
      for (const item of customers) { const plate = item.registration_number?.trim().toUpperCase(); if (plate && !known.has(plate)) { known.add(plate); result.push({ registration: plate, name: [item.first_name, item.last_name].filter(Boolean).join(" ") || "Klient", group: "Klientët e jashtëm" }); } }
      for (const item of entries) { const plate = item.registration_number?.trim().toUpperCase(); if (plate && !known.has(plate)) { known.add(plate); result.push({ registration: plate, name: "Targë nga transaksionet", group: "Të tjera" }); } }
      setVehicles(result);
      const busPlates = new Set((report ?? []).map((row) => row.registration.toUpperCase()));
      const latestBus = [...entries].reverse().find((item) => busPlates.has(item.registration_number?.trim().toUpperCase()) && (item.source_type === "BT_OUTGOING" || item.source_type === "EXTERNAL_REFUELLING"));
      if (latestBus) setSelected((current) => current || latestBus.registration_number.trim().toUpperCase());
      setVehiclesError(responses.some((response) => response.status === "rejected") ? "Disa kategori nuk u ngarkuan. Provo Rifresko." : "");
      setVehiclesLoading(false);
    });
    return () => { active = false; };
  }, [report, year, month, retry]);
  const efficiency = useMemo(() => {
    const comparisonRows = comparisonData?.key === `${COMPARISON_CALCULATION_VERSION}:${comparisonMode}:${year}:${month}` && Array.isArray(comparisonData.entries) && Array.isArray(comparisonData.prior) && report ? [...new Set(report.map((row) => row.registration.toUpperCase()))].map((plate) => {
      const current = comparisonData.entries.filter((row) => row.registration_number?.trim().toUpperCase() === plate);
      const previous = comparisonData.prior.filter((row) => row.registration_number?.trim().toUpperCase() === plate);
      const { km, rate } = consumptionFromTransactions(current, previous);
      return { registration: plate, km, rate };
    }) : [];
    const measured = comparisonRows.filter((row) => row.rate != null && row.rate > 0);
    const valid = measured.filter((row) => row.km != null && row.km >= MIN_FLEET_COMPARISON_KM && row.rate >= MIN_FLEET_COMPARISON_RATE);
    const average = valid.length ? valid.reduce((sum, row) => sum + row.rate, 0) / valid.length : null;
    return { average, validCount: valid.length, excludedCount: measured.length - valid.length, rows: valid };
  }, [comparisonMode, comparisonData, report, year, month]);
  const comparisonReady = comparisonData?.key === `${COMPARISON_CALCULATION_VERSION}:${comparisonMode}:${year}:${month}` && Array.isArray(comparisonData.entries) && Array.isArray(comparisonData.prior);
  const choose = (registration) => { setSelected(registration); window.setTimeout(() => document.getElementById("bt-fuel-bus-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };
  const changePeriod = (next) => { setPeriod(next); setReport(null); setFuelFlow(null); setComparisonData(null); setComparisonError(""); setLoading(true); setSelected(""); setVehiclesLoading(true); };
  const periodTitle = `${monthNames[month - 1]} ${year}`;
  return <div className="bt-page bt-ops-page bt-fuel-reports-page">
    <header className="bt-page-header"><div><span className="bt-eyebrow">Bashkim Tours · Nafta</span><h1>Raportet e naftës</h1></div></header>
    <div className="bt-fr-controls"><div className="bt-fr-period"><button type="button" aria-label="Muaji i kaluar" onClick={() => changePeriod(shiftMonth(year, month, -1))}><ArrowLeft size={17} /></button><label>Periudha <input type="month" min="2000-01" max="2100-12" value={`${year}-${String(month).padStart(2, "0")}`} onChange={(event) => { if (event.target.value) { const [nextYear, nextMonth] = event.target.value.split("-").map(Number); changePeriod([nextYear, nextMonth]); } }} /></label><button type="button" aria-label="Muaji tjetër" onClick={() => changePeriod(shiftMonth(year, month, 1))}><ArrowRight size={17} /></button></div><div className="bt-fr-actions"><button type="button" onClick={() => { setReport(null); setFuelFlow(null); setComparisonData(null); setComparisonError(""); setLoading(true); setVehiclesLoading(true); setRetry((value) => value + 1); }}><RefreshCw size={16} /> Rifresko</button><button type="button" disabled={!report?.length} onClick={() => exportCsv(report, year, month)}><Download size={16} /> CSV</button></div></div>
    {loading && <p role="status" className="bt-fr-message">Duke ngarkuar raportin…</p>}
    {error && <p className="bt-inline-error" role="alert">{error}</p>}
    {report && <>
      <div className="bt-fr-hero"><span>RAPORTI MUJOR</span><h2>{periodTitle}</h2></div>
      {mode === "month" && report.every((row) => row.liters === 0) && <div className="bt-fr-zero-note" role="status"><TriangleAlert size={19} /><span>Nuk ka furnizime të regjistruara për {periodTitle}.</span></div>}
      <FlowPanel flow={fuelFlow} error={fuelFlowError} />
      <section className="bt-fr-panel bt-fr-explorer"><div className="bt-fr-panel-head"><div><h2>Analiza e automjetit</h2></div></div><div className="bt-fr-analysis-controls"><VehiclePicker options={vehicles} value={selected} onChange={choose} loading={vehiclesLoading} error={vehiclesError} /><div className="bt-fr-analysis-mode" role="radiogroup" aria-label="Periudha e analizës"><label><input type="radio" name="fuel-analysis-mode" checked={mode === "month"} onChange={() => { setMode("month"); setComparisonMode("month"); setComparisonData(null); }} /> Mujore</label><label><input type="radio" name="fuel-analysis-mode" checked={mode === "year"} onChange={() => { setMode("year"); setComparisonMode("year"); setComparisonData(null); }} /> Vjetore</label><label><input type="radio" name="fuel-analysis-mode" checked={mode === "range"} onChange={() => { if (!custom.from || !custom.to) { const current = dateRange(year, month, "month"); setCustom({ from: current.date_from, to: current.date_to }); } setMode("range"); }} /> Periudhë</label></div></div>{mode === "range" && <div className="bt-fr-custom-dates"><label>Nga data <DateInput value={custom.from} onChange={(from) => setCustom((current) => ({ ...current, from }))} /></label><label>Deri më <DateInput value={custom.to} onChange={(to) => setCustom((current) => ({ ...current, to }))} /></label></div>}{!selected && <p className="bt-fr-analysis-hint">Zgjidh një automjet për të parë konsumin dhe furnizimet.</p>}{mode === "range" && (!custom.from || !custom.to || custom.from > custom.to) && <p className="bt-inline-error" role="alert">Zgjidh dy data të vlefshme, nga më e hershmja te më e vona.</p>}{selected && (mode !== "range" || custom.from && custom.to && custom.from <= custom.to) && <BusAnalysis key={`${selected}-${year}-${month}-${mode}-${custom.from}-${custom.to}-${retry}`} registration={selected} year={year} month={month} mode={mode} custom={custom} retry={retry} />}</section>
      <section className="bt-fr-panel bt-fr-efficiency"><div className="bt-fr-panel-head"><div><span>KRAHASIMI I KONSUMIT</span><h2>Konsumi i autobusëve</h2><p>{comparisonMode === "year" ? `Viti ${year}` : `${monthNames[month - 1]} ${year}`} · {efficiency.rows.length} autobusë në krahasim</p></div><div className="bt-fr-average"><small>Mesatarja e flotës</small><strong>{number(efficiency.average)} <span>L/100 km</span></strong><small>Të paktën {MIN_FLEET_COMPARISON_KM} km · nga {MIN_FLEET_COMPARISON_RATE} L/100 km</small></div></div>{efficiency.excludedCount > 0 && <p className="bt-fr-comparison-note">{efficiency.excludedCount} autobusë me më pak se {MIN_FLEET_COMPARISON_KM} km ose konsum nën {MIN_FLEET_COMPARISON_RATE} L/100 km nuk përfshihen në krahasim. Konsumet e larta mbeten të dukshme.</p>}<div className="bt-fr-comparison-mode" role="radiogroup" aria-label="Periudha e krahasimit"><label><input type="radio" name="fuel-comparison-mode" checked={comparisonMode === "month"} onChange={() => { setComparisonData(null); setComparisonError(""); setComparisonMode("month"); setMode("month"); }} /> Mujore</label><label><input type="radio" name="fuel-comparison-mode" checked={comparisonMode === "year"} onChange={() => { setComparisonData(null); setComparisonError(""); setComparisonMode("year"); setMode("year"); }} /> Vjetore</label></div>{!comparisonReady && !comparisonError && <p role="status" className="bt-fr-message">Duke llogaritur konsumin…</p>}{comparisonError && <p className="bt-inline-error" role="alert">{comparisonError}</p>}{efficiency.rows.length ? <ConsumptionChart rows={efficiency.rows} average={efficiency.average} onChoose={choose} /> : comparisonReady ? <p className="bt-fr-empty">Nuk ka konsum të llogaritur për këtë periudhë.</p> : null}</section>
    </>}
  </div>;
}
