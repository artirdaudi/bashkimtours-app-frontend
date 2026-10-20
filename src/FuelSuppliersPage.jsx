import { useCallback, useEffect, useState } from "react";
import { Pencil, Phone, Plus, Search, Trash2, Truck } from "lucide-react";
import { fuelSuppliersApi } from "./api";
import { confirmAction } from "./confirmAction";
import { Modal } from "./PortalPages";

const pageSize = 20;

export default function FuelSuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await fuelSuppliersApi.list({ name, limit: pageSize + 1, offset: page * pageSize });
      setSuppliers(rows.slice(0, pageSize));
      setHasNext(rows.length > pageSize);
    } catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }, [name, page]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const edit = async (id) => {
    setError("");
    try {
      const supplier = await fuelSuppliersApi.get(id);
      setForm({ id: supplier.id, name: supplier.name, phone: supplier.phone || "" });
    } catch (cause) { setError(cause.message); }
  };

  const save = async (event) => {
    event.preventDefault();
    const trimmedName = form.name.trim();
    if (!trimmedName) { setError("Shkruaj emrin e furnitorit."); return; }
    setBusy(true);
    setError("");
    const body = { name: trimmedName, phone: form.phone.trim() || null };
    try {
      if (form.id != null) await fuelSuppliersApi.update(form.id, body);
      else await fuelSuppliersApi.create(body);
      setForm(null);
      await load();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  const remove = async (supplier) => {
    if (busy || !await confirmAction(`Të fshihet furnitori “${supplier.name}”?`)) return;
    setBusy(true);
    setError("");
    try {
      await fuelSuppliersApi.remove(supplier.id);
      if (page > 0 && suppliers.length === 1) setPage(page - 1);
      else await load();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  return <div className="bt-page bt-ops-page bt-fuel-suppliers-page">
    <header className="bt-page-header"><div><span className="bt-eyebrow">Bashkim Tours · Nafta</span><h1>Furnitorët</h1><p>Lista e furnitorëve të karburantit dhe të dhënat e kontaktit.</p></div><button type="button" className="bt-btn-primary" onClick={() => { setForm({ id: null, name: "", phone: "" }); setError(""); }}><Plus size={18} /> Shto furnitor</button></header>
    <form className="bt-fuel-supplier-search" onSubmit={(event) => { event.preventDefault(); setPage(0); setName(search.trim()); }}><Search size={18} aria-hidden="true" /><input aria-label="Kërko furnitor sipas emrit" placeholder="Kërko sipas emrit" value={search} onChange={(event) => setSearch(event.target.value)} /><button type="submit" className="bt-btn-secondary">Kërko</button></form>
    {error && !form && <p className="bt-inline-error" role="alert">{error}</p>}
    {loading && <p>Duke ngarkuar furnitorët…</p>}
    {!loading && !suppliers.length && !error && <p className="bt-fuel-suppliers-empty">Nuk u gjet asnjë furnitor.</p>}
    <div className="bt-fuel-supplier-list">{suppliers.map((supplier) => <article key={supplier.id} className="bt-fuel-supplier-card"><span className="bt-fuel-supplier-icon"><Truck size={22} aria-hidden="true" /></span><div className="bt-fuel-supplier-info"><h2>{supplier.name}</h2>{supplier.phone ? <a href={`tel:${supplier.phone}`}><Phone size={15} /> {supplier.phone}</a> : <span>Pa numër telefoni</span>}</div><div className="bt-fuel-supplier-actions"><button type="button" className="bt-fuel-edit" aria-label={`Ndrysho furnitorin ${supplier.name}`} title="Ndrysho" disabled={busy} onClick={() => edit(supplier.id)}><Pencil size={17} /></button><button type="button" className="bt-fuel-delete" aria-label={`Fshi furnitorin ${supplier.name}`} title="Fshi" disabled={busy} onClick={() => remove(supplier)}><Trash2 size={17} /></button></div></article>)}</div>
    {(page > 0 || hasNext) && <div className="bt-fuel-transaction-pagination"><button type="button" className="bt-btn-secondary" disabled={loading || page === 0} onClick={() => setPage(page - 1)}>Mbrapa</button><span>Faqja {page + 1}</span><button type="button" className="bt-btn-secondary" disabled={loading || !hasNext} onClick={() => setPage(page + 1)}>Tjetër</button></div>}
    {form && <Modal title={form.id == null ? "Shto furnitor" : "Përditëso furnitorin"} className="bt-fuel-supplier-modal" onClose={() => { if (!busy) { setForm(null); setError(""); } }}><form onSubmit={save}>{error && <p className="bt-inline-error" role="alert">{error}</p>}<div className="bt-fuel-fields"><label>Emri<input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Numri i telefonit<input type="tel" maxLength={50} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label></div><div className="bt-fuel-actions"><button type="submit" className="bt-btn-primary" disabled={busy}>{busy ? "Duke ruajtur…" : "Ruaj"}</button><button type="button" className="bt-btn-secondary" disabled={busy} onClick={() => { setForm(null); setError(""); }}>Anulo</button></div></form></Modal>}
  </div>;
}
