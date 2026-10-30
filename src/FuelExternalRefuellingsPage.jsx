import { useCallback, useEffect, useState } from "react";
import { MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { fuelExternalRefuellingsApi } from "./api";
import { confirmAction } from "./confirmAction";
import { Modal } from "./PortalPages";
import CharterReferencePicker from "./CharterReferencePicker";
import DateInput from "./DateInput";
import { formatDate } from "./dateUtils";

const colors = { GREEN: "Gjelbër", ORANGE: "Portokalli", YELLOW: "Verdhë", RED: "Kuqe" };
const emptyFilters = { search: "", date_from: "", date_to: "", bus: "", driver_id: "", location_id: "", color: "", min_liters: "", max_liters: "", min_odometer: "", max_odometer: "" };
const emptyForm = { id: null, refuelling_date: "", bus: "", quantity_liters: "", odometer_km: "", driver_id: "", location_id: "", color: "", card: "", comment: "" };
const busKey = (bus) => bus ? `${bus.source}:${bus.id}` : "";
const numberText = (value) => value == null ? "—" : new Intl.NumberFormat("sq-AL", { maximumFractionDigits: 2 }).format(Number(value));
const dateText = (value) => formatDate(value) || "—";
const colorOptions = Object.entries(colors).map(([id, label]) => ({ id, label }));

function Dropdown({ label, value, choices, onChange, placeholder }) {
  const searchOptions = useCallback((query) => choices.filter((item) => `${item.label} ${item.meta || ""}`.toLocaleLowerCase("sq-AL").includes(query.toLocaleLowerCase("sq-AL"))), [choices]);
  return <div className="bt-external-dropdown"><span>{label}</span><CharterReferencePicker label={label} value={value} selectedLabel={choices.find((item) => String(item.id) === String(value))?.label || ""} placeholder={placeholder || `Kërko ${label.toLocaleLowerCase("sq-AL")}`} searchOptions={searchOptions} onSelect={(option) => onChange(option ? String(option.id) : "")} /></div>;
}

export default function FuelExternalRefuellingsPage() {
  const [result, setResult] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);
  const [colorMenu, setColorMenu] = useState(null);
  const options = result?.options || { buses: [], drivers: [], locations: [] };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { bus, ...rest } = applied;
    const [busSource, busId] = bus ? bus.split(":") : [];
    const params = { ...rest, page: page === 1 ? undefined : page, page_size: pageSize === 30 ? undefined : pageSize, bus_source: busSource, bus_id: busId };
    try { setResult(await fuelExternalRefuellingsApi.list(params)); }
    catch (cause) { setResult(null); setError(cause.message); }
    finally { setLoading(false); }
  }, [applied, page, pageSize]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load, reload]);

  useEffect(() => {
    window.addEventListener("bt:fuel-reconnected", load);
    return () => window.removeEventListener("bt:fuel-reconnected", load);
  }, [load]);

  const applyFilters = (next) => { setFilters(next); setPage(1); setApplied(next); };
  const openEdit = (row) => { setDetail(null); setForm({ id: row.id, refuelling_date: row.refuelling_date, bus: busKey(row.bus), quantity_liters: row.quantity_liters, odometer_km: row.odometer_km ?? "", driver_id: row.driver?.id ?? "", location_id: row.location?.id ?? "", color: row.color ?? "", card: row.card ?? "", comment: row.comment ?? "" }); };
  const save = async (event) => {
    event.preventDefault();
    const selectedBus = options.buses.find((item) => busKey(item) === form.bus);
    if (form.bus && !selectedBus) { setError("Zgjidh një autobus nga lista."); return; }
    setBusy(true); setError("");
    const body = { refuelling_date: form.refuelling_date, bus_source: selectedBus?.source ?? null, bus_id: selectedBus?.id ?? null, quantity_liters: form.quantity_liters, odometer_km: form.odometer_km === "" ? null : form.odometer_km, driver_id: form.driver_id || null, location_id: form.location_id === "" ? null : Number(form.location_id), color: form.color || null, card: form.card.trim() || null, comment: form.comment.trim() || null };
    try {
      if (form.id == null) await fuelExternalRefuellingsApi.create(body);
      else await fuelExternalRefuellingsApi.update(form.id, body);
      setForm(null); setReload((value) => value + 1);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const remove = async (row) => {
    if (busy || !await confirmAction(`Të fshihet furnizimi i datës ${dateText(row.refuelling_date)}?`)) return;
    setBusy(true); setError("");
    try { await fuelExternalRefuellingsApi.remove(row.id); setDetail(null); if (page > 1 && result.items.length === 1) setPage(page - 1); else setReload((value) => value + 1); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const changeColor = async (row, color) => {
    if (busy) return;
    setBusy(true); setError(""); setColorMenu(null);
    const body = { refuelling_date: row.refuelling_date, bus_source: row.bus?.source ?? null, bus_id: row.bus?.id ?? null, quantity_liters: row.quantity_liters, odometer_km: row.odometer_km, driver_id: row.driver?.id ?? null, location_id: row.location?.id ?? null, color, card: row.card, comment: row.comment };
    try {
      const updated = await fuelExternalRefuellingsApi.update(row.id, body);
      setResult((previous) => ({ ...previous, items: previous.items.map((item) => item.id === row.id ? updated : item) }));
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const field = (key, label, type = "text", props = {}) => <label key={key}>{label}{type === "date" ? <DateInput value={filters[key]} onChange={(value) => setFilters({ ...filters, [key]: value })} /> : <input type={type} value={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })} {...props} />}</label>;
  const select = (key, label, choices) => <Dropdown key={key} label={label} value={filters[key]} choices={choices} onChange={(value) => setFilters({ ...filters, [key]: value })} />;

  return <div className="bt-page bt-ops-page bt-external-refuellings-page">
    <header className="bt-page-header"><div><span className="bt-eyebrow">BASHKIM TOURS · NAFTA</span><h1>Furnizimet e jashtme</h1></div><button type="button" className="bt-btn-primary" onClick={() => { setError(""); setForm({ ...emptyForm, refuelling_date: new Date().toLocaleDateString("en-CA") }); }}><Plus size={18} /> Furnizim i ri</button></header>
    <form className="bt-external-refuelling-filters" onSubmit={(event) => { event.preventDefault(); applyFilters(filters); }}>
      <div className="bt-fuel-filters">{field("search", "Kërko", "search", { placeholder: "Targa, shoferi, lokacioni" })}{field("date_from", "Nga data", "date")}{field("date_to", "Deri më", "date")}{select("bus", "Autobusi", options.buses.map((item) => ({ id: busKey(item), label: item.registration_number, meta: item.source })))}{select("driver_id", "Shoferi", options.drivers.map((item) => ({ id: item.id, label: item.name })))}{select("location_id", "Lokacioni", options.locations.map((item) => ({ id: item.id, label: item.name, meta: item.location })))}{select("color", "Ngjyra", colorOptions)}</div>
      <div className="bt-external-filter-toolbar"><div className="bt-external-filter-actions"><button type="submit" className="bt-btn-primary" disabled={loading}><Search size={16} /> Kërko</button><button type="button" className="bt-btn-secondary" onClick={() => applyFilters({ ...emptyFilters })}>Pastro filtrat</button></div></div>
    </form>
    {error && !form && <p className="bt-inline-error" role="alert">{error} <button type="button" onClick={() => setReload((value) => value + 1)}>Provo përsëri</button></p>}
    {loading && <p role="status">Duke ngarkuar furnizimet…</p>}
    {!loading && result && <><div className="bt-external-table-wrap"><table className="bt-fuel-table bt-external-table"><thead><tr><th>Data</th><th>Targa</th><th>Litrazha (L)</th><th>Km</th><th>Shoferi</th><th>Lokacioni</th><th>Kartela</th></tr></thead><tbody>{result.items.map((row) => <tr key={row.id} className={`bt-external-clickable-row${row.color ? ` bt-external-row-${row.color.toLowerCase()}` : ""}`} tabIndex={0} role="button" aria-label={`Shiko furnizimin e datës ${dateText(row.refuelling_date)}`} onClick={() => { setColorMenu(null); setError(""); setDetail(row); }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setColorMenu(null); setError(""); setDetail(row); } }}><td data-label="Data">{dateText(row.refuelling_date)}</td><td data-label="Targa">{row.bus?.registration_number || "—"}</td><td data-label="Litrazha (L)">{numberText(row.quantity_liters)}</td><td data-label="Km">{numberText(row.odometer_km)}</td><td data-label="Shoferi">{row.driver?.name || "—"}</td><td data-label="Lokacioni">{row.location?.name || "—"}</td><td data-label="Kartela" className="bt-external-card-cell"><span>{row.card || "—"}</span><div className="bt-external-row-menu" onClick={(event) => event.stopPropagation()}><button type="button" className="bt-external-row-menu-toggle" aria-label={`Ngjyros furnizimin e datës ${dateText(row.refuelling_date)}`} aria-expanded={colorMenu === row.id} disabled={busy} onClick={() => setColorMenu(colorMenu === row.id ? null : row.id)}><MoreVertical size={18} /></button>{colorMenu === row.id && <div className="bt-external-color-options" role="group" aria-label="Zgjidh ngjyrën">{[...Object.keys(colors), null].map((color) => <button key={color || "NONE"} type="button" className={`bt-external-color-choice bt-external-color-choice-${(color || "none").toLowerCase()}${row.color === color ? " is-selected" : ""}`} aria-label={color ? colors[color] : "Pa ngjyrë"} aria-pressed={row.color === color} title={color ? colors[color] : "Pa ngjyrë"} onClick={() => changeColor(row, color)} />)}</div>}</div></td></tr>)}</tbody></table>{!result.items.length && <p className="bt-fuel-suppliers-empty">Nuk u gjet asnjë furnizim.</p>}</div><div className="bt-fuel-transaction-pagination"><button type="button" className="bt-btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Mbrapa</button><span>Faqja {result.pagination.page} nga {result.pagination.total_pages || 1} · {result.pagination.total_items} furnizime</span><button type="button" className="bt-btn-secondary" disabled={page >= result.pagination.total_pages} onClick={() => setPage(page + 1)}>Tjetër</button><label>Rreshta <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option>10</option><option>30</option><option>50</option><option>100</option></select></label></div></>}
    {detail && <Modal title="Detajet e furnizimit" className="bt-fuel-supplier-modal bt-external-detail-modal" onClose={() => { if (!busy) { setDetail(null); setError(""); } }}><div>{error && <p className="bt-inline-error" role="alert">{error}</p>}<dl className="bt-external-detail-list"><div><dt>Data</dt><dd>{dateText(detail.refuelling_date)}</dd></div><div><dt>Targa</dt><dd>{detail.bus?.registration_number || "—"}</dd></div><div><dt>Litrazha</dt><dd>{numberText(detail.quantity_liters)} L</dd></div><div><dt>Kilometrazha</dt><dd>{numberText(detail.odometer_km)}</dd></div><div><dt>Shoferi</dt><dd>{detail.driver?.name || "—"}</dd></div><div><dt>Lokacioni</dt><dd>{detail.location?.name || "—"}</dd></div><div><dt>Ngjyra</dt><dd>{detail.color ? colors[detail.color] : "—"}</dd></div><div><dt>Kartela</dt><dd>{detail.card || "—"}</dd></div><div><dt>Koment</dt><dd>{detail.comment || "—"}</dd></div></dl><div className="bt-fuel-actions"><button type="button" className="bt-btn-secondary" disabled={busy} onClick={() => openEdit(detail)}><Pencil size={16} /> Ndrysho</button><button type="button" className="bt-btn-secondary" disabled={busy} onClick={() => remove(detail)}><Trash2 size={16} /> Fshi</button></div></div></Modal>}
    {form && <Modal title={form.id == null ? "Furnizim i ri" : "Ndrysho furnizimin"} className="bt-fuel-supplier-modal bt-external-form-modal" onClose={() => { if (!busy) { setForm(null); setError(""); } }}><form onSubmit={save}>{error && <p className="bt-inline-error" role="alert">{error}</p>}<div className="bt-fuel-fields"><label>Data<DateInput required value={form.refuelling_date} onChange={(value) => setForm({ ...form, refuelling_date: value })} /></label><Dropdown label="Autobusi / Targa" value={form.bus} choices={options.buses.map((item) => ({ id: busKey(item), label: item.registration_number, meta: item.source }))} onChange={(value) => setForm({ ...form, bus: value })} placeholder="Kërko targën" /><label>Litrazha (L)<input required type="number" min="0.001" step="any" value={form.quantity_liters} onChange={(event) => setForm({ ...form, quantity_liters: event.target.value })} /></label><label>Kilometrazha<input type="number" min="0" step="any" value={form.odometer_km} onChange={(event) => setForm({ ...form, odometer_km: event.target.value })} /></label><Dropdown label="Shoferi" value={form.driver_id} choices={options.drivers.map((item) => ({ id: item.id, label: item.name }))} onChange={(value) => setForm({ ...form, driver_id: value })} /><Dropdown label="Lokacioni" value={form.location_id} choices={options.locations.map((item) => ({ id: item.id, label: item.name, meta: item.location }))} onChange={(value) => setForm({ ...form, location_id: value })} /><label>Kartela<input value={form.card} onChange={(event) => setForm({ ...form, card: event.target.value })} /></label>{form.id != null && <label className="bt-external-comment-field">Koment<textarea rows={3} value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} /></label>}</div><div className="bt-fuel-actions"><button type="button" className="bt-btn-secondary" disabled={busy} onClick={() => setForm(null)}>Anulo</button><button type="submit" className="bt-btn-primary" disabled={busy}>{busy ? "Duke ruajtur…" : "Ruaj"}</button></div></form></Modal>}
  </div>;
}
