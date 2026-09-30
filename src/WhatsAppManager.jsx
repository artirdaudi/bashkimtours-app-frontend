import { Fragment, useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, RefreshCw, Search } from "lucide-react";
import { whatsappNotificationsApi } from "./api";

const pageSize = 20;
const statusNames = { PENDING: "PENDING", ACCEPTED: "ACCEPTED", SENT: "SENT", DELIVERED: "DELIVERED", READ: "READ", FAILED: "FAILED", RUNNING: "Në proces", COMPLETED: "Përfunduar", PARTIAL: "Pjesërisht" };
const batchNames = { MONTHLY_REPORT: "Raporti mujor Maarif", CARD_COLLECTION_DEADLINE: "Njoftimi i kartelës", PAYMENT_NOTIFICATION: "Njoftimi i pagesës", TEST_MESSAGE: "Mesazh testues" };
const dateTime = (value) => value ? new Date(value).toLocaleString("sq-AL", { dateStyle: "medium", timeStyle: "short", hour12: false }) : "—";
const filters = [
  { key: "", label: "Të gjithë", count: "total" },
  { key: "SENT", label: "SENT", count: "sent" },
  { key: "DELIVERED", label: "DELIVERED", count: "delivered" },
  { key: "READ", label: "READ", count: "read" },
  { key: "FAILED", label: "FAILED", count: "failed" },
];
const compact = (value) => value.replace(/\D/g, "");

function Status({ value }) {
  return <span className={`bt-wa-status bt-wa-status-${value?.toLowerCase() || "unknown"}`}>{statusNames[value] || value || "—"}</span>;
}

function Pager({ page, total, onChange }) {
  if (total <= pageSize) return null;
  return <div className="bt-wa-pager"><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>Mbrapa</button><span>Faqja {page} nga {Math.ceil(total / pageSize)}</span><button type="button" disabled={page * pageSize >= total} onClick={() => onChange(page + 1)}>Përpara</button></div>;
}

