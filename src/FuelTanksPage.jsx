import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Fuel, Info, Pencil, Plus } from "lucide-react";
import { fuelTanksApi, fuelTransactionsApi } from "./api";
import { Modal } from "./PortalPages";
import CharterDateTimeField from "./CharterDateTimeField";
import { formatDateTime } from "./dateUtils";

const fuelTypes = { DIESEL: "Naftë", PETROL: "Benzinë", ADBLUE: "AdBlue" };
const liters = (value) => `${new Intl.NumberFormat("sq-AL", { maximumFractionDigits: 2 }).format(Number(value || 0))} L`;
const localDateTime = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

export default function FuelTanksPage() {
  const [tanks, setTanks] = useState([]);
  const [transactions, setTransactions] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [incoming, setIncoming] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const entries = await fuelTanksApi.list({ limit: 1000 });
      const [details, histories] = await Promise.all([
        Promise.all(entries.map(({ id }) => fuelTanksApi.get(id))),
        Promise.all(entries.map(({ id }) => fuelTransactionsApi.list({ tank_id: id, limit: 1000 }))),
      ]);
      setTanks(details);
      setTransactions(Object.fromEntries(entries.map(({ id }, index) => [id, histories[index].sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date))])));
    } catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

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
  const addIncoming = async (event) => {
    event.preventDefault();
    const quantity = Number(incoming.quantity_liters);
    if (!Number.isFinite(quantity) || quantity <= 0) { setError("Sasia duhet të jetë më e madhe se zero."); return; }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(incoming.transaction_date) || Number.isNaN(new Date(incoming.transaction_date).getTime())) { setError("Zgjidh datën dhe orën e transaksionit."); return; }
    setBusy(true);
    setError("");
    try {
      await fuelTransactionsApi.createIncoming({ tank_id: incoming.tank_id, quantity_liters: quantity, transaction_date: new Date(incoming.transaction_date).toISOString() });
      setIncoming(null);
      await load();
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
      const low = quantity <= Number(tank.low_level_threshold_liters);
      const fill = capacity > 0 ? Math.min(100, Math.max(0, quantity / capacity * 100)) : 0;
      return <div className="bt-fuel-group" key={tank.id}><article className="bt-fuel-card">
        <div className="bt-fuel-card-head"><span className="bt-fuel-card-icon"><Fuel size={27} aria-hidden="true" /></span><div><h2>{tank.name}</h2><p>{fuelTypes[tank.fuel_type] || tank.fuel_type}</p></div><div className="bt-fuel-card-actions"><button type="button" className="bt-btn-primary" onClick={() => { setIncoming({ tank_id: tank.id, quantity_liters: "", transaction_date: localDateTime() }); setError(""); }}><Plus size={17} /> Shto hyrje</button><button type="button" className="bt-fuel-edit" aria-label={`Ndrysho rezervarin ${tank.name}`} title="Ndrysho" onClick={() => edit(tank)}><Pencil size={18} /></button></div></div>
        <div className={`bt-fuel-card-quantity${low ? " is-low" : ""}`}><div className="bt-fuel-quantity-heading"><span>Sasia aktuale</span>{low && <span className="bt-fuel-low">Nivel i ulët</span>}</div><strong>{liters(tank.current_quantity_liters)}</strong><div className="bt-fuel-meter" role="meter" aria-label={`Mbushja e rezervarit ${tank.name}`} aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={quantity}><span style={{ width: `${fill}%` }} /></div><small>{Math.round(fill)}% e kapacitetit prej {liters(tank.capacity_liters)}</small></div>
      </article><section className="bt-fuel-transactions" aria-label={`Transaksionet e rezervarit ${tank.name}`}><div className="bt-fuel-transactions-head"><div><h3>Transaksionet</h3><p>Hyrjet dhe daljet e karburantit</p></div></div>
        {!transactions[tank.id]?.length ? <p className="bt-fuel-transactions-empty">Nuk ka ende transaksione.</p> : <ul className="bt-fuel-transaction-list">{transactions[tank.id].map((transaction) => { const isIncoming = transaction.transaction_type === "INCOMING"; return <li className={isIncoming ? "is-incoming" : "is-outgoing"} key={transaction.id}><span className="bt-fuel-transaction-icon">{isIncoming ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}</span><div><strong>{isIncoming ? "Hyrje" : "Dalje"}</strong><time dateTime={transaction.transaction_date}>{formatDateTime(transaction.transaction_date)}</time></div><b>{isIncoming ? "+" : "−"}{liters(transaction.quantity_liters)}</b></li>; })}</ul>}
      </section></div>;
    })}</div>
    {form && <Modal title={editingId == null ? "Shto depozitë" : "Përditëso depozitën"} className="bt-fuel-modal" onClose={closeForm}><form className="bt-fuel-form" onSubmit={save}>{error && <p className="bt-inline-error" role="alert">{error}</p>}<div className="bt-fuel-fields">
      <label>Emri<input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>Lloji i karburantit<select value={form.fuel_type} onChange={(event) => setForm({ ...form, fuel_type: event.target.value })}>{Object.entries(fuelTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {[["capacity_liters", "Kapaciteti (L)"], ["current_quantity_liters", "Sasia aktuale (L)"], ["low_level_threshold_liters", "Njofto kur sasia bie në (L)"]].map(([key, label]) => <label key={key}>{label}<input type="number" required min={key === "capacity_liters" ? "0.001" : "0"} step="any" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />{key === "low_level_threshold_liters" && <small>Paralajmërimi shfaqet kur sasia aktuale arrin ose bie nën këtë vlerë.</small>}</label>)}
    </div><div className="bt-fuel-actions"><button type="submit" className="bt-btn-primary" disabled={busy}>{busy ? "Duke ruajtur…" : "Ruaj"}</button><button type="button" className="bt-btn-secondary" disabled={busy} onClick={closeForm}>Anulo</button></div></form></Modal>}
    {incoming && <Modal title="Shto hyrje karburanti" className="bt-fuel-incoming-modal" onClose={() => { if (!busy) { setIncoming(null); setError(""); } }}><form className="bt-fuel-form" onSubmit={addIncoming}>{error && <p className="bt-inline-error" role="alert">{error}</p>}<div className="bt-fuel-fields"><label>Sasia (L)<input type="number" required min="0.001" step="any" value={incoming.quantity_liters} onChange={(event) => setIncoming({ ...incoming, quantity_liters: event.target.value })} /></label><CharterDateTimeField label="Data dhe ora (DD/MM/YYYY)" value={incoming.transaction_date} onChange={(value) => setIncoming({ ...incoming, transaction_date: value })} /></div><div className="bt-fuel-actions"><button type="submit" className="bt-btn-primary" disabled={busy}>{busy ? "Duke ruajtur…" : "Ruaj hyrjen"}</button><button type="button" className="bt-btn-secondary" disabled={busy} onClick={() => { setIncoming(null); setError(""); }}>Anulo</button></div></form></Modal>}
  </div>;
}
