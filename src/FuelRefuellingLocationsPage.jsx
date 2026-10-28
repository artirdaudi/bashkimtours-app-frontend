import { useCallback, useEffect, useState } from "react";
import { MapPin, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { fuelRefuellingLocationsApi } from "./api";
import { confirmAction } from "./confirmAction";
import { Modal } from "./PortalPages";
import CharterReferencePicker from "./CharterReferencePicker";

const emptyForm = { id: null, name: "", location: "", comment: "" };

export default function FuelRefuellingLocationsPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedLocation, setAppliedLocation] = useState("");
  const locationOptions = [...new Set(locations.map((row) => row.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, "sq"));
  const visibleLocations = locations.filter((row) => (!appliedLocation || row.location === appliedLocation) && (!appliedSearch || [row.name, row.location, row.comment].some((value) => value?.toLocaleLowerCase("sq-AL").includes(appliedSearch))));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setLocations(await fuelRefuellingLocationsApi.list()); }
    catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const edit = async (id) => {
    setError("");
    try {
      const row = await fuelRefuellingLocationsApi.get(id);
      setForm({ id: row.id, name: row.name, location: row.location || "", comment: row.comment || "" });
    } catch (cause) { setError(cause.message); }
  };

  const save = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) { setError("Shkruaj emrin e lokacionit."); return; }
    setBusy(true);
    setError("");
    const body = { name, location: form.location.trim() || null, comment: form.comment.trim() || null };
    try {
      if (form.id == null) await fuelRefuellingLocationsApi.create(body);
      else await fuelRefuellingLocationsApi.update(form.id, body);
      setForm(null);
      await load();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  const remove = async (row) => {
    if (busy || !await confirmAction(`Të fshihet lokacioni “${row.name}”?`)) return;
    setBusy(true);
    setError("");
    try { await fuelRefuellingLocationsApi.remove(row.id); await load(); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  return <div className="bt-page bt-ops-page bt-fuel-suppliers-page bt-fuel-locations-page">
    <header className="bt-page-header"><div><span className="bt-eyebrow">Bashkim Tours · Nafta</span><h1>Lokacionet e furnizimit</h1><p>Menaxho vendet e jashtme ku kryhet furnizimi me karburant.</p></div><button type="button" className="bt-btn-primary" onClick={() => { setForm({ ...emptyForm }); setError(""); }}><Plus size={18} /> Shto lokacion</button></header>
    <form className="bt-external-refuelling-filters bt-fuel-locations-filters" onSubmit={(event) => { event.preventDefault(); setAppliedSearch(searchInput.trim().toLocaleLowerCase("sq-AL")); setAppliedLocation(locationFilter); }}><div className="bt-fuel-filters"><label>Kërko<input type="search" placeholder="Emri, lokacioni, komenti" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label><div className="bt-external-dropdown"><span>Lokacioni</span><CharterReferencePicker label="Lokacioni" value={locationFilter} selectedLabel={locationFilter} placeholder="Kërko lokacionin" searchOptions={(query) => locationOptions.filter((location) => location.toLocaleLowerCase("sq-AL").includes(query.toLocaleLowerCase("sq-AL"))).map((location) => ({ id: location, label: location }))} onSelect={(option) => setLocationFilter(option?.id || "")} /></div></div><div className="bt-external-filter-toolbar"><div className="bt-external-filter-actions"><button type="submit" className="bt-btn-primary"><Search size={16} /> Kërko</button><button type="button" className="bt-btn-secondary" onClick={() => { setSearchInput(""); setLocationFilter(""); setAppliedSearch(""); setAppliedLocation(""); }}>Pastro filtrat</button></div></div></form>
    {error && !form && <p className="bt-inline-error" role="alert">{error}</p>}
    {loading && <p>Duke ngarkuar lokacionet…</p>}
    {!loading && !visibleLocations.length && !error && <p className="bt-fuel-suppliers-empty">Nuk u gjet asnjë lokacion.</p>}
    <div className="bt-fuel-supplier-list">{visibleLocations.map((row) => <article key={row.id} className="bt-fuel-supplier-card"><span className="bt-fuel-supplier-icon"><MapPin size={22} aria-hidden="true" /></span><div className="bt-fuel-supplier-info"><h2>{row.name}</h2><p className="bt-fuel-location-line"><strong>Lokacioni:</strong> {row.location || "—"}</p>{row.comment && <p>{row.comment}</p>}</div><div className="bt-fuel-supplier-actions"><button type="button" className="bt-fuel-edit" aria-label={`Ndrysho lokacionin ${row.name}`} title="Ndrysho" disabled={busy} onClick={() => edit(row.id)}><Pencil size={17} /></button><button type="button" className="bt-fuel-delete" aria-label={`Fshi lokacionin ${row.name}`} title="Fshi" disabled={busy} onClick={() => remove(row)}><Trash2 size={17} /></button></div></article>)}</div>
    {form && <Modal title={form.id == null ? "Shto lokacion" : "Përditëso lokacionin"} className="bt-fuel-supplier-modal bt-fuel-locations-modal" onClose={() => { if (!busy) { setForm(null); setError(""); } }}><form onSubmit={save}>{error && <p className="bt-inline-error" role="alert">{error}</p>}<div className="bt-fuel-fields"><label>Emri<input required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Lokacioni<input maxLength={255} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><label>Komenti<textarea value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} /></label></div><div className="bt-fuel-actions"><button type="submit" className="bt-btn-primary" disabled={busy}>{busy ? "Duke ruajtur…" : "Ruaj"}</button><button type="button" className="bt-btn-secondary" disabled={busy} onClick={() => { setForm(null); setError(""); }}>Anulo</button></div></form></Modal>}
  </div>;
}
