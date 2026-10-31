import { useCallback, useEffect, useState } from "react";
import { CarFront, Pencil, Plus, Search } from "lucide-react";
import { fuelStaffVehiclesApi } from "./api";
import { Modal } from "./PortalPages";

const emptyForm = { id: null, registration_number: "", owner_name: "", is_active: true };

export default function FuelStaffVehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setVehicles(await fuelStaffVehiclesApi.list({ search: appliedSearch })); }
    catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }, [appliedSearch]);

  useEffect(() => { const timer = window.setTimeout(load, 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { window.addEventListener("bt:fuel-reconnected", load); return () => window.removeEventListener("bt:fuel-reconnected", load); }, [load]);

  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (form.id == null) await fuelStaffVehiclesApi.create({ registration_number: form.registration_number.trim(), owner_name: form.owner_name.trim() });
      else await fuelStaffVehiclesApi.update(form.id, { owner_name: form.owner_name.trim(), is_active: form.is_active });
      setForm(null); await load();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  return <div className="bt-page bt-ops-page bt-fuel-staff-page">
    <header className="bt-page-header"><div><span className="bt-eyebrow">Bashkim Tours · Nafta</span><h1>Automjetet e stafit</h1><p>Menaxho automjetet e stafit që furnizohen me naftë.</p></div><button type="button" className="bt-btn-primary" onClick={() => { setError(""); setForm({ ...emptyForm }); }}><Plus size={18} /> Shto automjet</button></header>
    <form className="bt-fuel-supplier-search" onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search.trim()); }}><Search size={18} aria-hidden="true" /><input type="search" aria-label="Kërko sipas targës ose pronarit" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kërko sipas targës ose pronarit" /><button type="submit" className="bt-btn-secondary">Kërko</button></form>
    {error && <p className="bt-inline-error" role="alert">{error} {!form && <button type="button" onClick={load}>Provo përsëri</button>}</p>}
    {loading && <p role="status">Duke ngarkuar automjetet…</p>}
    {!loading && !error && !vehicles.length && <p className="bt-fuel-suppliers-empty">Nuk u gjet asnjë automjet i stafit.</p>}
    <div className="bt-fuel-supplier-list">{vehicles.map((vehicle) => <article className="bt-fuel-supplier-card" key={vehicle.id}><span className="bt-fuel-supplier-icon"><CarFront size={22} /></span><div className="bt-fuel-supplier-info"><h2>{vehicle.registration_number}</h2><p><strong>Pronari:</strong> {vehicle.owner_name}</p><p>{vehicle.is_active ? "Aktiv" : "Jo aktiv"}</p></div><div className="bt-fuel-supplier-actions"><button type="button" className="bt-fuel-edit" title="Ndrysho" aria-label={`Ndrysho ${vehicle.registration_number}`} onClick={() => { setError(""); setForm({ ...vehicle }); }}><Pencil size={17} /></button></div></article>)}</div>
    {form && <Modal title={form.id == null ? "Shto automjet të stafit" : "Ndrysho automjetin e stafit"} className="bt-fuel-supplier-modal bt-fuel-staff-modal" onClose={() => { if (!busy) { setForm(null); setError(""); } }}><form onSubmit={save}>{error && <p className="bt-inline-error" role="alert">{error}</p>}<div className="bt-fuel-fields"><label>Targa<input required maxLength={16} disabled={form.id != null} value={form.registration_number} onChange={(event) => setForm({ ...form, registration_number: event.target.value })} /></label><label>Pronari<input required maxLength={200} value={form.owner_name} onChange={(event) => setForm({ ...form, owner_name: event.target.value })} /></label>{form.id != null && <div className="bt-fuel-staff-status"><span>Statusi</span><div role="group" aria-label="Statusi i automjetit" className="bt-fuel-currency-options"><button type="button" className={form.is_active ? "active" : ""} aria-pressed={form.is_active} onClick={() => setForm({ ...form, is_active: true })}>Aktiv</button><button type="button" className={!form.is_active ? "active" : ""} aria-pressed={!form.is_active} onClick={() => setForm({ ...form, is_active: false })}>Jo aktiv</button></div></div>}</div><div className="bt-fuel-actions"><button type="button" className="bt-btn-secondary" disabled={busy} onClick={() => { setForm(null); setError(""); }}>Anulo</button><button type="submit" className="bt-btn-primary" disabled={busy}>{busy ? "Duke ruajtur…" : "Ruaj"}</button></div></form></Modal>}
  </div>;
}
