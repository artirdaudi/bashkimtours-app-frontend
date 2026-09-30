import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { whatsappNotificationsApi } from "./api";

const statusNames = { PENDING: "Në pritje", ACCEPTED: "Pranuar", SENT: "Dërguar", DELIVERED: "Dorëzuar", READ: "Lexuar", FAILED: "Dështuar", RUNNING: "Në proces", COMPLETED: "Përfunduar", PARTIAL: "Pjesërisht" };
const messageStatusNames = Object.fromEntries(Object.entries(statusNames).filter(([key]) => !["RUNNING", "COMPLETED", "PARTIAL"].includes(key)));
const batchNames = { MONTHLY_REPORT: "Raporti mujor Maarif", CARD_COLLECTION_DEADLINE: "Njoftimi i kartelës", PAYMENT_NOTIFICATION: "Njoftimi i pagesës", TEST_MESSAGE: "Mesazh testues" };
const dateTime = (value) => value ? new Date(value).toLocaleString("sq-AL") : "—";
const pageSize = 20;

function Status({ value }) {
  return <span className={`bt-wa-status bt-wa-status-${value?.toLowerCase() || "unknown"}`}>{statusNames[value] || value || "—"}</span>;
}

function Pager({ page, total, onChange }) {
  if (total <= pageSize) return null;
  return <div className="bt-wa-pager"><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>Mbrapa</button><span>Faqja {page} nga {Math.ceil(total / pageSize)}</span><button type="button" disabled={page * pageSize >= total} onClick={() => onChange(page + 1)}>Përpara</button></div>;
}

