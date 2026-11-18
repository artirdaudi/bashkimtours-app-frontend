import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Search, UsersRound } from "lucide-react";
import { fuelExternalCustomersApi } from "./api";
import { Modal } from "./PortalPages";

const emptyCustomer = { registration_number: "", first_name: "", last_name: "", phone_number: "", comment: "", is_active: true };
const customerName = (customer) => [customer.first_name, customer.last_name].filter(Boolean).join(" ");

export default function FuelCustomerManagementPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadCustomers = useCallback(async () => {
    setLoading(true); setError("");
    try { setCustomers(await fuelExternalCustomersApi.list()); }
    catch (cause) { setError(`Klientët nuk u ngarkuan. ${cause.message}`); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(loadCustomers, 0); return () => window.clearTimeout(timer); }, [loadCustomers]);
  useEffect(() => { window.addEventListener("bt:fuel-reconnected", loadCustomers); return () => window.removeEventListener("bt:fuel-reconnected", loadCustomers); }, [loadCustomers]);

  const visibleCustomers = customers.filter((customer) =>
    (status === "" || String(customer.is_active) === status) &&
    (!search.trim() || [customer.registration_number, customer.first_name, customer.last_name, customer.phone_number]
      .some((value) => String(value || "").toLocaleLowerCase("sq-AL").includes(search.trim().toLocaleLowerCase("sq-AL"))))
  );

  const save = async (event) => {
    event.preventDefault();
    const body = { first_name: form.first_name.trim(), last_name: form.last_name.trim(), phone_number: form.phone_number.trim() || null, comment: form.comment.trim() || null };
    const plate = form.registration_number.trim().toUpperCase();
    if (!plate || !body.first_name || !body.last_name) { setError("Plotëso targën, emrin dhe mbiemrin."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      if (form.id == null) {
        const created = await fuelExternalCustomersApi.create({ registration_number: plate, ...body });
        setWarning(created.piusi_registration_synced === false);
        setMessage(created.piusi_registration_synced === false ? "Klienti u shtua, por targa nuk u regjistrua në PIUSI. Kontrollo regjistrimin në PIUSI." : "Klienti u shtua me sukses.");
      } else {
        await fuelExternalCustomersApi.update(form.id, { ...body, is_active: form.is_active });
        setWarning(false); setMessage("Të dhënat e klientit u ruajtën.");
      }
      setForm(null);
      await loadCustomers();
    } catch (cause) { setError(`Klienti nuk u ruajt. ${cause.message}`); }
    finally { setBusy(false); }
  };

  return <div className="bt-page bt-ops-page bt-fuel-customer-management-page">
    <header className="bt-page-header"><div><span className="bt-eyebrow">Bashkim Tours · Nafta</span><h1>Klientët e jashtëm</h1><p>Regjistro dhe përditëso klientët që furnizohen nga rezervari.</p></div><button type="button" className="bt-btn-primary" onClick={() => { setForm({ ...emptyCustomer }); setError(""); }}><Plus size={18} /> Shto klient</button></header>
    <div className="bt-fuel-customer-management-filters"><label><span>Kërko klientin</span><span className="bt-fuel-customer-management-search"><Search size={17} aria-hidden="true" /><input type="search" placeholder="Targë, emër ose telefon…" value={search} onChange={(event) => setSearch(event.target.value)} /></span></label><div className="bt-fuel-customer-management-status" role="group" aria-label="Filtro sipas statusit">{[["", "Të gjithë"], ["true", "Aktivë"], ["false", "Joaktivë"]].map(([value, label]) => <button key={value} type="button" className={status === value ? "active" : ""} aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>)}</div></div>
    {message && <p className={warning ? "bt-inline-error" : "bt-fuel-success"} role="status">{message}</p>}
    {error && !form && <p className="bt-inline-error" role="alert">{error} <button type="button" onClick={loadCustomers}>Provo përsëri</button></p>}
    {loading ? <p role="status">Duke ngarkuar klientët…</p> : !visibleCustomers.length ? <p className="bt-fuel-suppliers-empty">Nuk u gjet asnjë klient.</p> : <div className="bt-fuel-supplier-list">{visibleCustomers.map((customer) => <article className="bt-fuel-supplier-card bt-fuel-customer-management-card" key={customer.id}><span className="bt-fuel-supplier-icon"><UsersRound size={21} /></span><div className="bt-fuel-supplier-info"><h2>{customer.registration_number}</h2><strong>{customerName(customer)}</strong>{customer.phone_number && <span>{customer.phone_number}</span>}{customer.comment && <small>{customer.comment}</small>}</div><span className={`bt-fuel-customer-management-badge ${customer.is_active ? "is-active" : "is-inactive"}`}>{customer.is_active ? "Aktiv" : "Joaktiv"}</span><button type="button" className="bt-btn-secondary" onClick={() => { setForm({ ...customer, phone_number: customer.phone_number || "", comment: customer.comment || "" }); setError(""); }}><Pencil size={16} /> Ndrysho</button></article>)}</div>}
    {form && <Modal title={form.id == null ? "Shto klient" : "Ndrysho klientin"} className="bt-fuel-supplier-modal bt-fuel-customer-management-modal" onClose={() => { if (!busy) setForm(null); }}><form onSubmit={save}>{error && <p className="bt-inline-error" role="alert">{error}</p>}<div className="bt-fuel-fields"><label>Targa<input required maxLength={16} value={form.registration_number} readOnly={form.id != null} onChange={(event) => setForm({ ...form, registration_number: event.target.value.toUpperCase() })} /></label><label>Emri<input required maxLength={100} value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} /></label><label>Mbiemri<input required maxLength={100} value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} /></label><label>Telefoni<input type="tel" maxLength={50} value={form.phone_number} onChange={(event) => setForm({ ...form, phone_number: event.target.value })} /></label><label className="bt-fuel-customer-management-comment">Koment<textarea rows={3} value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} /></label>{form.id != null && <label className="bt-fuel-customer-active"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Klient aktiv</label>}</div><div className="bt-fuel-actions"><button type="button" className="bt-btn-secondary" disabled={busy} onClick={() => setForm(null)}>Anulo</button><button type="submit" className="bt-btn-primary" disabled={busy}>{busy ? "Duke ruajtur…" : form.id == null ? "Shto klient" : "Ruaj ndryshimet"}</button></div></form></Modal>}
  </div>;
}
