import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Fuel, Info, LoaderCircle, Pencil, Plus } from "lucide-react";
import { fuelSuppliersApi, fuelTanksApi, fuelTransactionsApi } from "./api";
import { Modal } from "./PortalPages";
import CharterDateTimeField from "./CharterDateTimeField";
import CharterReferencePicker from "./CharterReferencePicker";
import { formatDateTime } from "./dateUtils";

const fuelTypes = { DIESEL: "Naftë", PETROL: "Benzinë", ADBLUE: "AdBlue" };
const liters = (value) => `${new Intl.NumberFormat("sq-AL", { maximumFractionDigits: 2 }).format(Number(value || 0))} L`;
const money = (value, currency) => value == null ? "—" : new Intl.NumberFormat("sq-AL", currency ? { style: "currency", currency } : { maximumFractionDigits: 2 }).format(Number(value));
const detailValue = (value) => value == null || value === "" ? "—" : value;
const vehicleLabel = (vehicle) => vehicle ? [vehicle.registration_number, vehicle.brand, vehicle.type].filter(Boolean).join(" · ") : "";
const transactionMapping = (transaction) => transaction.transaction_type === "INCOMING" ? "incoming" : transaction.vehicle ? "vehicle" : transaction.external_customer ? "external" : transaction.piusi_detail?.registration_number?.trim() ? "unmapped" : "outgoing";
const externalCustomerLabel = (customer) => [customer.registration_number, [customer.first_name, customer.last_name].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
const calculatedTotal = (quantity, unitPrice) => {
  if (quantity === "" || unitPrice === "") return "";
  const total = Number(quantity) * Number(unitPrice);
  return Number.isFinite(total) && total > 0 ? Number(total.toPrecision(12)).toString() : "";
};
const localDateTime = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const pageSize = 20;
const tankId = 1;

export default function FuelTanksPage() {
  const [tanks, setTanks] = useState([]);
  const [transactions, setTransactions] = useState({});
  const [transactionPages, setTransactionPages] = useState({});
  const [transactionFilter, setTransactionFilter] = useState("");
  const [loadingPageId, setLoadingPageId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [transactionError, setTransactionError] = useState("");
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const initialLoadStarted = useRef(false);
  const transactionsRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setTransactionError("");
    try {
      const [tankResult, historyResult] = await Promise.allSettled([
        fuelTanksApi.get(tankId),
        fuelTransactionsApi.list({ tank_id: tankId, transaction_type: transactionFilter, limit: pageSize + 1, offset: 0 }),
      ]);
      if (tankResult.status === "fulfilled") setTanks([tankResult.value]);
      else setError(`Rezervari: ${tankResult.reason.message}`);
      if (historyResult.status === "fulfilled") {
        const history = historyResult.value;
        setTransactions({ [tankId]: { items: history.slice(0, pageSize), hasNext: history.length > pageSize } });
      } else setTransactionError(`Transaksionet: ${historyResult.reason.message}`);
      setTransactionPages({});
    } catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }, [transactionFilter]);
  useEffect(() => {
    if (initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    Promise.resolve().then(load);
  }, [load]);

  const changeFilter = async (type) => {
    if (type === transactionFilter || loadingPageId != null) return;
    setLoadingPageId(tankId);
    setError("");
    try {
      const rows = await fuelTransactionsApi.list({ tank_id: tankId, transaction_type: type, limit: pageSize + 1, offset: 0 });
      setTransactions((current) => ({ ...current, [tankId]: { items: rows.slice(0, pageSize), hasNext: rows.length > pageSize } }));
      setTransactionPages({});
      setTransactionFilter(type);
    } catch (cause) { setError(cause.message); }
    finally { setLoadingPageId(null); }
  };

  const changePage = async (tankId, nextPage) => {
    if (nextPage < 0 || loadingPageId != null) return;
    setLoadingPageId(tankId);
    setError("");
    try {
      const rows = await fuelTransactionsApi.list({ tank_id: tankId, transaction_type: transactionFilter, limit: pageSize + 1, offset: nextPage * pageSize });
      setTransactions((current) => ({ ...current, [tankId]: { items: rows.slice(0, pageSize), hasNext: rows.length > pageSize } }));
      setTransactionPages((current) => ({ ...current, [tankId]: nextPage }));
      requestAnimationFrame(() => transactionsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
    } catch (cause) { setError(cause.message); }
    finally { setLoadingPageId(null); }
  };

  const save = async (event) => {
    event.preventDefault();
    const capacity = Number(form.capacity_liters);
    const quantity = Number(form.current_quantity_liters);
    const threshold = Number(form.low_level_threshold_liters);
    if (!form.name.trim() || capacity <= 0 || quantity < 0 || threshold < 0 || quantity > capacity || threshold > capacity) {
      setError("Kontrollo emrin dhe sasitë: kapaciteti duhet të jetë pozitiv, ndërsa sasia dhe pragu duhet të jenë mes 0 dhe kapacitetit.");
      return;
    }
    setBusy(true);
    setError("");
    const body = { name: form.name.trim(), fuel_type: form.fuel_type, capacity_liters: capacity, current_quantity_liters: quantity, low_level_threshold_liters: threshold };
    try {
      if (editingId != null) await fuelTanksApi.update(editingId, body);
      else await fuelTanksApi.create(body);
      setForm(null);
      setEditingId(null);
      await load();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  const edit = (tank) => {
    setEditingId(tank.id);
    setForm({ name: tank.name, fuel_type: tank.fuel_type, capacity_liters: tank.capacity_liters, current_quantity_liters: tank.current_quantity_liters, low_level_threshold_liters: tank.low_level_threshold_liters });
    setError("");
  };
  const closeForm = () => {
    if (busy) return;
    setForm(null);
    setEditingId(null);
    setError("");
  };
  const openIncoming = async (id) => {
    setIncoming({ tank_id: id, quantity_liters: "", transaction_date: localDateTime(), supplier_id: "", unit_price: "", total_amount: "", currency: "EUR", comment: "" });
    setError("");
    setSupplierLoading(true);
    try { setSuppliers(await fuelSuppliersApi.list({ limit: 1000 })); }
    catch (cause) { setError(cause.message); }
    finally { setSupplierLoading(false); }
  };
  const showTransaction = async (transaction) => {
    setError("");
    setSelectedTransaction(transaction);
    const supplierId = transaction.incoming_detail?.supplier_id;
    if (supplierId && !suppliers.some((supplier) => supplier.id === supplierId)) {
      try {
        const supplier = await fuelSuppliersApi.get(supplierId);
        setSuppliers((current) => current.some((item) => item.id === supplier.id) ? current : [...current, supplier]);
      } catch { /* The transaction details still remain available if a supplier was removed. */ }
    }
  };
  const addIncoming = async (event) => {
    event.preventDefault();
    const quantity = Number(incoming.quantity_liters);
    if (!Number.isFinite(quantity) || quantity <= 0) { setError("Sasia duhet të jetë më e madhe se zero."); return; }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(incoming.transaction_date) || Number.isNaN(new Date(incoming.transaction_date).getTime())) { setError("Zgjidh datën dhe orën e transaksionit."); return; }
    if (!incoming.supplier_id) { setError("Zgjidh furnitorin."); return; }
    for (const key of ["unit_price", "total_amount"]) {
      if (incoming[key] !== "" && (!Number.isFinite(Number(incoming[key])) || Number(incoming[key]) <= 0)) { setError("Çmimi dhe shuma totale duhet të jenë më të mëdha se zero."); return; }
    }
    setBusy(true);
    setError("");
    try {
      const created = await fuelTransactionsApi.createIncoming({ tank_id: incoming.tank_id, quantity_liters: quantity, transaction_date: new Date(incoming.transaction_date).toISOString(), supplier_id: Number(incoming.supplier_id), unit_price: incoming.unit_price === "" ? null : Number(incoming.unit_price), total_amount: incoming.total_amount === "" ? null : Number(incoming.total_amount), currency: incoming.unit_price || incoming.total_amount ? incoming.currency : null, comment: incoming.comment.trim() || null });
      setIncoming(null);
      await load();
      setSelectedTransaction(created);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  return <div className="bt-page bt-ops-page bt-fuel-page">
    <header className="bt-page-header"><div><span className="bt-eyebrow">Bashkim Tours · Nafta</span><h1>Depozitat e naftës</h1><p>Gjendja dhe detajet e rezervarëve të karburantit.</p></div></header>
    <div className="bt-income-notice" role="status"><Info aria-hidden="true" /><div><strong>Kjo faqe është ende në përpunim</strong><p>Moduli i naftës mund të ndryshojë ndërsa shtohen funksionet e tjera.</p></div></div>
    {error && !form && !incoming && <p className="bt-inline-error" role="alert">{error}</p>}
    {loading && <p>Duke ngarkuar rezervarët…</p>}
    {!loading && !tanks.length && !error && <p>Nuk ka ende rezervarë.</p>}
    <div className="bt-fuel-cards">{tanks.map((tank) => {
      const capacity = Number(tank.capacity_liters);
      const quantity = Number(tank.current_quantity_liters);
      const threshold = Number(tank.low_level_threshold_liters);
      const critical = quantity <= threshold;
      const warning = !critical && quantity <= threshold + capacity * 0.2;
      const fill = capacity > 0 ? Math.min(100, Math.max(0, quantity / capacity * 100)) : 0;
      const levelClass = critical ? "is-critical" : warning ? "is-warning" : "";
      return <div className="bt-fuel-group" key={tank.id}><article className={`bt-fuel-card ${levelClass}`}>
        <div className="bt-fuel-card-head"><span className="bt-fuel-card-icon"><Fuel size={27} aria-hidden="true" /></span><div><h2>{tank.name}</h2><p>{fuelTypes[tank.fuel_type] || tank.fuel_type}</p></div><div className="bt-fuel-card-actions"><button type="button" className="bt-btn-primary" onClick={() => openIncoming(tank.id)}><Plus size={17} /> Shto hyrje</button><button type="button" className="bt-fuel-edit" aria-label={`Ndrysho rezervarin ${tank.name}`} title="Ndrysho" onClick={() => edit(tank)}><Pencil size={18} /></button></div></div>
        <div className={`bt-fuel-card-quantity ${levelClass}`}><div className="bt-fuel-quantity-heading"><span>Sasia aktuale</span>{critical && <span className="bt-fuel-low">Nivel kritik</span>}{warning && <span className="bt-fuel-low">Afër nivelit të ulët</span>}</div><strong>{liters(tank.current_quantity_liters)}</strong><div className="bt-fuel-meter" role="meter" aria-label={`Mbushja e rezervarit ${tank.name}`} aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={quantity}><span style={{ width: `${fill}%` }} /></div><small>{Math.round(fill)}% e kapacitetit prej {liters(tank.capacity_liters)}</small></div>
      </article><section ref={transactionsRef} className="bt-fuel-transactions" aria-label={`Transaksionet e rezervarit ${tank.name}`} aria-busy={loadingPageId === tank.id}><div className="bt-fuel-transactions-head"><div><h3>Transaksionet</h3><p>Hyrjet dhe daljet e karburantit</p></div><div className="bt-fuel-transaction-filters" role="group" aria-label="Filtro transaksionet">{[["", "Të gjitha"], ["INCOMING", "Hyrëse"], ["OUTGOING", "Dalëse"]].map(([type, label]) => <button key={type} type="button" className={transactionFilter === type ? "active" : ""} aria-pressed={transactionFilter === type} disabled={loadingPageId != null} onClick={() => changeFilter(type)}>{label}</button>)}</div></div>
        {transactionError && <p className="bt-inline-error" role="alert">{transactionError}</p>}
        {loadingPageId === tank.id && <p className="bt-fuel-page-loading" role="status"><LoaderCircle size={18} aria-hidden="true" /> Duke ngarkuar transaksionet…</p>}
        {!transactions[tank.id]?.items.length ? <p className="bt-fuel-transactions-empty">Nuk ka transaksione në këtë faqe.</p> : <ul className="bt-fuel-transaction-list">{transactions[tank.id].items.map((transaction) => { const mapping = transactionMapping(transaction); const isIncoming = mapping === "incoming"; const label = mapping === "vehicle" ? vehicleLabel(transaction.vehicle) : mapping === "external" ? externalCustomerLabel(transaction.external_customer) : transaction.piusi_detail?.registration_number; return <li className={`is-${mapping}`} key={transaction.id}><span className="bt-fuel-transaction-icon">{isIncoming ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}</span><div><strong>{isIncoming ? "Hyrje" : "Dalje"}{label ? ` · ${label}` : ""}{mapping === "external" && <span className="bt-fuel-transaction-badge">Klient i jashtëm</span>}{mapping === "unmapped" && <span className="bt-fuel-transaction-badge">Pa mapping</span>}</strong><time dateTime={transaction.transaction_date}>{formatDateTime(transaction.transaction_date)}</time></div><b>{isIncoming ? "+" : "−"}{liters(transaction.quantity_liters)}</b><button type="button" className="bt-fuel-transaction-detail" onClick={() => showTransaction(transaction)}>Detaje</button></li>; })}</ul>}
        {((transactionPages[tank.id] || 0) > 0 || transactions[tank.id]?.hasNext) && <div className="bt-fuel-transaction-pagination"><button type="button" className="bt-btn-secondary" disabled={loadingPageId != null || (transactionPages[tank.id] || 0) === 0} onClick={() => changePage(tank.id, (transactionPages[tank.id] || 0) - 1)}>Mbrapa</button><span className={loadingPageId === tank.id ? "bt-fuel-pagination-loading" : ""}>{loadingPageId === tank.id && <LoaderCircle size={17} aria-hidden="true" />}{loadingPageId === tank.id ? "Duke ngarkuar…" : `Faqja ${(transactionPages[tank.id] || 0) + 1}`}</span><button type="button" className="bt-btn-secondary" disabled={loadingPageId != null || !transactions[tank.id]?.hasNext} onClick={() => changePage(tank.id, (transactionPages[tank.id] || 0) + 1)}>Tjetër</button></div>}
      </section></div>;
    })}</div>
    {form && <Modal title={editingId == null ? "Shto depozitë" : "Përditëso depozitën"} className="bt-fuel-modal" onClose={closeForm}><form className="bt-fuel-form" onSubmit={save}>{error && <p className="bt-inline-error" role="alert">{error}</p>}<div className="bt-fuel-fields">
      <label>Emri<input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>Lloji i karburantit<select value={form.fuel_type} onChange={(event) => setForm({ ...form, fuel_type: event.target.value })}>{Object.entries(fuelTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {[["capacity_liters", "Kapaciteti (L)"], ["current_quantity_liters", "Sasia aktuale (L)"], ["low_level_threshold_liters", "Njofto kur sasia bie në (L)"]].map(([key, label]) => <label key={key}>{label}<input type="number" required min={key === "capacity_liters" ? "0.001" : "0"} step="any" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />{key === "low_level_threshold_liters" && <small>Paralajmërimi shfaqet kur sasia aktuale arrin ose bie nën këtë vlerë.</small>}</label>)}
    </div><div className="bt-fuel-actions"><button type="submit" className="bt-btn-primary" disabled={busy}>{busy ? "Duke ruajtur…" : "Ruaj"}</button><button type="button" className="bt-btn-secondary" disabled={busy} onClick={closeForm}>Anulo</button></div></form></Modal>}
    {incoming && <Modal title="Shto hyrje karburanti" className="bt-fuel-incoming-modal" onClose={() => { if (!busy) { setIncoming(null); setError(""); } }}>
      <form className="bt-fuel-form" onSubmit={addIncoming}>
        {error && <p className="bt-inline-error" role="alert">{error}</p>}
        <fieldset className="bt-fuel-incoming-group"><legend>Furnizimi</legend><div className="bt-fuel-fields">
          <div className="bt-fuel-supplier-field"><span>Furnitori</span><CharterReferencePicker label="Furnitori" placeholder={supplierLoading ? "Duke ngarkuar furnitorët…" : "Kërko furnitorin"} disabled={supplierLoading} required value={incoming.supplier_id} selectedLabel={suppliers.find((supplier) => String(supplier.id) === incoming.supplier_id)?.name} searchOptions={(query) => suppliers.filter((supplier) => supplier.name.toLocaleLowerCase("sq-AL").includes(query.toLocaleLowerCase("sq-AL"))).map((supplier) => ({ id: supplier.id, label: supplier.name, meta: supplier.phone || "" }))} onSelect={(supplier) => setIncoming({ ...incoming, supplier_id: supplier ? String(supplier.id) : "" })} /></div>
          <label>Sasia hyrëse<input type="number" inputMode="decimal" required min="0.001" step="any" value={incoming.quantity_liters} onChange={(event) => { const quantity_liters = event.target.value; setIncoming({ ...incoming, quantity_liters, total_amount: calculatedTotal(quantity_liters, incoming.unit_price) }); }} /></label>
        </div></fieldset>
        <fieldset className="bt-fuel-incoming-group"><legend>Pagesa dhe data</legend><div className="bt-fuel-fields">
          <div className="bt-fuel-currency-field"><span>Valuta</span><div role="group" aria-label="Valuta" className="bt-fuel-currency-options">{["EUR", "MKD"].map((currency) => <button key={currency} type="button" className={incoming.currency === currency ? "active" : ""} aria-pressed={incoming.currency === currency} onClick={() => setIncoming({ ...incoming, currency })}>{currency}</button>)}</div></div>
          <label>Çmimi për litër<input type="number" min="0.001" step="any" value={incoming.unit_price} onChange={(event) => { const unit_price = event.target.value; setIncoming({ ...incoming, unit_price, total_amount: calculatedTotal(incoming.quantity_liters, unit_price) }); }} /></label>
          <label>Shuma totale<input type="number" min="0.001" step="any" value={incoming.total_amount} placeholder="Llogaritet ose shkruhet manualisht" onChange={(event) => setIncoming({ ...incoming, total_amount: event.target.value })} /></label>
          <CharterDateTimeField label="Data dhe ora (DD/MM/YYYY)" value={incoming.transaction_date} onChange={(value) => setIncoming({ ...incoming, transaction_date: value })} />
          <label className="bt-fuel-comment-field">Koment<textarea value={incoming.comment} onChange={(event) => setIncoming({ ...incoming, comment: event.target.value })} rows={3} /></label>
        </div></fieldset>
        {!supplierLoading && !suppliers.length && <p className="bt-inline-error">Nuk ka furnitorë. Shto një furnitor te skeda “Furnitorët” përpara regjistrimit të hyrjes.</p>}
        <div className="bt-fuel-actions"><button type="submit" className="bt-btn-primary" disabled={busy || supplierLoading || !suppliers.length}>{busy ? "Duke ruajtur…" : "Ruaj hyrjen"}</button><button type="button" className="bt-btn-secondary" disabled={busy} onClick={() => { setIncoming(null); setError(""); }}>Anulo</button></div>
      </form>
    </Modal>}
    {selectedTransaction && <Modal title={`Detajet e ${selectedTransaction.transaction_type === "INCOMING" ? "hyrjes" : "daljes"}`} className="bt-fuel-transaction-modal" onClose={() => setSelectedTransaction(null)}><dl className="bt-fuel-transaction-details"><div><dt>Sasia</dt><dd>{liters(selectedTransaction.quantity_liters)}</dd></div><div><dt>Data dhe ora</dt><dd>{formatDateTime(selectedTransaction.transaction_date)}</dd></div>{selectedTransaction.vehicle && <><div><dt>Automjeti</dt><dd>{vehicleLabel(selectedTransaction.vehicle)}</dd></div><div><dt>Viti</dt><dd>{detailValue(selectedTransaction.vehicle.year)}</dd></div><div><dt>Vendet</dt><dd>{detailValue(selectedTransaction.vehicle.seats)}</dd></div></>}{selectedTransaction.external_customer && <><div><dt>Lidhja</dt><dd>Klient i jashtëm</dd></div><div><dt>Klienti</dt><dd>{externalCustomerLabel(selectedTransaction.external_customer)}</dd></div><div><dt>Telefoni</dt><dd>{detailValue(selectedTransaction.external_customer.phone_number)}</dd></div></>}{transactionMapping(selectedTransaction) === "unmapped" && <div><dt>Lidhja</dt><dd>Pa mapping</dd></div>}{selectedTransaction.incoming_detail && <><div><dt>Furnitori</dt><dd>{suppliers.find((supplier) => supplier.id === selectedTransaction.incoming_detail.supplier_id)?.name || `#${selectedTransaction.incoming_detail.supplier_id}`}</dd></div><div><dt>Çmimi për litër</dt><dd>{money(selectedTransaction.incoming_detail.unit_price, selectedTransaction.incoming_detail.currency)}</dd></div><div><dt>Shuma totale</dt><dd>{money(selectedTransaction.incoming_detail.total_amount, selectedTransaction.incoming_detail.currency)}</dd></div><div><dt>Valuta</dt><dd>{selectedTransaction.incoming_detail.currency || "—"}</dd></div>{selectedTransaction.incoming_detail.comment && <div className="bt-fuel-comment-detail"><dt>Komenti</dt><dd>{selectedTransaction.incoming_detail.comment}</dd></div>}</>}{selectedTransaction.piusi_detail && <>{[["Targa në Piusi", "registration_number"], ["Kilometrazhi", "odometer"], ["Njësia e kilometrazhit", "odometer_unit"], ["Autorizimi", "auth"], ["Lloji i furnizimit", "dispense_type"], ["Anomalia", "anomaly"], ["Statusi", "status"], ["ID e transaksionit Piusi", "piusi_transaction_id"], ["ID progresive Piusi", "piusi_progressive_id"], ["ID e dispenserit", "piusi_dispenser_id"], ["ID e pompës", "piusi_pump_id"], ["ID e shoferit Piusi", "piusi_driver_id"]].map(([label, key]) => <div key={key}><dt>{label}</dt><dd>{detailValue(selectedTransaction.piusi_detail[key])}</dd></div>)}</>}</dl>{selectedTransaction.transaction_type === "INCOMING" && !selectedTransaction.incoming_detail && <p className="bt-fuel-detail-note">Të dhënat shtesë të kësaj hyrjeje nuk janë të disponueshme.</p>}</Modal>}
  </div>;
}
