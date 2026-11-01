import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BusFront, Download, Fuel, Gauge, Info, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { fuelReportsApi } from "./api";

const months = ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Kor", "Gus", "Sht", "Tet", "Nën", "Dhj"];
const monthNames = ["Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor", "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"];
const number = (n, digits = 1) => n == null || !Number.isFinite(Number(n)) ? "—" : new Intl.NumberFormat("sq-AL", { maximumFractionDigits: digits }).format(Number(n));
const numeric = (n) => n == null || n === "" || !Number.isFinite(Number(n)) ? null : Number(n);
const normalize = (row) => ({
  registration: String(row.registration_number ?? "").trim(),
  tank: numeric(row.liters_from_tank) ?? 0,
  outside: numeric(row.liters_outside_tank) ?? 0,
  liters: numeric(row.total_liters) ?? 0,
  km: numeric(row.kilometers),
  rate: numeric(row.liters_per_100_km),
  readings: numeric(row.odometer_readings) ?? 0,
  status: row.calculation_status,
  year: row.year,
  month: row.month,
});
const shiftMonth = (year, month, offset) => { const date = new Date(year, month - 1 + offset, 1); return [date.getFullYear(), date.getMonth() + 1]; };
const statusText = { OK: "Matje e plotë", NO_FUEL: "Pa furnizim", INSUFFICIENT_ODOMETER: "Pak lexime km", INVALID_ODOMETER: "Lexime km të pavlefshme" };
const csvCell = (cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`;
function exportCsv(rows, year, month) {
  const lines = [["Targa", "Nga rezervari (L)", "Nga jashtë (L)", "Gjithsej (L)", "Kilometra", "L/100 km", "Lexime km", "Statusi"], ...rows.map((r) => [r.registration, r.tank, r.outside, r.liters, r.km, r.rate, r.readings, r.status])];
  const url = URL.createObjectURL(new Blob(["\uFEFF", lines.map((line) => line.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `nafta-autobuset-${year}-${String(month).padStart(2, "0")}.csv`; link.click(); URL.revokeObjectURL(url);
}
function TrendChart({ rows, metric, color, unit }) {
  const values = rows.map((row) => row[metric]);
  const valid = values.filter((v) => v != null);
  if (!valid.length) return <p className="bt-fr-empty">Nuk ka matje të vlefshme për këtë grafik.</p>;
  const max = Math.max(1, ...valid) * 1.12;
  const width = 700, height = 220, left = 42, right = 12, top = 16, bottom = 32;
  const x = (index) => left + index * (width - left - right) / Math.max(1, rows.length - 1);
  const y = (value) => top + (1 - value / max) * (height - top - bottom);
  const segments = []; let current = [];
  rows.forEach((row, index) => { if (row[metric] == null) { if (current.length) segments.push(current); current = []; } else current.push(`${x(index)},${y(row[metric])}`); });
  if (current.length) segments.push(current);
  return <div className="bt-fr-chart-scroll"><svg className="bt-fr-trend" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Grafiku 12-mujor: ${unit}`}>
    {[0, .5, 1].map((fraction) => <g key={fraction}><line x1={left} y1={y(max * fraction)} x2={width - right} y2={y(max * fraction)} stroke="#e6edf1" strokeDasharray={fraction ? "4 5" : "none"} /><text x={left - 8} y={y(max * fraction) + 4} textAnchor="end" fill="#81929c" fontSize="11">{number(max * fraction, 0)}</text></g>)}
    {segments.map((points, index) => <polyline key={index} points={points.join(" ")} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}
    {rows.map((row, index) => <g key={`${row.year}-${row.month}-${index}`}>{row[metric] != null && <circle cx={x(index)} cy={y(row[metric])} r="5" fill={color} stroke="white" strokeWidth="2"><title>{`${monthNames[row.month - 1]} ${row.year}: ${number(row[metric])} ${unit}`}</title></circle>}<text x={x(index)} y={height - 8} textAnchor="middle" fill="#657985" fontSize="11">{months[row.month - 1] ?? ""}</text></g>)}
  </svg></div>;
}
export default function FuelReportsPage() {
  const [period, setPeriod] = useState(() => { const d = new Date(); return [d.getFullYear(), d.getMonth() + 1]; });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [trendMetric, setTrendMetric] = useState("liters");
  const [showAll, setShowAll] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [abovePercent, setAbovePercent] = useState(10);
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
    if (!selected) return;
    let active = true;
    fuelReportsApi.busLast12Months(selected, { year, month }).then((response) => {
      if (!active) return;
      if (!Array.isArray(response?.months)) throw new Error("Përgjigjja nuk përmban historikun mujor.");
      setHistory(response.months.map(normalize)); setHistoryError("");
    }).catch((cause) => { if (active) { setHistory(null); setHistoryError(cause.status === 404 ? "Nuk ka historik të plotë 12-mujor për këtë autobus." : cause.message); } }).finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [selected, year, month, retry]);
  useEffect(() => {
    const refresh = () => { setLoading(true); setHistory(null); setHistoryLoading(Boolean(selected)); setRetry((n) => n + 1); };
    window.addEventListener("bt:fuel-reconnected", refresh);
    return () => window.removeEventListener("bt:fuel-reconnected", refresh);
  }, [selected]);
  const rows = useMemo(() => (report ?? []).filter((row) => row.registration.toLocaleLowerCase("sq-AL").includes(search.trim().toLocaleLowerCase("sq-AL"))), [report, search]);
  const stats = useMemo(() => {
    const all = report ?? [];
    const active = all.filter((r) => r.liters > 0);
    const tank = all.reduce((sum, r) => sum + r.tank, 0), outside = all.reduce((sum, r) => sum + r.outside, 0);
    return { all: all.length, active: active.length, tank, outside, liters: tank + outside, valid: all.filter((r) => r.status === "OK").length };
  }, [report]);
  const ranked = useMemo(() => [...rows].filter((r) => r.liters > 0).sort((a, b) => b.liters - a.liters), [rows]);
  const efficiency = useMemo(() => {
    const valid = (report ?? []).filter((r) => r.status === "OK" && r.rate != null && r.rate > 0);
    const average = valid.length ? valid.reduce((sum, r) => sum + r.rate, 0) / valid.length : null;
    const above = average == null ? [] : valid.filter((r) => r.rate > average * (1 + abovePercent / 100)).sort((a, b) => b.rate - a.rate);
    return { average, validCount: valid.length, above };
  }, [report, abovePercent]);
  const chosen = report?.find((r) => r.registration === selected);
  const currentMonth = (() => { const now = new Date(); return now.getFullYear() === year && now.getMonth() + 1 === month; })();
  const displayedBuses = showInactive || search.trim() ? rows : rows.filter((r) => r.liters > 0);
  const changePeriod = (next) => { setPeriod(next); setLoading(true); setReport(null); setSelected(""); setHistory(null); };
  const choose = (registration) => { if (registration !== selected) { setSelected(registration); setHistory(null); setHistoryError(""); setHistoryLoading(true); } window.setTimeout(() => document.getElementById("bt-fuel-bus-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };
  const visible = showAll ? ranked : ranked.slice(0, 8);
  return <div className="bt-page bt-ops-page bt-fuel-reports-page">
    <header className="bt-page-header"><div><span className="bt-eyebrow">Bashkim Tours · Nafta</span><h1>Dashboard i naftës</h1><p>Shiko konsumin e flotës, burimet e furnizimit dhe ecurinë e secilit autobus.</p></div></header>
    <div className="bt-fr-data-note" role="note"><Info size={19} aria-hidden="true" /><p>Regjistrimi i litrave për çdo autobus dhe i kilometrazhit ka filluar së fundmi. Sistemit i duhet kohë të grumbullojë matje të mjaftueshme; krahasimet e konsumit L/100 km do të bëhen më të sakta me të dhënat e muajve në vijim.</p></div>
    <div className="bt-fr-controls"><div className="bt-fr-period"><button type="button" aria-label="Muaji i kaluar" disabled={year === 2000 && month === 1} onClick={() => changePeriod(shiftMonth(year, month, -1))}><ArrowLeft size={17} /></button><label>Periudha <input type="month" min="2000-01" max="2100-12" value={`${year}-${String(month).padStart(2, "0")}`} onChange={(e) => { if (e.target.value) { const [y, m] = e.target.value.split("-").map(Number); changePeriod([y, m]); } }} /></label><button type="button" aria-label="Muaji tjetër" disabled={year === 2100 && month === 12} onClick={() => changePeriod(shiftMonth(year, month, 1))}><ArrowRight size={17} /></button></div><div className="bt-fr-actions"><button type="button" onClick={() => { setLoading(true); setHistory(null); setHistoryLoading(Boolean(selected)); setRetry((n) => n + 1); }}><RefreshCw size={16} /> Rifresko</button><button type="button" disabled={!report?.length} onClick={() => exportCsv(report, year, month)}><Download size={16} /> CSV</button></div></div>
    {loading && <p role="status" className="bt-fr-message">Duke ngarkuar dashboard-in…</p>}
    {error && <p className="bt-inline-error" role="alert">{error} <button type="button" onClick={() => { setLoading(true); setRetry((n) => n + 1); }}>Provo përsëri</button></p>}
    {report && <>
      <div className="bt-fr-hero"><div><span>RAPORTI MUJOR</span><h2>{monthNames[month - 1]} {year}</h2><p>{stats.active} autobusë me furnizim nga {stats.all} të regjistruar</p></div><Fuel size={47} strokeWidth={1.3} /></div>
      {stats.liters === 0 && <div className="bt-fr-zero-note" role="status"><TriangleAlert size={19} /><div><strong>Nuk ka furnizime të regjistruara për {monthNames[month - 1]} {year}.</strong><p>{currentMonth ? "Ky është muaji aktual; të dhënat shfaqen sapo regjistrohen furnizimet." : "Për këtë muaj API kthen 0 L për të gjithë autobusët."} Grafiku 12-mujor më poshtë përfshin muajt e kaluar, prandaj mund të ketë vlera edhe kur ky muaj është 0.</p></div><button type="button" onClick={() => changePeriod(shiftMonth(year, month, -1))}>Shiko muajin e kaluar <ArrowLeft size={15} /></button></div>}
      <div className="bt-fr-kpis"><article><span><Fuel size={18} /> Nafta që morën autobusët</span><strong>{number(stats.liters)} <small>L</small></strong><p>Gjithsej gjatë muajit, nga rezervari dhe jashtë</p></article><article><span><BusFront size={18} /> Autobusë aktivë</span><strong>{number(stats.active, 0)} <small>/ {number(stats.all, 0)}</small></strong><p>Me të paktën një furnizim</p></article><article><span><Gauge size={18} /> Autobusë me konsum të llogaritur</span><strong>{number(stats.valid, 0)} <small>autobusë</small></strong><p>Për këta autobusë mund të shfaqet L/100 km</p></article></div>
      <div className="bt-fr-grid"><section className="bt-fr-panel"><div className="bt-fr-panel-head"><div><span>BURIMET</span><h2>Nga vjen nafta</h2></div><small>{number(stats.liters)} L gjithsej</small></div><div className="bt-fr-source"><div className="bt-fr-donut" style={{ background: stats.liters ? `conic-gradient(#128d99 0 ${stats.tank / stats.liters * 100}%, #f2a044 ${stats.tank / stats.liters * 100}% 100%)` : "#e8eef1" }} aria-label={`${number(stats.tank)} litra nga rezervari, ${number(stats.outside)} litra nga jashtë`}><div><strong>{stats.liters ? number(stats.tank / stats.liters * 100, 0) : "0"}%</strong><small>rezervari</small></div></div><div className="bt-fr-legend"><div><i className="is-tank" /><span>Rezervari<strong>{number(stats.tank)} L</strong></span></div><div><i className="is-outside" /><span>Jashtë<strong>{number(stats.outside)} L</strong></span></div></div></div></section>
      <section className="bt-fr-panel"><div className="bt-fr-panel-head"><div><span>FLOTA</span><h2>Nafta sipas autobusit</h2></div><small>Top {Math.min(visible.length, 8)} sipas litrave</small></div><div className="bt-fr-bar-list">{visible.map((r) => <button type="button" key={r.registration} className={selected === r.registration ? "active" : ""} onClick={() => choose(r.registration)}><span>{r.registration}</span><i><b style={{ width: `${r.liters / Math.max(1, ranked[0]?.liters) * 100}%` }} /></i><strong>{number(r.liters)} L</strong></button>)}{!ranked.length && <p className="bt-fr-empty">Nuk ka furnizime për këtë përzgjedhje.</p>}</div>{ranked.length > 8 && <button className="bt-fr-show-all" type="button" onClick={() => setShowAll((v) => !v)}>{showAll ? "Shfaq më pak" : `Shfaq të gjithë (${ranked.length})`}</button>}</section></div>
      <section className="bt-fr-panel bt-fr-efficiency"><div className="bt-fr-panel-head"><div><span>KRAHASIMI I KONSUMIT</span><h2>Autobusët mbi mesataren e flotës</h2><p>Mesatare e thjeshtë e konsumit L/100 km për {efficiency.validCount} autobusë me matje të vlefshme.</p></div><div className="bt-fr-average"><small>Mesatarja</small><strong>{number(efficiency.average)} <span>L/100 km</span></strong></div></div><div className="bt-fr-threshold"><span>Shfaq autobusët që e kalojnë mesataren me</span><div role="group" aria-label="Pragu mbi mesatare">{[0, 10, 20].map((percent) => <button key={percent} type="button" className={abovePercent === percent ? "active" : ""} onClick={() => setAbovePercent(percent)}>+{percent}%</button>)}</div></div>{efficiency.average == null ? <p className="bt-fr-empty">Nuk ka matje të vlefshme L/100 km për këtë muaj. Zgjidh një muaj tjetër për krahasim.</p> : efficiency.above.length ? <><p className="bt-fr-efficiency-count">{efficiency.above.length} autobusë mbi pragun e zgjedhur · Renditur sipas konsumit</p><div className="bt-fr-efficiency-list">{efficiency.above.map((r) => { const excess = (r.rate / efficiency.average - 1) * 100; return <button type="button" key={r.registration} onClick={() => choose(r.registration)}><span className="bt-fr-efficiency-plate"><BusFront size={18} />{r.registration}</span><span className="bt-fr-efficiency-track"><i style={{ width: `${Math.min(100, r.rate / Math.max(efficiency.average * 2, efficiency.above[0].rate) * 100)}%` }} /></span><strong>{number(r.rate)} <small>L/100 km</small></strong><em>+{number(excess, 0)}%</em><ArrowRight size={15} /></button>; })}</div><p className="bt-fr-efficiency-note">Kjo listë është sinjal për verifikim, jo diagnozë e defektit. Ngarkesa, rruga dhe cilësia e leximeve të kilometrazhit mund të ndikojnë te krahasimi.</p></> : <p className="bt-fr-empty">Asnjë autobus nuk e kalon mesataren me më shumë se {abovePercent}% këtë muaj.</p>}</section>
      <section className="bt-fr-panel bt-fr-explorer"><div className="bt-fr-panel-head"><div><span>ANALIZA</span><h2>Zgjidh një autobus</h2></div><label className="bt-fr-search"><Search size={17} /><input type="search" placeholder="Kërko targën…" value={search} onChange={(e) => setSearch(e.target.value)} /></label></div><div className="bt-fr-bus-grid">{displayedBuses.map((r) => <button type="button" key={r.registration} className={`bt-fr-bus ${selected === r.registration ? "active" : ""}`} onClick={() => choose(r.registration)}><span><BusFront size={17} />{r.registration}</span><strong>{number(r.liters)} L</strong><small>{r.rate == null ? statusText[r.status] ?? "Pa matje" : `${number(r.rate)} L/100 km`}</small></button>)}</div>{!displayedBuses.length && <p className="bt-fr-empty">{rows.length ? "Nuk ka autobusë me furnizim në këtë muaj." : "Nuk u gjet asnjë autobus."}</p>}{!search.trim() && rows.length > displayedBuses.length && <button type="button" className="bt-fr-show-all" onClick={() => setShowInactive(true)}>Shfaq edhe {rows.length - displayedBuses.length} autobusë pa furnizim</button>}{showInactive && !search.trim() && <button type="button" className="bt-fr-show-all" onClick={() => setShowInactive(false)}>Fshih autobusët pa furnizim</button>}</section>

    </>}
    {selected && <section id="bt-fuel-bus-detail" className="bt-fr-panel bt-fr-detail"><div className="bt-fr-panel-head"><div><span>ANALIZA 12-MUJORE</span><h2><BusFront size={24} /> {selected}</h2><p>Deri në {monthNames[month - 1]} {year} · Muajt e kaluar mund të kenë furnizime edhe kur periudha e zgjedhur është 0 L.</p></div><button type="button" className="bt-fr-close" onClick={() => setSelected("")}>Mbyll</button></div>{chosen && <div className="bt-fr-detail-stats"><span>Gjithsej <strong>{number(chosen.liters)} L</strong></span><span>Rezervari <strong>{number(chosen.tank)} L</strong></span><span>Jashtë <strong>{number(chosen.outside)} L</strong></span><span>Kilometra <strong>{number(chosen.km, 0)} km</strong></span><span>Konsumi <strong>{number(chosen.rate)} L/100 km</strong></span></div>}{historyLoading && <p role="status" className="bt-fr-message">Duke ngarkuar historikun…</p>}{historyError && <p className="bt-inline-error" role="alert">{historyError} <button type="button" onClick={() => { setHistoryLoading(true); setRetry((n) => n + 1); }}>Provo përsëri</button></p>}{history && <><div className="bt-fr-trend-head"><h3>Ecuria mujore</h3><div role="group" aria-label="Metrika e grafikut"><button className={trendMetric === "liters" ? "active" : ""} type="button" onClick={() => setTrendMetric("liters")}>Litra</button><button className={trendMetric === "rate" ? "active" : ""} type="button" onClick={() => setTrendMetric("rate")}>L/100 km</button><button className={trendMetric === "km" ? "active" : ""} type="button" onClick={() => setTrendMetric("km")}>Km</button></div></div><TrendChart rows={history} metric={trendMetric} color={trendMetric === "rate" ? "#ed9c3f" : "#128d99"} unit={trendMetric === "rate" ? "L/100 km" : trendMetric === "km" ? "km" : "L"} /><div className="bt-fr-history-cards">{history.map((r) => <div key={`${r.year}-${r.month}`}><small>{months[r.month - 1]} {r.year}</small><strong>{number(r.liters)} L</strong><span>{r.rate == null ? statusText[r.status] ?? "Pa matje" : `${number(r.rate)} L/100 km`}</span></div>)}</div></>}</section>}
  </div>;
}
