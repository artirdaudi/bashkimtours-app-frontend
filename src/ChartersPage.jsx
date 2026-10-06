import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Banknote, Bus, CalendarDays, Clock3, ChevronLeft, ChevronRight, FileText, Pencil, Plus, Route, Search, Trash2, UsersRound, X } from "lucide-react";
import { busExtApi, charterPaymentsApi, chartersApi, documentsApi, shoferiApi } from "./api";
import DriverDocuments from "./DriverDocuments";
import CharterAgendaDraft from "./CharterAgendaDraft";
import { DOCUMENT_ENTITY_TYPES } from "./documentEntityTypes";
import CharterAssignments from "./CharterAssignments";
import { loadCharterAssignments, syncCharterAssignments } from "./charterAssignmentSync";
import { confirmAction } from "./confirmAction";
import { Modal } from "./PortalPages";

const fields = [
  { key: "contractor", label: "Porositësi" },
  { key: "route", label: "Relacioni" },
  { key: "number_of_buses", label: "Numri i autobusëve", type: "number" },
  { key: "drivers_per_bus", label: "Shoferë për autobus", type: "number" },
  { key: "price", label: "Çmimi", type: "number", step: "0.01" },
  { key: "billing_type", label: "Lloji i faturimit" },
  { key: "passenger_count", label: "Numri i udhëtarëve", type: "number" },
  { key: "departure_at", label: "Nisja", type: "datetime-local" },
  { key: "return_at", label: "Kthimi", type: "datetime-local" },
  { key: "responsible_phone", label: "Telefoni përgjegjës", type: "tel" },
  { key: "paid_amount", label: "Shuma e paguar", type: "number", step: "0.01" },
  { key: "payment_date", label: "Data e pagesës", type: "datetime-local" },
  { key: "comment", label: "Koment", type: "textarea" },
];
const displayValue = (item, { key, type }) => {
  const value = item[key];
  if (key === "created_by_user") return value?.username || (item.created_by_user_id != null ? String(item.created_by_user_id) : "—");
  if (value == null || value === "") return "—";
  if (type === "datetime-local") return dateTime(value);
  if (key === "price" || key === "paid_amount") return money(value);
  if (key === "billing_type") return { CASH: "Kesh", INVOICE: "Faturë" }[value] || String(value);
  return String(value);
};
const formGroups = [
  { title: "Udhëtimi", keys: ["contractor", "route", "passenger_count", "responsible_phone", "departure_at", "return_at"] },
  { title: "Agjenda", keys: [] },
  { title: "Faturimi", keys: ["price", "billing_type"] },
  { title: "Autobusi dhe shoferët", keys: ["number_of_buses", "drivers_per_bus"] },
  { title: "Shënime", keys: ["comment"] },
];
const createHidden = new Set(["paid_amount", "payment_date"]);
const pageSize = 20;
const money = (value) => value == null ? "—" : new Intl.NumberFormat("sq-AL", { maximumFractionDigits: 2 }).format(Number(value));
const dateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map(({ type, value: part }) => [type, part]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
};
const formDate = (value) => value ? value.slice(0, 16) : "";
const shortDate = (value) => value ? value.split("-").reverse().join("/") : "Zgjidh datën";
const initialForm = (item) => Object.fromEntries(fields.map(({ key, type }) => [key, type === "datetime-local" ? formDate(item?.[key]) : item?.[key] ?? (["number_of_buses", "drivers_per_bus"].includes(key) ? 1 : "")]));

