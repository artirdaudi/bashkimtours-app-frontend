import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { fuelExternalCustomersApi, fuelLedgerApi, fuelRefuellingLocationsApi, fuelSuppliersApi } from "./api";
import CharterReferencePicker from "./CharterReferencePicker";
import DateInput from "./DateInput";
import { Modal } from "./PortalPages";
import { formatDateTime } from "./dateUtils";

const typeNames = { INCOMING: "Hyrje", BT_OUTGOING: "Dalje BT", EXTERNAL_CUSTOMER: "Klient i jashtëm", EXTERNAL_REFUELLING: "Furnizim jashtë" };
const initialFilters = { search: "", date_from: "", date_to: "", source_type: "", registration_number: "", supplier_id: "", external_customer_id: "", location_id: "", min_liters: "", max_liters: "", min_odometer: "", max_odometer: "", is_settled: "", sort_order: "desc" };
const number = (value, decimals = 2) => value == null ? "—" : new Intl.NumberFormat("sq-AL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(value));
const liters = (value) => value == null ? "—" : `${number(value)} L`;
const amount = (value) => value == null ? "—" : number(value);
const person = (row) => row.source_type === "INCOMING" ? row.supplier_name : row.source_type === "EXTERNAL_CUSTOMER" ? row.external_customer_name : row.driver_name || (row.source_type === "BT_OUTGOING" && row.piusi_driver_id != null ? `PIUSI ID: ${row.piusi_driver_id}` : null);
const status = (row) => row.source_type !== "EXTERNAL_CUSTOMER" || row.is_settled == null ? "—" : row.is_settled ? "Paguar" : "Pa paguar";
const hasFilters = (filters) => Object.entries(filters).some(([key, value]) => key !== "sort_order" && value !== "");
const choice = (id, label, meta) => ({ id: String(id), label, meta });
const locationLabel = (value) => value?.trim().toLocaleLowerCase("sq-AL") === "rezervari kryesor" ? "GARAZHA-TANKER" : value || "—";

function Picker({ label, value, options, onChange }) {
  const searchOptions = useCallback((query) => options.filter((item) => `${item.label} ${item.meta || ""}`.toLocaleLowerCase("sq-AL").includes(query.toLocaleLowerCase("sq-AL"))), [options]);
  return <div className="bt-external-dropdown"><span>{label}</span><CharterReferencePicker label={label} value={value} selectedLabel={options.find((item) => item.id === String(value))?.label || ""} placeholder={`Kërko ${label.toLocaleLowerCase("sq-AL")}`} searchOptions={searchOptions} onSelect={(option) => onChange(option?.id || "")} /></div>;
}

export default function FuelLedgerPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const [options, setOptions] = useState({ suppliers: [], customers: [], locations: [] });
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const [selected, setSelected] = useState(null);
  const optionsLoaded = useRef(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true); setError("");
      fuelLedgerApi.list({ ...filters, page, page_size: pageSize }).then((data) => { if (active) setResult(data); }).catch((cause) => { if (active) { setResult(null); setError(cause.message); } }).finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [filters, page, pageSize, retry]);

  useEffect(() => {
    const refresh = () => setRetry((value) => value + 1);
    window.addEventListener("bt:fuel-reconnected", refresh);
    return () => window.removeEventListener("bt:fuel-reconnected", refresh);
  }, []);

  const change = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const loadOptions = async () => {
    if (optionsLoaded.current || optionsLoading) return;
    optionsLoaded.current = true;
    setOptionsLoading(true); setOptionsError("");
    const responses = await Promise.allSettled([fuelSuppliersApi.list({ limit: 1000 }), fuelExternalCustomersApi.list(), fuelRefuellingLocationsApi.list()]);
    setOptions({ suppliers: responses[0].status === "fulfilled" ? responses[0].value : [], customers: responses[1].status === "fulfilled" ? responses[1].value : [], locations: responses[2].status === "fulfilled" ? responses[2].value : [] });
    if (responses.some((item) => item.status === "rejected")) { setOptionsError("Disa opsione nuk u ngarkuan."); optionsLoaded.current = false; }
    setOptionsLoading(false);
  };
  const openAdvanced = () => { setAdvanced((value) => !value); if (!advanced) loadOptions(); };
  const clear = () => { setSearchInput(""); setFilters(initialFilters); setPage(1); };
  const input = (key, label, type = "text", props = {}) => <label key={key}>{label}{type === "date" ? <DateInput value={filters[key]} onChange={(value) => change(key, value)} /> : <input type={type} value={filters[key]} onChange={(event) => change(key, event.target.value)} {...props} />}</label>;
  const select = (key, label, choices) => <Picker key={key} label={label} value={filters[key]} options={choices.filter(([value]) => value !== "").map(([value, text]) => choice(value, text))} onChange={(value) => change(key, value || (key === "sort_order" ? "desc" : ""))} />;
  const pagination = result?.pagination;
  const start = pagination?.total ? (pagination.page - 1) * pagination.page_size + 1 : 0;
  const end = pagination ? Math.min(pagination.page * pagination.page_size, pagination.total) : 0;

  return <div className="bt-page bt-ops-page bt-fuel-ledger-page">
    <header className="bt-page-header"><div><span className="bt-eyebrow">Bashkim Tours · Nafta</span><h1>Komplet</h1><p>Pasqyra e plotë e hyrjeve dhe daljeve të naftës.</p></div></header>
    <form className="bt-external-refuelling-filters bt-fuel-ledger-filters" onSubmit={(event) => { event.preventDefault(); change("search", searchInput.trim()); }}><div className="bt-fuel-filters"><label>Kërko<input type="search" placeholder="Kërko sipas targës, shoferit, furnitorit, klientit…" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label>{input("date_from", "Nga data", "date")}{input("date_to", "Deri më", "date")}{select("source_type", "Lloji", [["", "Të gjitha"], ...Object.entries(typeNames)])}{select("sort_order", "Renditja", [["desc", "Më të rejat"], ["asc", "Më të vjetrat"]])}</div><div className="bt-fuel-ledger-filter-toolbar"><button type="button" className="bt-btn-secondary" aria-expanded={advanced} onClick={openAdvanced}>Filtra shtesë <ChevronDown size={16} /></button><div className="bt-external-filter-actions"><button type="submit" className="bt-btn-primary"><Search size={16} /> Kërko</button>{hasFilters(filters) && <button type="button" className="bt-btn-secondary" onClick={clear}><X size={15} /> Pastro filtrat</button>}</div></div>
    {advanced && <div className="bt-fuel-ledger-advanced"><div className="bt-fuel-filters">{input("registration_number", "Targa", "text", { placeholder: "Kërko targën" })}{select("is_settled", "Pagesa", [["", "Të gjitha"], ["true", "Paguar"], ["false", "Pa paguar"]])}{input("min_liters", "Litra min.", "number", { min: 0, step: "any" })}{input("max_liters", "Litra max.", "number", { min: 0, step: "any" })}{input("min_odometer", "Km min.", "number", { min: 0, step: "any" })}{input("max_odometer", "Km max.", "number", { min: 0, step: "any" })}<Picker label="Furnitori" value={filters.supplier_id} options={options.suppliers.map((item) => choice(item.id, item.name))} onChange={(value) => change("supplier_id", value)} /><Picker label="Klienti i jashtëm" value={filters.external_customer_id} options={options.customers.map((item) => choice(item.id, [item.registration_number, item.first_name, item.last_name].filter(Boolean).join(" · ")))} onChange={(value) => change("external_customer_id", value)} /><Picker label="Lokacioni" value={filters.location_id} options={options.locations.map((item) => choice(item.id, item.name, item.location))} onChange={(value) => change("location_id", value)} /></div>{optionsLoading && <p role="status">Duke ngarkuar opsionet…</p>}{optionsError && <p className="bt-inline-error" role="alert">{optionsError} <button type="button" onClick={loadOptions}>Provo përsëri</button></p>}</div>}</form>
    {error && <p className="bt-inline-error" role="alert">{error} <button type="button" onClick={() => setRetry((value) => value + 1)}>Provo përsëri</button></p>}
    {loading && <p role="status" className="bt-fuel-ledger-loading">Duke ngarkuar transaksionet…</p>}
    {result && <><div className="bt-fuel-ledger-legend" aria-label="Legjenda e llojeve të transaksioneve"><strong>Legjenda</strong>{Object.entries(typeNames).map(([type, label]) => <span key={type}><i className={`is-${type.toLowerCase()}`} aria-hidden="true" />{label}</span>)}</div><div className="bt-fuel-ledger-table-wrap" aria-busy={loading}><table className="bt-fuel-table bt-fuel-ledger-table"><thead><tr><th>Data</th><th>Lloji</th><th>Targa</th><th>Litra</th><th>Km</th><th>Shoferi / Furnitori / Klienti</th><th>Lokacioni</th></tr></thead><tbody>{result.items.map((row) => <tr key={`${row.source_type}:${row.source_id}`} className={`is-${row.source_type.toLowerCase()}`} onClick={() => setSelected(row)} tabIndex={0} role="button" aria-label={`Shiko transaksionin ${typeNames[row.source_type]} të datës ${formatDateTime(row.transaction_date)}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(row); } }}><td data-label="Data">{formatDateTime(row.transaction_date)}</td><td data-label="Lloji"><span className={`bt-fuel-ledger-type is-${row.source_type.toLowerCase()}`}>{typeNames[row.source_type]}</span></td><td data-label="Targa">{row.registration_number || "—"}</td><td data-label="Litra">{liters(row.quantity_liters)}</td><td data-label="Km">{number(row.odometer_km, 0)}</td><td data-label="Personi">{person(row) || "—"}</td><td data-label="Lokacioni">{locationLabel(row.location_name)}</td></tr>)}</tbody></table>{!loading && !error && !result.items.length && <div className="bt-fuel-suppliers-empty"><strong>Nuk u gjet asnjë transaksion.</strong><p>Ndryshoni filtrat për të parë rezultate të tjera.</p></div>}</div><div className="bt-fuel-transaction-pagination"><button type="button" className="bt-btn-secondary" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Mbrapa</button><span>{start}–{end} nga {number(pagination.total, 0)} rezultate</span><button type="button" className="bt-btn-secondary" disabled={loading || page >= pagination.total_pages} onClick={() => setPage(page + 1)}>Tjetër</button><label>Rreshta <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option>25</option><option>50</option><option>100</option></select></label></div></>}
    {selected && <Modal title="Detajet e transaksionit" className="bt-fuel-supplier-modal bt-fuel-ledger-detail" onClose={() => setSelected(null)}><dl>{[["Data", formatDateTime(selected.transaction_date)], ["Lloji", typeNames[selected.source_type]], ["Targa", selected.registration_number], ["Litra", liters(selected.quantity_liters)], ["Km", number(selected.odometer_km, 0)], ["Shoferi / Furnitori / Klienti", person(selected)], ["Lokacioni", locationLabel(selected.location_name)], ["Kartela", selected.card], ["Çmimi për litër", amount(selected.unit_price)], ["Shuma", amount(selected.total_amount)], ["Statusi", status(selected)], ["Paguar më", selected.settled_at ? formatDateTime(selected.settled_at) : null], ["Koment", selected.comment]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl></Modal>}
  </div>;
}
