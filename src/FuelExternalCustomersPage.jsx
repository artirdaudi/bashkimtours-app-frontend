import { useCallback, useEffect, useState } from "react";
import { Pencil, Phone, Plus, Search, Trash2, UsersRound } from "lucide-react";
import { fuelExternalCustomersApi } from "./api";
import { confirmAction } from "./confirmAction";
import { Modal } from "./PortalPages";

const emptyForm = { id: null, registration_number: "", first_name: "", last_name: "", phone_number: "", comment: "", is_active: true };

export default function FuelExternalCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [activeFilter, setActiveFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCustomers(await fuelExternalCustomersApi.list({ is_active: activeFilter }));
    } catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }, [activeFilter]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const edit = async (id) => {
    setError("");
    try {
      const customer = await fuelExternalCustomersApi.get(id);
      setForm({ ...emptyForm, ...customer, phone_number: customer.phone_number || "", comment: customer.comment || "" });
    } catch (cause) { setError(cause.message); }
  };

  const save = async (event) => {
    event.preventDefault();
    const registration_number = form.registration_number.trim();
    const first_name = form.first_name.trim();
    const last_name = form.last_name.trim();
    if (!registration_number || !first_name || !last_name) {
      setError("Plotëso targën, emrin dhe mbiemrin.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = { first_name, last_name, phone_number: form.phone_number.trim() || null, comment: form.comment.trim() || null };
      if (form.id == null) await fuelExternalCustomersApi.create({ registration_number, ...body });
      else await fuelExternalCustomersApi.update(form.id, { ...body, is_active: form.is_active });
      setForm(null);
      await load();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  const remove = async (customer) => {
    if (busy || !await confirmAction(`Të fshihet klienti “${customer.first_name} ${customer.last_name}” (${customer.registration_number})?`)) return;
    setBusy(true);
    setError("");
    try {
      await fuelExternalCustomersApi.remove(customer.id);
      await load();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  const query = search.trim().toLocaleLowerCase("sq-AL");
  const visible = customers.filter((customer) => !query || [customer.registration_number, customer.first_name, customer.last_name, customer.phone_number, customer.comment].some((value) => String(value || "").toLocaleLowerCase("sq-AL").includes(query)));

  return <div className="bt-page bt-ops-page bt-fuel-customers-page">
    <header className="bt-page-header"><div><span className="bt-eyebrow">Bashkim Tours · Nafta</span><h1>Klientët e jashtëm</h1><p>Automjetet dhe kontaktet e klientëve që furnizohen me karburant.</p></div><button type="button" className="bt-btn-primary" onClick={() => { setForm({ ...emptyForm }); setError(""); }}><Plus size={18} /> Shto klient</button></header>
    <div className="bt-fuel-customer-toolbar"><label className="bt-fuel-supplier-search"><Search size={18} aria-hidden="true" /><input aria-label="Kërko klient" placeholder="Kërko sipas targës, emrit ose telefonit" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="bt-fuel-transaction-filters" role="group" aria-label="Filtro klientët">{[["", "Të gjithë"], ["true", "Aktivë"], ["false", "Joaktivë"]].map(([value, label]) => <button type="button" key={value} className={activeFilter === value ? "active" : ""} aria-pressed={activeFilter === value} onClick={() => setActiveFilter(value)}>{label}</button>)}</div></div>
    {error && !form && <p className="bt-inline-error" role="alert">{error}</p>}
    {loading ? <p role="status">Duke ngarkuar klientët…</p> : !visible.length && !error ? <p className="bt-fuel-suppliers-empty">Nuk u gjet asnjë klient.</p> : <div className="bt-fuel-supplier-list">{visible.map((customer) => <article className="bt-fuel-supplier-card bt-fuel-customer-card" key={customer.id}><span className="bt-fuel-supplier-icon"><UsersRound size={22} /></span><div className="bt-fuel-supplier-info"><h2>{customer.first_name} {customer.last_name} <span className={`bt-fuel-customer-status ${customer.is_active ? "is-active" : ""}`}>{customer.is_active ? "Aktiv" : "Joaktiv"}</span></h2><p className="bt-fuel-customer-plate">{customer.registration_number}</p>{customer.phone_number && <a href={`tel:${customer.phone_number}`}><Phone size={15} /> {customer.phone_number}</a>}{customer.comment && <p className="bt-fuel-customer-comment">{customer.comment}</p>}</div><div className="bt-fuel-supplier-actions"><button type="button" className="bt-fuel-edit" aria-label={`Ndrysho klientin ${customer.first_name} ${customer.last_name}`} title="Ndrysho" disabled={busy} onClick={() => edit(customer.id)}><Pencil size={17} /></button><button type="button" className="bt-fuel-delete" aria-label={`Fshi klientin ${customer.first_name} ${customer.last_name}`} title="Fshi" disabled={busy} onClick={() => remove(customer)}><Trash2 size={17} /></button></div></article>)}</div>}
    {form && <Modal title={form.id == null ? "Shto klient të jashtëm" : "Përditëso klientin"} className="bt-fuel-supplier-modal" onClose={() => { if (!busy) { setForm(null); setError(""); } }}><form onSubmit={save}>{error && <p className="bt-inline-error" role="alert">{error}</p>}<div className="bt-fuel-fields"><label>Targa<input required maxLength={16} value={form.registration_number} readOnly={form.id != null} onChange={(event) => setForm({ ...form, registration_number: event.target.value })} />{form.id != null && <small>Targa nuk mund të ndryshohet pas krijimit.</small>}</label><label>Emri<input required maxLength={100} value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} /></label><label>Mbiemri<input required maxLength={100} value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} /></label><label>Telefoni<input type="tel" maxLength={50} value={form.phone_number} onChange={(event) => setForm({ ...form, phone_number: event.target.value })} /></label><label className="bt-fuel-customer-comment-field">Koment<textarea rows={3} value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} /></label>{form.id != null && <label className="bt-fuel-customer-active"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Klient aktiv</label>}</div><div className="bt-fuel-actions"><button type="submit" className="bt-btn-primary" disabled={busy}>{busy ? "Duke ruajtur…" : "Ruaj"}</button><button type="button" className="bt-btn-secondary" disabled={busy} onClick={() => { setForm(null); setError(""); }}>Anulo</button></div></form></Modal>}
  </div>;
}
