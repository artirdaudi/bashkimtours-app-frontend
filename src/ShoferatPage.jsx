import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, LoaderCircle, Pencil, Plus, Search, Trash2, UsersRound, X } from "lucide-react";
import { shoferiApi } from "./api";
import { Modal } from "./PortalPages";

const emptyForm = { emri: "", telefoni: "", embg: "", llogaria: "", rroga: "", cd: "", licenca_transport_nderkombtar: "" };
const fields = [
  { key: "emri", label: "Emri dhe mbiemri", required: true },
  { key: "telefoni", label: "Telefoni", type: "tel" },
  { key: "embg", label: "EMBG", required: true },
  { key: "llogaria", label: "Llogaria", required: true },
  { key: "rroga", label: "Rroga", type: "number", step: "0.01" },
  { key: "cd", label: "Afati i CD", type: "date" },
  { key: "licenca_transport_nderkombtar", label: "Licenca Transport Nderkombtar", type: "date" },
];
const formatDate = (value) => value ? new Intl.DateTimeFormat("sq-AL", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "—";
const hiddenSalary = (value) => value == null || value === "" ? "—" : "••••••";

export default function ShoferatPage() {
  const [search, setSearch] = useState("");
  const [queryText, setQueryText] = useState("");
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState("asc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); setQueryText(search.trim()); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    if (!queryText) return () => { active = false; };
    shoferiApi.select({ search: queryText, limit: 6 })
      .then((items) => { if (active) setSuggestions(items); })
      .catch(() => { if (active) setSuggestions([]); });
    return () => { active = false; };
  }, [queryText]);

  useEffect(() => {
    let active = true;
    shoferiApi.list({ page, page_size: 20, search: queryText, sort_by: sortBy === "id" ? undefined : sortBy, sort_order: sortOrder === "asc" ? undefined : sortOrder })
      .then((result) => { if (active) { setData(result); setError(""); } })
      .catch(async (requestError) => {
        if (requestError.status === 422) {
          try {
            const result = await shoferiApi.list({ page, page_size: 20 });
            if (active) { setData(result); setError("Filtrat nuk u pranuan nga serveri; po shfaqet lista bazë."); }
            return;
          } catch (retryError) { requestError = retryError; }
        }
        if (active) { setData(null); setError(requestError.message); }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, queryText, sortBy, sortOrder, refresh]);

  async function openDriver(id) {
    setFormError("");
    try { setSelected(await shoferiApi.get(id)); }
    catch (requestError) { setError(requestError.message); }
  }

  function startEdit(driver) {
    setForm({ id: driver?.id, existingLicense: driver?.licenca_transport_nderkombtar ?? null, ...Object.fromEntries(Object.keys(emptyForm).map((key) => [key, key === "licenca_transport_nderkombtar" ? "" : driver?.[key] ?? ""])) });
    setFormError("");
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const body = Object.fromEntries(Object.keys(emptyForm).map((key) => [key, form[key] === "" && !["emri", "embg", "llogaria"].includes(key) ? null : form[key].trim?.() ?? form[key]]));
    if (form.id && !form.licenca_transport_nderkombtar) delete body.licenca_transport_nderkombtar;
    if (body.rroga !== null) {
      if (!Number.isFinite(Number(body.rroga))) {
        setFormError("Rroga duhet të jetë numër i vlefshëm.");
        setSaving(false);
        return;
      }
      body.rroga = Number(body.rroga);
    }
    try {
      const result = form.id ? await shoferiApi.update(form.id, body) : await shoferiApi.create(body);
      setForm(null);
      setSelected(result);
      setRefresh((value) => value + 1);
    } catch (requestError) { setFormError(requestError.message); }
    finally { setSaving(false); }
  }

  async function removeDriver() {
    if (!window.confirm(`Të fshihet shoferi ${selected.emri}?`)) return;
    setSaving(true);
    try { await shoferiApi.remove(selected.id); setSelected(null); setRefresh((value) => value + 1); }
    catch (requestError) { setFormError(requestError.message); }
    finally { setSaving(false); }
  }

  function changePage(nextPage) {
    if (loading || nextPage < 1 || nextPage > (data?.pages ?? 1)) return;
    setLoading(true);
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const items = loading ? [] : data?.items ?? [];
  return <div className="bt-page bt-shoferat-page">
    <header className="bt-page-header"><div><span className="bt-eyebrow">Bashkim Tours</span><h1>Shoferat dhe Staff</h1><p>Regjistri i shoferëve dhe dokumenteve të tyre.</p></div><button className="bt-btn-primary" onClick={() => startEdit(null)}><Plus size={18} /> Shto shofer</button></header>
    <div className="bt-shoferat-notice" role="note">Faqja ende është në përpunim.</div>
    <section className="bt-shoferat-toolbar">
      <label className="bt-shoferat-search"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kërko sipas emrit, telefonit, EMBG…" aria-label="Kërko shoferët" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Pastro kërkimin"><X size={16} /></button>}</label>
      <label>Rendit sipas <select value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(1); }}><option value="emri">Emrit</option><option value="rroga">Rrogës</option><option value="cd">Afatit CD</option><option value="licenca_transport_nderkombtar">Licenca Transport Nderkombtar</option><option value="id">ID</option></select></label>
      <button className="bt-btn-secondary" onClick={() => setSortOrder((value) => value === "asc" ? "desc" : "asc")}>{sortOrder === "asc" ? "Rritës" : "Zbritës"}</button>
    </section>
    {queryText && suggestions.length > 0 && <div className="bt-shoferat-suggestions"><span>Hap shpejt:</span>{suggestions.map((driver) => <button key={driver.id} onClick={() => openDriver(driver.id)}>{driver.emri}</button>)}</div>}
    {error && <p className="bt-inline-error" role="alert">{error} <button type="button" onClick={() => { setLoading(true); setRefresh((value) => value + 1); }}>Provo përsëri</button></p>}
    <div className="bt-shoferat-summary"><UsersRound size={20} /><strong>{data?.total ?? 0}</strong> shoferë në regjistër</div>
    <div className="bt-shoferat-table-wrap" aria-busy={loading}><table className="bt-shoferat-table"><thead><tr><th>Shoferi</th><th>Telefoni</th><th>EMBG</th><th>Llogaria</th><th>Rroga</th><th>CD</th><th>Licenca Transport Nderkombtar</th><th></th></tr></thead><tbody>
      {items.map((driver) => <tr key={driver.id}><td><button className="bt-shoferat-name" onClick={() => openDriver(driver.id)}>{driver.emri}</button></td><td>{driver.telefoni || "—"}</td><td>{driver.embg}</td><td>{driver.llogaria}</td><td>{hiddenSalary(driver.rroga)}</td><td>{formatDate(driver.cd)}</td><td>{formatDate(driver.licenca_transport_nderkombtar)}</td><td><button className="bt-shoferat-icon" onClick={() => openDriver(driver.id)} aria-label={`Hap ${driver.emri}`}><Pencil size={17} /></button></td></tr>)}
    </tbody></table>{!loading && !items.length && !error && <div className="bt-shoferat-empty">Nuk u gjet asnjë shofer.</div>}{loading && <div className="bt-shoferat-empty bt-shoferat-loading" role="status"><LoaderCircle size={22} /> Duke ngarkuar shoferët…</div>}</div>
    {data && data.pages > 1 && <nav className="bt-shoferat-pages" aria-label="Faqet e shoferëve"><button type="button" aria-label="Faqja e mëparshme" disabled={loading || page <= 1} onClick={() => changePage(page - 1)}><ChevronLeft size={19} /></button><span>Faqja {page} nga {data.pages}</span><button type="button" aria-label="Faqja tjetër" disabled={loading || page >= data.pages} onClick={() => changePage(page + 1)}><ChevronRight size={19} /></button></nav>}
    {selected && !form && <Modal title={selected.emri} onClose={() => setSelected(null)}><div className="bt-shoferat-detail"><div className="bt-shoferat-detail-grid">{fields.map((field) => <div key={field.key}><span>{field.label}</span><strong>{field.key === "rroga" ? hiddenSalary(selected[field.key]) : field.type === "date" ? formatDate(selected[field.key]) : selected[field.key] || "—"}</strong></div>)}</div>{formError && <p className="bt-inline-error">{formError}</p>}<div className="bt-shoferat-actions"><button className="bt-btn-primary" onClick={() => startEdit(selected)}><Pencil size={17} /> Ndrysho</button><button className="bt-btn-secondary" disabled={saving} onClick={removeDriver}><Trash2 size={17} /> Fshi</button></div></div></Modal>}
    {form && <Modal title={form.id ? "Ndrysho shoferin" : "Shto shofer"} onClose={() => { if (!saving) setForm(null); }}><form className="bt-shoferat-form" onSubmit={save}>{fields.map((field) => <label key={field.key}><span>{field.type === "date" && <CalendarDays size={15} />}{field.label}</span><input className={field.key === "licenca_transport_nderkombtar" && !form[field.key] ? "bt-shoferat-license-empty" : undefined} type={field.key === "rroga" ? "password" : field.type || "text"} inputMode={field.key === "rroga" ? "decimal" : undefined} autoComplete={field.key === "rroga" ? "off" : undefined} step={field.step} value={form[field.key]} required={field.required} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} />{field.key === "licenca_transport_nderkombtar" && form.id && <small>Data ekzistuese: {formatDate(form.existingLicense)}. Zgjidhni datë vetëm nëse doni ta ndryshoni.</small>}</label>)}{formError && <p className="bt-inline-error" role="alert">{formError}</p>}<div className="bt-shoferat-actions"><button className="bt-btn-primary" disabled={saving}>{saving ? "Duke ruajtur…" : "Ruaj"}</button><button type="button" className="bt-btn-secondary" disabled={saving} onClick={() => setForm(null)}>Anulo</button></div></form></Modal>}
  </div>;
}