export default function WhatsAppManager() {
  const [batches, setBatches] = useState(null);
  const [batchPage, setBatchPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [batch, setBatch] = useState(null);
  const [messages, setMessages] = useState(null);
  const [messagePage, setMessagePage] = useState(1);
  const [status, setStatus] = useState("");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [events, setEvents] = useState(null);
  const [eventPage, setEventPage] = useState(1);
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
    Promise.all([
      whatsappNotificationsApi.batch(selectedId),
      whatsappNotificationsApi.batchMessages(selectedId, { page: messagePage, page_size: pageSize, status }),
    ]).then(([detail, page]) => { if (active) { setBatch(detail); setMessages(page); } })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedId, messagePage, status, refresh]);

  useEffect(() => {
    if (!selectedMessage) return;
    let active = true;
    whatsappNotificationsApi.messageEvents(selectedMessage.id, { page: eventPage, page_size: pageSize })
      .then((page) => { if (active) setEvents(page); })
      .catch((requestError) => { if (active) { setError(requestError.message); setEvents({ items: [], total: 0 }); } });
    return () => { active = false; };
  }, [selectedMessage, eventPage, refresh]);

  function selectBatch(id) {
    setLoading(true);
    setError("");
    setSelectedId(id);
    setBatch(null);
    setMessages(null);
    setMessagePage(1);
    setStatus("");
    setSelectedMessage(null);
  }

  return <section className="bt-wa-manager">
    <div className="bt-wa-toolbar"><div><h2>WhatsApp Manager</h2><p>Grupimet e dërgimeve dhe statuset e marrësve.</p></div><button type="button" className="bt-btn-secondary" onClick={() => { setLoading(true); setError(""); setRefresh((value) => value + 1); }} disabled={loading}><RefreshCw size={16} /> Rifresko</button></div>
    {error && <p className="bt-inline-error" role="alert">{error}</p>}
    {selectedId == null ? <>
      <h3>Grupimet {batches && <small>({batches.total})</small>}</h3>
      {loading && !batches && <p role="status">Duke ngarkuar grupimet…</p>}
      {batches && !batches.items.length && <p>Nuk ka ende dërgime të regjistruara.</p>}
      <div className="bt-wa-batches">{batches?.items.map((item) => <button type="button" key={item.id} onClick={() => selectBatch(item.id)}><span><strong>{batchNames[item.type] || item.template_name}</strong><small>#{item.id} · {item.template_name} · {item.source}</small></span><span><Status value={item.status} /><small>{dateTime(item.started_at)}</small></span></button>)}</div>
      {batches && <Pager page={batchPage} total={batches.total} onChange={(page) => { setLoading(true); setBatchPage(page); }} />}
    </> : <>
      <button type="button" className="bt-wa-back" onClick={() => { setSelectedId(null); setSelectedMessage(null); }}><ArrowLeft size={17} /> Të gjitha grupimet</button>
      {batch && <><div className="bt-wa-batch-heading"><div><h3>{batchNames[batch.type] || batch.template_name} <small>#{batch.id}</small></h3><p>{batch.template_name} · {batch.source} · Nisur më {dateTime(batch.started_at)} · Përfunduar më {dateTime(batch.finished_at)}</p></div><Status value={batch.status} /></div>
        <div className="bt-wa-dashboard bt-wa-batch-stats">{[["total", "Gjithsej"], ["sent", "Dërguar"], ["failed", "Dështuar"], ["delivered", "Dorëzuar"], ["read", "Lexuar"]].map(([key, label]) => <div key={key}><span>{label}</span><strong>{batch.statistics[key]}</strong></div>)}</div>
        <p className="bt-wa-note">Në pritje: {batch.statistics.pending}; pranuar: {batch.statistics.accepted}. Numrat tregojnë statusin aktual të marrësve të këtij grupimi.</p>
      </>}
      <div className="bt-wa-list-heading"><h3>Marrësit {messages && <small>({messages.total})</small>}</h3><label>Statusi <select value={status} onChange={(event) => { setLoading(true); setMessages(null); setStatus(event.target.value); setMessagePage(1); setSelectedMessage(null); }}><option value="">Të gjitha</option>{Object.entries(messageStatusNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      {loading && !messages && <p role="status">Duke ngarkuar marrësit…</p>}
      {messages && !messages.items.length && <p>Nuk ka marrës për këtë status.</p>}
      {!!messages?.items.length && <div className="bt-accounts-table-wrap"><table className="bt-accounts-table bt-wa-table"><thead><tr><th>Marrësi</th><th>Numri</th><th>Statusi</th><th>Pranuar</th><th>Dërguar</th><th>Dorëzuar</th><th>Lexuar</th><th>Gabimi</th></tr></thead><tbody>{messages.items.map((item) => <tr key={item.id} className={selectedMessage?.id === item.id ? "selected" : ""} tabIndex={0} role="button" aria-label={`Shiko historinë për ${item.recipient_name || item.phone_number}`} onClick={() => { setSelectedMessage(item); setEvents(null); setEventPage(1); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedMessage(item); setEvents(null); setEventPage(1); } }}><td>{item.recipient_name || "—"}</td><td>{item.phone_number}</td><td><Status value={item.status} /></td><td>{dateTime(item.accepted_at)}</td><td>{dateTime(item.sent_at)}</td><td>{dateTime(item.delivered_at)}</td><td>{dateTime(item.read_at)}</td><td>{item.error_title || item.error_message || "—"}</td></tr>)}</tbody></table></div>}
      {messages && <Pager page={messagePage} total={messages.total} onChange={(page) => { setLoading(true); setMessages(null); setMessagePage(page); }} />}
      {selectedMessage && <section className="bt-wa-message-detail"><h3>{selectedMessage.recipient_name || selectedMessage.phone_number} · Historia e statusit</h3><p>Numri: {selectedMessage.phone_number} · Meta ID: {selectedMessage.meta_message_id || "—"}</p>{selectedMessage.error_message && <p className="bt-inline-error">{selectedMessage.error_code ? `${selectedMessage.error_code}: ` : ""}{selectedMessage.error_message} {selectedMessage.error_details}</p>}{events?.items.length ? <ul>{events.items.map((event) => <li key={event.id}><Status value={event.status} /> <time>{dateTime(event.meta_timestamp)}</time>{event.error_message && <span>{event.error_message}</span>}</li>)}</ul> : <p>{events ? "Nuk ka ngjarje të regjistruara." : "Duke ngarkuar historinë…"}</p>}{events && <Pager page={eventPage} total={events.total} onChange={setEventPage} />}</section>}
    </>}
  </section>;
}