export default function ChartersPage() {
  const [items, setItems] = useState([]);
  const allReservationsRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [paymentItem, setPaymentItem] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", comment: "" });
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [buses, setBuses] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [agendaDrafts, setAgendaDrafts] = useState([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState([]);
  const [existingAssignments, setExistingAssignments] = useState([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentLoadError, setAssignmentLoadError] = useState(false);
  const assignmentLoadId = useRef(0);
  const [agendaDocuments, setAgendaDocuments] = useState({});
  const [agendaLoadError, setAgendaLoadError] = useState(false);
  const [calendarFor, setCalendarFor] = useState(null);
  const [timeFor, setTimeFor] = useState(null);
  const [timeHour, setTimeHour] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (!form || (!calendarFor && !timeFor)) return;
    const closeOutside = (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      if (calendarFor && target?.closest(".bt-charter-calendar-control")?.dataset.pickerKey !== calendarFor) setCalendarFor(null);
      if (timeFor && target?.closest(".bt-charter-time-control")?.dataset.pickerKey !== timeFor) { setTimeFor(null); setTimeHour(null); }
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setCalendarFor(null);
      setTimeFor(null);
      setTimeHour(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape, true);
    };
  }, [form, calendarFor, timeFor]);

  useEffect(() => {
    const update = () => setCurrentTime(Date.now());
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => { setOffset(0); setFilter(search.trim().toLocaleLowerCase("sq-AL")); }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = [];
      let page = [];
      do {
        page = await chartersApi.list({ limit: 1000, offset: all.length });
        all.push(...page);
      } while (page.length === 1000);
      setItems(all);
      setError("");
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = setTimeout(load, 0); return () => clearTimeout(timer); }, [load, refresh]);
  const unpaidCount = items.filter((item) => !(Number(item.price) > 0 && Number(item.paid_amount) >= Number(item.price))).length;
  const upcomingCount = items.filter((item) => item.departure_at && new Date(item.departure_at).getTime() >= currentTime).length;
  const filteredItems = useMemo(() => items.filter((item) => (!unpaidOnly || !(Number(item.price) > 0 && Number(item.paid_amount) >= Number(item.price))) && (!upcomingOnly || (item.departure_at && new Date(item.departure_at).getTime() >= currentTime)) && (!filter || [item.contractor, item.route].some((value) => String(value || "").toLocaleLowerCase("sq-AL").includes(filter)))), [items, filter, unpaidOnly, upcomingOnly, currentTime]);
  const upcomingItems = useMemo(() => filteredItems.filter((item) => item.departure_at && new Date(item.departure_at).getTime() >= currentTime).sort((a, b) => new Date(a.departure_at) - new Date(b.departure_at)), [filteredItems, currentTime]);
  const visibleItems = filteredItems.slice(offset, offset + pageSize);
  useEffect(() => {
    if ((search.trim() || unpaidOnly || upcomingOnly) && allReservationsRef.current) allReservationsRef.current.open = true;
  }, [search, unpaidOnly, upcomingOnly, loading]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const all = [];
        let page = [];
        do {
          page = await busExtApi.list({ limit: 1000, offset: all.length });
          all.push(...page);
        } while (page.length === 1000);
        if (active) setBuses(all);
      } catch { /* ID-ja mund të shkruhet edhe kur lista e autobusëve nuk ngarkohet. */ }
    })();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const all = [];
        let page = 1;
        while (true) {
          const result = await shoferiApi.list({ page, page_size: 200 });
          all.push(...result.items);
          if (page >= result.pages || !result.items.length) break;
          page += 1;
        }
        if (active) setDrivers(all);
      } catch { if (active) setDrivers([]); }
    })();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!items.length) return;
    let active = true;
    (async () => {
      try {
        const all = [];
        let page = 1;
        while (true) {
          const result = await documentsApi.list({ entity_type: DOCUMENT_ENTITY_TYPES.CHARTER, page, page_size: 200 });
          all.push(...result.items);
          if (all.length >= result.total || !result.items.length) break;
          page += 1;
        }
        if (active) {
          const byCharter = Object.fromEntries(items.map((item) => [String(item.id), []]));
          all.forEach((document) => { if (byCharter[String(document.entity_id)]) byCharter[String(document.entity_id)].push(document); });
          setAgendaDocuments(byCharter);
          setAgendaLoadError(false);
        }
      } catch { if (active) setAgendaLoadError(true); }
    })();
    return () => { active = false; };
  }, [items]);
  const loadAgendaDocuments = useCallback(async (id) => {
    const documents = [];
    let page = 1;
    while (true) {
      const result = await documentsApi.list({ entity_type: DOCUMENT_ENTITY_TYPES.CHARTER, entity_id: String(id), page, page_size: 200 });
      documents.push(...result.items);
      if (documents.length >= result.total || !result.items.length) break;
      page += 1;
    }
    setAgendaDocuments((current) => ({ ...current, [String(id)]: documents }));
    return documents;
  }, []);
  async function openForm(item = null) {
    const loadId = ++assignmentLoadId.current;
    setError("");
    setCalendarFor(null);
    setTimeFor(null);
    setAgendaDrafts([]);
    setAssignmentDrafts([]);
    setExistingAssignments([]);
    setAssignmentLoading(Boolean(item));
    setAssignmentLoadError(false);
    setForm({ id: item?.id ?? null, ...initialForm(item), ...(item ? {} : { departure_at: "", return_at: "" }) });
    if (item) {
      try {
        const current = await loadCharterAssignments(item.id);
        if (loadId === assignmentLoadId.current) {
          setExistingAssignments(current);
          setAssignmentDrafts(current.map((entry) => ({ busId: String(entry.bus_id), driverIds: entry.drivers.map((driver) => String(driver.driver_id)) })));
        }
      } catch (requestError) { if (loadId === assignmentLoadId.current) { setError(requestError.message); setAssignmentLoadError(true); } }
      finally { if (loadId === assignmentLoadId.current) setAssignmentLoading(false); }
    }
  }
  function openCalendar(key) {
    const selectedMonth = String(form[key] || "").slice(0, 7);
    setCalendarMonth(/^\d{4}-\d{2}$/.test(selectedMonth) ? selectedMonth : new Date().toISOString().slice(0, 7));
    setTimeFor(null);
    setTimeHour(null);
    setCalendarFor((current) => current === key ? null : key);
  }
  function chooseDate(key, day) {
    setForm((current) => ({ ...current, [key]: `${day}T${String(current[key] || "").slice(11, 16)}` }));
    setCalendarFor(null);
  }
  const [calendarYear, calendarMonthNumber] = calendarMonth.split("-").map(Number);
  const firstWeekday = (new Date(calendarYear, calendarMonthNumber - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(calendarYear, calendarMonthNumber, 0).getDate();
  function moveCalendar(delta) {
    const date = new Date(calendarYear, calendarMonthNumber - 1 + delta, 1);
    setCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  async function save(event) {
    event.preventDefault();
    if (busy || assignmentLoading || assignmentLoadError) return;
    if (["departure_at", "return_at"].some((key) => form[key] && !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(form[key]))) { setError("Plotësoni datën dhe orën në formatin 24 orë."); return; }
    if (form.departure_at && form.return_at && form.return_at < form.departure_at) { setError("Kthimi duhet të jetë pas nisjes."); return; }
    const desiredAssignments = Array.from({ length: Number(form.number_of_buses) }, (_, index) => ({
      busId: assignmentDrafts[index]?.busId || "",
      driverIds: Array.from({ length: Number(form.drivers_per_bus) }, (_, slot) => assignmentDrafts[index]?.driverIds[slot] || ""),
    }));
    if (desiredAssignments.some((item) => !item.busId || item.driverIds.some((id) => !id))) { setError("Zgjidhni çdo autobus dhe shofer sipas numrit të shënuar."); return; }
    const allDriverIds = desiredAssignments.flatMap((item) => item.driverIds.map(String));
    if (new Set(desiredAssignments.map((item) => String(item.busId))).size !== desiredAssignments.length || new Set(allDriverIds).size !== allDriverIds.length) { setError("I njëjti autobus ose shofer nuk mund të zgjidhet dy herë."); return; }
    setBusy(true); setError("");
    const body = Object.fromEntries(fields.filter(({ key }) => !createHidden.has(key)).map(({ key, type }) => {
      const value = String(form[key] ?? "").trim();
      return [key, value === "" ? null : type === "number" ? Number(value) : type === "datetime-local" ? new Date(value).toISOString() : value];
    }));
    let charterId = form.id;
    try {
      if (charterId != null) await chartersApi.update(charterId, body);
      else {
        const created = await chartersApi.create(body);
        charterId = created.id;
        setForm((current) => ({ ...current, id: charterId }));
      }
      await syncCharterAssignments(charterId, desiredAssignments, existingAssignments);
      for (const item of agendaDrafts) {
        const upload = new FormData();
        upload.append("document_type_id", item.typeId);
        upload.append("entity_type", DOCUMENT_ENTITY_TYPES.CHARTER);
        upload.append("entity_id", String(charterId));
        upload.append("file", item.file);
        if (item.comment.trim()) upload.append("comment", item.comment.trim());
        await documentsApi.upload(upload);
        setAgendaDrafts((current) => current.filter((pending) => pending !== item));
      }
      setForm(null); setRefresh((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message);
      if (charterId) loadCharterAssignments(charterId).then(setExistingAssignments).catch(() => setAssignmentLoadError(true));
    }
    finally { setBusy(false); }
  }
  async function remove(item) {
    if (busy || !await confirmAction(`Të fshihet charter-i #${item.id}?`)) return;
    setBusy(true); setError("");
    try {
      await chartersApi.remove(item.id);
      if (visibleItems.length === 1 && offset > 0) setOffset(offset - pageSize);
      else setRefresh((value) => value + 1);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  function openPayment(item) {
    setPaymentItem(item);
    setPaymentForm({ amount: "", comment: "" });
    setPaymentError("");
  }

  async function savePayment(event) {
    event.preventDefault();
    if (!paymentItem || paymentBusy) return;
    const isInvoice = paymentItem.billing_type === "INVOICE";
    const amount = Number(paymentForm.amount);
    const remaining = Number(paymentItem.price) - Number(paymentItem.paid_amount || 0);
    if (!isInvoice && (!Number.isFinite(amount) || amount <= 0 || amount > remaining)) {
      setPaymentError(`Shëno një shumë më të madhe se zero dhe jo më shumë se ${money(remaining)}.`);
      return;
    }
    setPaymentBusy(true);
    setPaymentError("");
    try {
      await charterPaymentsApi.create(paymentItem.id, {
        amount: isInvoice ? null : amount,
        payment_date: new Date().toISOString(),
        comment: paymentForm.comment.trim() || null,
      });
      setPaymentItem(null);
      setRefresh((value) => value + 1);
    } catch (requestError) { setPaymentError(requestError.message); }
    finally { setPaymentBusy(false); }
  }

  const renderCard = (item) => <article className="bt-charter-card" key={item.id} tabIndex={0} aria-label={`Ndrysho charter-in ${item.contractor || item.id}`} onClick={(event) => { if (!event.target.closest("button, a, input, select, textarea, summary, [role=button]")) openForm(item); }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openForm(item); } }}>
        <div className="bt-charter-card-head"><div><h2>{item.contractor || "Pa porositës"}</h2><p><Route size={16} /> {item.route || "Relacioni nuk është shënuar"}</p></div><div className="bt-charter-card-price"><span>Çmimi</span><strong>{money(item.price)}</strong><small>{displayValue(item, { key: "billing_type" })}</small><small>{item.passenger_count ?? "—"} udhëtarë</small></div></div>
        <div className="bt-charter-card-facts"><div><CalendarDays size={18} /><span><small>Nisja</small><strong>{dateTime(item.departure_at)}</strong></span></div><div><CalendarDays size={18} /><span><small>Kthimi</small><strong>{dateTime(item.return_at)}</strong></span></div><div><Bus size={18} /><span><small>Autobusë</small><strong>{item.number_of_buses ?? "—"}</strong></span></div><div><UsersRound size={18} /><span><small>Shoferë për autobus</small><strong>{item.drivers_per_bus ?? "—"}</strong></span></div></div>
        <div className="bt-charter-agenda-summary"><FileText size={17} /><div><strong>Agjenda{agendaDocuments[String(item.id)] ? ` · ${agendaDocuments[String(item.id)].length} dokumente` : ""}</strong>{agendaDocuments[String(item.id)] === undefined ? <small>{agendaLoadError ? "Dokumentet nuk u ngarkuan" : "Duke ngarkuar dokumentet…"}</small> : <DriverDocuments driver={{ id: item.id, emri: item.contractor || `Charter ${item.id}` }} entityType={DOCUMENT_ENTITY_TYPES.CHARTER} documents={agendaDocuments[String(item.id)]} loadDocuments={loadAgendaDocuments} readOnly />}</div></div>
        <div className="bt-charter-card-footer"><span className={`bt-charter-paid ${Number(item.price) > 0 && Number(item.paid_amount) >= Number(item.price) ? "is-paid" : "is-unpaid"}`}><Banknote size={16} /> {Number(item.price) > 0 && Number(item.paid_amount) >= Number(item.price) ? "Paguar" : "Ende pa paguar"}: <strong>{money(item.paid_amount)} / {money(item.price)}</strong></span><span>Regjistruar nga: <strong>{displayValue(item, { key: "created_by_user" })}</strong></span><span>Regjistruar në: <strong>{dateTime(item.created_at)}</strong></span><div className="bt-charter-card-actions">{Number(item.price) > 0 && Number(item.paid_amount || 0) < Number(item.price) && <button type="button" className="bt-btn-primary" onClick={() => openPayment(item)}><Banknote size={16} /> Bëj pagesë</button>}<button type="button" className="bt-btn-secondary" onClick={() => openForm(item)}><Pencil size={16} /> Ndrysho</button><button type="button" className="bt-btn-danger" disabled={busy} onClick={() => remove(item)}><Trash2 size={16} /> Fshi</button></div></div>

    </article>;

  return <div className="bt-page bt-shoferat-page bt-charters-page">
    <header className="bt-page-header"><div><span className="bt-eyebrow">Bashkim Tours</span><h1>Charterët Rezervim</h1><p>Udhëtimet me porosi, oraret dhe pagesat.</p></div><button type="button" className="bt-btn-primary" onClick={() => openForm()}><Plus size={18} /> Shto charter</button></header>
    <div className="bt-charter-metrics" aria-label="Filtrat e rezervimeve"><button type="button" className={`bt-charter-metric ${!unpaidOnly && !upcomingOnly ? "active" : ""}`} aria-pressed={!unpaidOnly && !upcomingOnly} onClick={() => { setUnpaidOnly(false); setUpcomingOnly(false); setOffset(0); }}><span className="bt-charter-metric-icon"><Route size={20} /></span><span><small>Rezervime gjithsej</small><strong>{items.length}</strong></span></button><button type="button" className={`bt-charter-metric ${upcomingOnly ? "active" : ""}`} aria-pressed={upcomingOnly} onClick={() => { setUpcomingOnly(true); setUnpaidOnly(false); setOffset(0); }}><span className="bt-charter-metric-icon"><CalendarDays size={20} /></span><span><small>Charterët e ardhshëm</small><strong>{upcomingCount}</strong></span></button><button type="button" className={`bt-charter-metric bt-charter-metric-unpaid ${unpaidOnly ? "active" : ""}`} aria-pressed={unpaidOnly} onClick={() => { setUnpaidOnly(true); setUpcomingOnly(false); setOffset(0); }}><span className="bt-charter-metric-icon"><Banknote size={20} /></span><span><small>Ende pa paguar</small><strong>{unpaidCount}</strong></span></button></div>
    <section className="bt-shoferat-toolbar"><label className="bt-shoferat-search"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kërko porositësin ose relacionin…" aria-label="Kërko charterët" />{search && <button type="button" aria-label="Pastro kërkimin" onClick={() => setSearch("")}><X size={16} /></button>}</label></section>
    {error && !form && <p className="bt-inline-error" role="alert">{error}</p>}
    <div className="bt-charter-list" aria-busy={loading}>
      {loading && <div className="bt-shoferat-empty" role="status">Duke ngarkuar charterët…</div>}
      {!loading && <section className="bt-charter-section" aria-labelledby="bt-upcoming-title"><header><div><span className="bt-eyebrow">Së shpejti</span><h2 id="bt-upcoming-title">Rezervimet e ardhshme</h2><p>Charterët me nisje nga tani e tutje, sipas datës së nisjes.</p></div></header><div className="bt-charter-section-cards">{upcomingItems.length ? upcomingItems.map(renderCard) : <div className="bt-shoferat-empty">Nuk ka rezervime të ardhshme.</div>}</div></section>}
      {!loading && <details ref={allReservationsRef} className="bt-charter-section bt-charter-all-section"><summary><span><span className="bt-eyebrow">Regjistri</span><strong>Të gjitha rezervimet</strong><small>Lista e plotë e charterëve, përfshirë rezervimet e ardhshme.</small></span><ChevronRight size={20} className="bt-charter-section-chevron" /></summary><div className="bt-charter-section-cards">{visibleItems.map(renderCard)}{!filteredItems.length && !error && <div className="bt-shoferat-empty">Nuk u gjet asnjë charter.</div>}</div><nav className="bt-shoferat-pages" aria-label="Faqet e charterëve"><button type="button" aria-label="Faqja e mëparshme" disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))}><ChevronLeft size={19} /></button><span>Faqja {offset / pageSize + 1} nga {Math.max(1, Math.ceil(filteredItems.length / pageSize))}</span><button type="button" aria-label="Faqja tjetër" disabled={loading || offset + pageSize >= filteredItems.length} onClick={() => setOffset(offset + pageSize)}><ChevronRight size={19} /></button></nav></details>}
    </div>
    {paymentItem && <Modal title={`Bëj pagesë · ${paymentItem.contractor || `Charter ${paymentItem.id}`}`} onClose={() => { if (!paymentBusy) setPaymentItem(null); }}><form className="bt-role-form bt-charter-payment-form" onSubmit={savePayment}><p className="bt-charter-payment-context">{paymentItem.route || "Pa relacion"} · Mbetur: <strong>{money(Math.max(0, Number(paymentItem.price) - Number(paymentItem.paid_amount || 0)))}</strong></p>{paymentItem.billing_type !== "INVOICE" && <label>Shuma<input type="number" min="0.01" max={Math.max(0, Number(paymentItem.price) - Number(paymentItem.paid_amount || 0))} step="0.01" required value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} /></label>}<label>Koment <small>(opsional)</small><textarea rows={3} value={paymentForm.comment} onChange={(event) => setPaymentForm({ ...paymentForm, comment: event.target.value })} /></label>{paymentError && <p className="bt-inline-error" role="alert">{paymentError}</p>}<div className="bt-modal-actions"><button type="button" className="bt-btn-secondary" disabled={paymentBusy} onClick={() => setPaymentItem(null)}>Anulo</button><button type="submit" className="bt-btn-primary" disabled={paymentBusy}>{paymentBusy ? "Duke ruajtur…" : "Ruaj pagesën"}</button></div></form></Modal>}
    {form && <Modal title={form.id != null ? "Ndrysho charter-in" : "Shto charter"} className="bt-shoferat-form-modal bt-charter-form-modal" onClose={() => { if (!busy) { assignmentLoadId.current += 1; setForm(null); } }}><form className="bt-shoferat-form bt-charter-form" onSubmit={save}>{formGroups.map((group) => { const groupFields = group.keys.map((key) => fields.find((field) => field.key === key)).filter((field) => field && (form.id != null || !createHidden.has(field.key))); return <fieldset className="bt-charter-form-group" key={group.title}><legend>{group.title}</legend>{group.title === "Agjenda" ? (form.id != null ? <DriverDocuments driver={{ id: form.id, emri: `Charter ${form.id}` }} entityType={DOCUMENT_ENTITY_TYPES.CHARTER} multiple documents={agendaDocuments[String(form.id)]} loadDocuments={loadAgendaDocuments} /> : <CharterAgendaDraft files={agendaDrafts} onChange={setAgendaDrafts} />) : <div className="bt-charter-form-grid">{groupFields.map(({ key, label, type, step }) => <label key={key} ><span>{label}</span>{key === "billing_type" ? <select value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })}><option value="">Zgjidh llojin</option><option value="CASH">Kesh</option><option value="INVOICE">Faturë</option></select> : type === "datetime-local" ? <div className="bt-charter-date-time"><div className="bt-charter-calendar-control" data-picker-key={key}><button type="button" className="bt-charter-date-button" aria-label={`${label}: zgjidh datën`} aria-expanded={calendarFor === key} onClick={() => openCalendar(key)}><CalendarDays size={17} />{shortDate(String(form[key] || "").slice(0, 10))}</button>{calendarFor === key && <div className="bt-charter-calendar"><div className="bt-charter-calendar-header"><button type="button" aria-label="Muaji i kaluar" onClick={() => moveCalendar(-1)}><ChevronLeft size={17} /></button><strong>{new Intl.DateTimeFormat("sq-AL", { month: "long", year: "numeric" }).format(new Date(calendarYear, calendarMonthNumber - 1, 1))}</strong><button type="button" aria-label="Muaji tjetër" onClick={() => moveCalendar(1)}><ChevronRight size={17} /></button></div><div className="bt-charter-calendar-days">{["H", "M", "M", "E", "P", "S", "D"].map((day, index) => <span key={index}>{day}</span>)}{Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => { const day = `${calendarMonth}-${String(index + 1).padStart(2, "0")}`; return <button type="button" key={day} aria-label={day} aria-pressed={String(form[key] || "").slice(0, 10) === day} onClick={() => chooseDate(key, day)}>{index + 1}</button>; })}</div></div>}</div><div className="bt-charter-time-control" data-picker-key={key}><input type="text" inputMode="numeric" pattern="(?:[01]\d|2[0-3]):[0-5]\d" placeholder="HH:mm" aria-label={`${label}: ora në formatin 24 orë`} disabled={!String(form[key] || "").slice(0, 10)} value={String(form[key] || "").slice(11, 16)} onClick={() => { setTimeFor(key); setTimeHour(null); setCalendarFor(null); }} onChange={(event) => setForm({ ...form, [key]: `${String(form[key] || "").slice(0, 10)}T${event.target.value}` })} /><button type="button" aria-label={`${label}: zgjidh orën`} aria-expanded={timeFor === key} disabled={!String(form[key] || "").slice(0, 10)} onClick={() => { setTimeFor(timeFor === key ? null : key); setTimeHour(null); setCalendarFor(null); }}><Clock3 size={18} /></button>{timeFor === key && <div className="bt-charter-time-popover"><div className="bt-charter-time-title"><strong>{timeHour == null ? "Zgjidh orën" : `Ora ${timeHour} · Zgjidh minutat`}</strong>{timeHour != null && <button type="button" onClick={() => setTimeHour(null)}>Kthehu</button>}</div><div className="bt-charter-time-grid">{(timeHour == null ? Array.from({ length: 24 }, (_, index) => index) : Array.from({ length: 12 }, (_, index) => index * 5)).map((number) => <button type="button" key={number} onClick={() => { if (timeHour == null) setTimeHour(String(number).padStart(2, "0")); else { setForm({ ...form, [key]: `${String(form[key] || "").slice(0, 10)}T${timeHour}:${String(number).padStart(2, "0")}` }); setTimeFor(null); } }}>{String(number).padStart(2, "0")}</button>)}</div></div>}</div></div> : type === "textarea" ? <textarea value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} rows={3} /> : <input type={type || "text"} min={type === "number" ? (["number_of_buses", "drivers_per_bus"].includes(key) ? 1 : 0) : undefined} step={step || (type === "number" ? "1" : undefined)} required={["number_of_buses", "drivers_per_bus"].includes(key)} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}</label>)}</div>}{group.title === "Autobusi dhe shoferët" && <CharterAssignments assignments={assignmentDrafts} onChange={setAssignmentDrafts} numberOfBuses={form.number_of_buses} driversPerBus={form.drivers_per_bus} buses={buses} drivers={drivers} disabled={assignmentLoading} />}</fieldset>; })}{error && <p className="bt-inline-error" role="alert">{error}</p>}<div className="bt-shoferat-actions"><button className="bt-btn-primary" disabled={busy || assignmentLoading || assignmentLoadError}>{busy ? "Duke ruajtur…" : assignmentLoading ? "Duke ngarkuar…" : "Ruaj"}</button><button type="button" className="bt-btn-secondary" disabled={busy} onClick={() => setForm(null)}>Anulo</button></div></form></Modal>}
  </div>;
}
