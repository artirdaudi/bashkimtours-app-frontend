import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { documentTypesApi } from "./api";
import { Modal } from "./PortalPages";

const emptyForm = { name: "", comment: "" };

export default function DocumentTypesPage() {
  const [types, setTypes] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTypes(await documentTypesApi.list());
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const request = window.setTimeout(load, 0);
    return () => window.clearTimeout(request);
  }, [load]);

  function openForm(type = null) {
    setError("");
    setForm(type ? { id: type.id, name: type.name, comment: type.comment || "" } : { ...emptyForm });
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const name = form.name.trim();
    if (!name) {
      setError("Shkruani emrin e llojit të dokumentit.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = { name, comment: form.comment.trim() || null };
      if (form.id) await documentTypesApi.update(form.id, body);
      else await documentTypesApi.create(body);
      setForm(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const term = search.trim().toLocaleLowerCase("sq");
  const shown = types.filter((type) => [type.name, type.comment].some((value) => String(value || "").toLocaleLowerCase("sq").includes(term)));

  return <div className="bt-page bt-ops-page bt-accounts-roles-page bt-document-types-page">
    <header className="bt-page-header">
      <div><span className="bt-eyebrow">Settings</span><h1>Llojet e Dokumentave</h1><p>Menaxhimi i llojeve të dokumenteve.</p></div>
      <button type="button" className="bt-btn-primary" onClick={() => openForm()}><Plus size={18} /> Shto lloj dokumenti</button>
    </header>
    <Link className="bt-document-types-back" to="/shoferat">← Shoferat dhe Staff</Link>
    <label className="bt-accounts-search"><Search size={19} aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kërko sipas emrit ose komentit…" aria-label="Kërko llojet e dokumenteve" /></label>
    {error && !form && <p className="bt-inline-error" role="alert">{error}</p>}
    <section className="bt-accounts-section">
      <h2><FileText size={21} /> Llojet e dokumenteve</h2>
      {loading && <p className="bt-accounts-state" role="status"><RefreshCw className="bt-spin" /> Duke ngarkuar…</p>}
      {!loading && !error && !shown.length && <p className="bt-accounts-state">{search ? "Nuk u gjet asnjë lloj dokumenti." : "Nuk ka lloje dokumentesh të regjistruara."}</p>}
      {!!shown.length && <div className="bt-accounts-table-wrap"><table className="bt-accounts-table bt-document-types-table">
        <thead><tr><th>Emri</th><th>Koment</th><th>Veprimet</th></tr></thead>
        <tbody>{shown.map((type) => <tr key={type.id}>
          <td><strong>{type.name}</strong></td><td>{type.comment || "—"}</td>
          <td><div className="bt-role-actions">
            <button type="button" className="bt-btn-secondary" disabled={busy} onClick={() => openForm(type)}><Pencil size={16} /> Ndrysho</button>
          </div></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
    {form && <Modal title={form.id ? "Ndrysho llojin e dokumentit" : "Shto lloj dokumenti"} className="bt-document-type-modal" onClose={() => { if (!busy) setForm(null); }}><form className="bt-role-form" onSubmit={save}>
      <label>Emri<input required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>Koment<textarea rows={3} value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} /></label>
      {error && <p className="bt-inline-error" role="alert">{error}</p>}
      <div className="bt-modal-actions"><button type="submit" className="bt-btn-primary" disabled={busy}>{busy ? "Duke ruajtur…" : "Ruaj"}</button></div>
    </form></Modal>}
  </div>;
}
