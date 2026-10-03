import { useCallback, useEffect, useState } from "react";
import { Bus, ChevronLeft, ChevronRight, LoaderCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { autobusiApi, busExtApi } from "./api";
import { confirmAction } from "./confirmAction";
import { Modal } from "./PortalPages";

const baseFields = [
  { key: "Targat", label: "Targat", required: true },
  { key: "Ulse", label: "Ulëse", type: "number", required: true },
  { key: "Tipi", label: "Tipi" },
];
const extendedFields = [
  { key: "targa", label: "Targa" },
  { key: "marka", label: "Marka" },
  { key: "tipi", label: "Tipi" },
  { key: "nrshasise", label: "Numri i shasisë" },
  { key: "nrmotorit", label: "Numri i motorit" },
  { key: "viti", label: "Viti", type: "number" },
  { key: "ulse", label: "Ulëse", type: "number" },
  { key: "firma", label: "Firma" },
  { key: "regjistrimi", label: "Regjistrimi", type: "date" },
  { key: "gjashtemujorshi", label: "Gjashtëmujori", type: "date" },
  { key: "zk", label: "ZK", type: "date" },
  { key: "pp", label: "PP", type: "date" },
  { key: "taho", label: "Taho", type: "date" },
  { key: "alert", label: "Alert", type: "number" },
  { key: "kasko", label: "Kasko", type: "date" },
  { key: "pjp", label: "PJP", type: "date" },
  { key: "llrn", label: "LLRN", type: "date" },
  { key: "llrsn", label: "LLRSN", type: "date" },
  { key: "lljrn", label: "LLJRN", type: "date" },
  { key: "lljrsn", label: "LLJRSN", type: "date" },
];
const pageSize = 100;

export default function AutobusatPage() {
  const [tab, setTab] = useState("autobusi");
  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [queryText, setQueryText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const api = tab === "autobusi" ? autobusiApi : busExtApi;
  const fields = tab === "autobusi" ? baseFields : extendedFields;

  useEffect(() => {
    const timer = window.setTimeout(() => { setOffset(0); setQueryText(search.trim()); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await (tab === "autobusi" ? autobusiApi : busExtApi).list({
        limit: pageSize, offset, [tab === "autobusi" ? "Targat" : "targa"]: queryText,
      });
      setItems(result);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [tab, offset, queryText]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load, refresh]);

  function chooseTab(next) {
    setTab(next);
    setOffset(0);
    setItems([]);
    setSearch("");
    setQueryText("");
    setForm(null);
    setError("");
  }

  function openForm(item = null) {
    setError("");
    setForm({ ID: item?.ID ?? null, ...Object.fromEntries(fields.map(({ key }) => [key, item?.[key] ?? ""])) });
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const body = Object.fromEntries(fields.map(({ key, type }) => [key,
      form[key] === "" ? (tab === "autobusi" && key !== "Tipi" ? form[key] : null)
        : type === "number" ? Number(form[key]) : form[key].trim(),
    ]));
    try {
      if (form.ID != null) await api.update(form.ID, body);
      else await api.create(body);
      setForm(null);
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (busy || !await confirmAction(`Të fshihet autobusi ${item.Targat || item.targa || `#${item.ID}`}?`)) return;
    setBusy(true);
    setError("");
    try {
      await api.remove(item.ID);
      if (items.length === 1 && offset > 0) setOffset(offset - pageSize);
      else setRefresh((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="bt-page bt-shoferat-page bt-autobusat-page">
    <header className="bt-page-header"><div><span className="bt-eyebrow">Bashkim Tours</span><h1>Autobusët</h1><p>Regjistri i autobusëve.</p></div><button type="button" className="bt-btn-primary" onClick={() => openForm()}><Plus size={18} /> Shto autobus</button></header>
    <div className="bt-shoferat-notice" role="note">Faqja ende është në përpunim.</div>
    <div className="bt-accounts-tabs" role="tablist" aria-label="Regjistrat e autobusëve">
      <button type="button" role="tab" aria-selected={tab === "autobusi"} className={tab === "autobusi" ? "active" : ""} onClick={() => chooseTab("autobusi")}>Autobusi</button>
      <button type="button" role="tab" aria-selected={tab === "busext"} className={tab === "busext" ? "active" : ""} onClick={() => chooseTab("busext")}>BusExt</button>
    </div>
    <section className="bt-shoferat-toolbar"><label className="bt-shoferat-search"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kërko sipas targës…" aria-label="Kërko autobusët sipas targës" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Pastro kërkimin"><X size={16} /></button>}</label></section>
    {error && !form && <p className="bt-inline-error" role="alert">{error}</p>}
    <div className="bt-shoferat-summary"><Bus size={20} /><strong>{items.length}</strong> autobusë në këtë faqe</div>
    <div className="bt-shoferat-table-wrap" aria-busy={loading}><table className="bt-shoferat-table bt-autobusat-table"><thead><tr>{fields.map((field) => <th key={field.key}>{field.label}</th>)}<th>Veprimet</th></tr></thead><tbody>
      {!loading && items.map((item) => <tr key={item.ID}>{fields.map((field) => <td key={field.key} data-label={field.label}>{item[field.key] ?? "—"}</td>)}<td data-label="Veprimet"><div className="bt-role-actions"><button type="button" className="bt-btn-secondary" onClick={() => openForm(item)}><Pencil size={16} /> Ndrysho</button><button type="button" className="bt-btn-danger" disabled={busy} onClick={() => remove(item)}><Trash2 size={16} /> Fshi</button></div></td></tr>)}
    </tbody></table>{loading && <div className="bt-shoferat-empty bt-shoferat-loading" role="status"><LoaderCircle size={22} /> Duke ngarkuar autobusët…</div>}{!loading && !items.length && !error && <div className="bt-shoferat-empty">{queryText ? "Nuk u gjet asnjë autobus." : "Nuk ka autobusë në këtë regjistër."}</div>}</div>
    <nav className="bt-shoferat-pages" aria-label="Faqet e autobusëve"><button type="button" aria-label="Faqja e mëparshme" disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))}><ChevronLeft size={19} /></button><span>Faqja {offset / pageSize + 1}</span><button type="button" aria-label="Faqja tjetër" disabled={loading || items.length < pageSize} onClick={() => setOffset(offset + pageSize)}><ChevronRight size={19} /></button></nav>
    {form && <Modal title={form.ID != null ? "Ndrysho autobusin" : "Shto autobus"} className="bt-shoferat-form-modal" onClose={() => { if (!busy) setForm(null); }}><form className="bt-shoferat-form" onSubmit={save}>
      {fields.map(({ key, label, type, required }) => <label key={key}><span>{label}</span><input type={type || "text"} min={type === "number" ? 0 : undefined} required={required} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}
      {error && <p className="bt-inline-error" role="alert">{error}</p>}
      <div className="bt-modal-actions"><button type="submit" className="bt-btn-primary" disabled={busy}>{busy ? "Duke ruajtur…" : "Ruaj"}</button></div>
    </form></Modal>}
  </div>;
}