function FailureDetails({ message }) {
  const details = [
    ["Kodi", message.error_code],
    ["Titulli", message.error_title],
    ["Mesazhi", message.error_message],
    ["Detajet", message.error_details],
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");
  return <div className="bt-wa-failure"><strong>Gabimi i dërgimit</strong>{details.length ? <dl>{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p>API-ja nuk ka kthyer hollësi për këtë dështim.</p>}</div>;
}

function RecipientDetails({ item, events, eventsError, eventPage, onEventPage }) {
  return <div className="bt-wa-recipient-detail">
    <div className="bt-wa-detail-grid"><div><span>Numri</span><strong>{item.phone_number}</strong></div><div><span>Meta ID</span><strong>{item.meta_message_id || "—"}</strong></div>
      {[["Pranuar", item.accepted_at], ["Dërguar", item.sent_at], ["Dorëzuar", item.delivered_at], ["Lexuar", item.read_at], ["Dështuar", item.failed_at]].filter(([, value]) => value).map(([label, value]) => <div key={label}><span>{label}</span><strong>{dateTime(value)}</strong></div>)}
    </div>
    {item.status === "FAILED" && <FailureDetails message={item} />}
    <div className="bt-wa-events"><strong>Historia e statusit</strong>
      {eventsError && <p className="bt-inline-error">{eventsError}</p>}
      {!events && !eventsError && <p>Duke ngarkuar…</p>}
      {events?.items.length === 0 && <p>Nuk ka ngjarje të regjistruara.</p>}
      {!!events?.items.length && <ul>{events.items.map((event) => <li key={event.id}><Status value={event.status} /><span>{dateTime(event.meta_timestamp)}</span>{[event.error_code, event.error_title, event.error_message, event.error_details].some((value) => value != null && value !== "") && <small>{[event.error_code, event.error_title, event.error_message, event.error_details].filter((value) => value != null && value !== "").join(" · ")}</small>}</li>)}</ul>}
      {events && <Pager page={eventPage} total={events.total} onChange={onEventPage} />}
    </div>
  </div>;
}

export default function WhatsAppManager() {
  const [batches, setBatches] = useState(null);
  const [batchPage, setBatchPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [batch, setBatch] = useState(null);
  const [messages, setMessages] = useState(null);
  const [messagePage, setMessagePage] = useState(1);
  const [status, setStatus] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [events, setEvents] = useState(null);
  const [eventPage, setEventPage] = useState(1);
  const [eventsError, setEventsError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    whatsappNotificationsApi.batches({ page: batchPage, page_size: pageSize })
      .then((page) => { if (active) setBatches(page); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [batchPage, refresh]);

  useEffect(() => {
    if (selectedId == null) return;
    let active = true;
    const load = async () => {
      try {
        const detail = await whatsappNotificationsApi.batch(selectedId);
        let page;
        if (!search) {
          page = await whatsappNotificationsApi.batchMessages(selectedId, { page: messagePage, page_size: pageSize, status });
        } else {
          const all = [];
          let nextPage = 1;
          let total = 0;
          do {
            const result = await whatsappNotificationsApi.batchMessages(selectedId, { page: nextPage, page_size: 100, status });
            if (!active) return;
            all.push(...result.items);
            total = result.total;
            nextPage += 1;
            if (!result.items.length) break;
          } while (all.length < total);
          const phoneQuery = compact(search);
          const found = all.filter((item) => item.recipient_name?.toLocaleLowerCase("sq").includes(search) || item.phone_number.includes(search) || (phoneQuery && compact(item.phone_number).includes(phoneQuery)));
          page = { items: found.slice((messagePage - 1) * pageSize, messagePage * pageSize), total: found.length };
        }
        if (active) { setBatch(detail); setMessages(page); }
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [selectedId, messagePage, status, search, refresh]);

  useEffect(() => {
    const request = window.setTimeout(() => setSearch(searchDraft.trim().toLocaleLowerCase("sq")), 250);
    return () => window.clearTimeout(request);
  }, [searchDraft]);

  useEffect(() => {
    if (!expanded) return;
    let active = true;
    whatsappNotificationsApi.messageEvents(expanded.id, { page: eventPage, page_size: pageSize })
      .then((page) => { if (active) setEvents(page); })
      .catch((requestError) => { if (active) setEventsError(requestError.message); });
    return () => { active = false; };
  }, [expanded, eventPage]);

  function selectBatch(id) {
    setLoading(true);
    setError("");
    setSelectedId(id);
    setBatch(null);
    setMessages(null);
    setMessagePage(1);
    setStatus("");
    setSearchDraft("");
    setSearch("");
    setExpanded(null);
  }

  function selectStatus(value) {
    if (status === value) return;
    setLoading(true);
    setError("");
    setMessages(null);
    setStatus(value);
    setMessagePage(1);
    setExpanded(null);
  }

  function toggleMessage(item) {
    setExpanded((current) => current?.id === item.id ? null : item);
    setEvents(null);
    setEventsError("");
    setEventPage(1);
  }

  return <section className="bt-wa-manager">
    <div className="bt-wa-toolbar"><div><h2>WhatsApp Manager</h2><p>Grupimet e dërgimeve dhe statuset e marrësve.</p></div><button type="button" className="bt-btn-secondary" onClick={() => { setLoading(true); setError(""); setRefresh((value) => value + 1); }} disabled={loading}><RefreshCw size={16} /> Rifresko</button></div>
    {error && <p className="bt-inline-error" role="alert">{error}</p>}
    {selectedId == null ? <>
      <h3>Grupimet {batches && <small>({batches.total})</small>}</h3>
      {loading && !batches && <p role="status">Duke ngarkuar grupimet…</p>}
      {batches && !batches.items.length && <p>Nuk ka ende dërgime të regjistruara.</p>}
      <div className="bt-wa-batches">{batches?.items.map((item) => <button type="button" key={item.id} onClick={() => selectBatch(item.id)}><span><strong>{batchNames[item.type] || item.template_name}</strong><small>Grupimi #{item.id} · {item.template_name}</small></span><Status value={item.status} /></button>)}</div>
      {batches && <Pager page={batchPage} total={batches.total} onChange={(page) => { setLoading(true); setBatches(null); setBatchPage(page); }} />}
    </> : <>
      <button type="button" className="bt-wa-back" onClick={() => setSelectedId(null)}><ArrowLeft size={17} /> Të gjitha grupimet</button>
      {batch && <>
        <div className="bt-wa-batch-heading"><div className="bt-wa-batch-title"><span className="bt-wa-batch-eyebrow">GRUPIMI #{batch.id}</span><h3>{batchNames[batch.type] || batch.template_name}</h3><div className="bt-wa-batch-tags"><span>Template <strong>{batch.template_name}</strong></span><span>Burimi <strong>{batch.source}</strong></span></div></div><Status value={batch.status} /><div className="bt-wa-batch-dates"><div><span>Nisur</span><strong>{dateTime(batch.started_at)}</strong></div><div><span>Përfunduar</span><strong>{dateTime(batch.finished_at)}</strong></div></div></div>
        <div className="bt-wa-dashboard" role="group" aria-label="Filtro marrësit sipas statusit">{filters.map((filter) => <button type="button" key={filter.key} className={`bt-wa-stat-card bt-wa-stat-${filter.key.toLowerCase() || "all"} ${status === filter.key ? "active" : ""}`} aria-pressed={status === filter.key} onClick={() => selectStatus(filter.key)}><span>{filter.label}</span><strong>{batch.statistics[filter.count] ?? 0}<small> / {batch.statistics.total}</small></strong></button>)}</div>
        {(batch.statistics.pending > 0 || batch.statistics.accepted > 0) && <p className="bt-wa-note">Në pritje: {batch.statistics.pending} · Pranuar nga WhatsApp: {batch.statistics.accepted}</p>}
      </>}
      <div className="bt-wa-list-heading"><h3>{status ? `${statusNames[status]} · marrësit` : "Të gjithë marrësit"} {messages && <small>({messages.total})</small>}</h3><label className="bt-wa-search"><Search size={18} aria-hidden="true" /><input type="search" value={searchDraft} onChange={(event) => { setSearchDraft(event.target.value); setLoading(true); setMessages(null); setMessagePage(1); setExpanded(null); }} placeholder="Kërko marrësin ose numrin…" aria-label="Kërko sipas marrësit ose numrit" /></label></div>
      {loading && !messages && <p role="status">Duke ngarkuar marrësit…</p>}
      {messages && !messages.items.length && <p className="bt-wa-empty">Nuk u gjet asnjë marrës.</p>}
      {!!messages?.items.length && <div className="bt-accounts-table-wrap bt-wa-table-wrap"><table className="bt-accounts-table bt-wa-table"><thead><tr><th>Marrësi</th><th>Numri</th><th>Statusi</th><th aria-label="Detajet" /></tr></thead><tbody>{messages.items.map((item) => <Fragment key={item.id}><tr className={expanded?.id === item.id ? "selected" : ""} tabIndex={0} role="button" aria-expanded={expanded?.id === item.id} aria-label={`Shiko detajet për ${item.recipient_name || item.phone_number}`} onClick={() => toggleMessage(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleMessage(item); } }}><td><strong>{item.recipient_name || "—"}</strong></td><td>{item.phone_number}</td><td><Status value={item.status} /></td><td><ChevronDown size={17} className={expanded?.id === item.id ? "expanded" : ""} /></td></tr>{expanded?.id === item.id && <tr className="bt-wa-table-detail-row"><td colSpan={4}><RecipientDetails item={item} events={events} eventsError={eventsError} eventPage={eventPage} onEventPage={(page) => { setEvents(null); setEventPage(page); }} /></td></tr>}</Fragment>)}</tbody></table></div>}
      {messages && <Pager page={messagePage} total={messages.total} onChange={(page) => { setLoading(true); setMessages(null); setExpanded(null); setMessagePage(page); }} />}
    </>}
  </section>;
}
