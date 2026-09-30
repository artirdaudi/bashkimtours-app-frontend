import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { whatsappNotificationsApi } from "./api";

const pageSize = 20;
const statusNames = { PENDING: "Në pritje", ACCEPTED: "Pranuar", SENT: "SENT", DELIVERED: "DELIVERED", READ: "READ", FAILED: "FAILED", RUNNING: "Në proces", COMPLETED: "Përfunduar", PARTIAL: "Pjesërisht" };
const batchNames = { MONTHLY_REPORT: "Raporti mujor Maarif", CARD_COLLECTION_DEADLINE: "Njoftimi i kartelës", PAYMENT_NOTIFICATION: "Njoftimi i pagesës", TEST_MESSAGE: "Mesazh testues" };
const filters = [
  { key: "", label: "Të gjithë", count: "total" },
  { key: "SENT", label: "SENT", count: "sent" },
  { key: "DELIVERED", label: "DELIVERED", count: "delivered" },
  { key: "READ", label: "READ", count: "read" },
  { key: "FAILED", label: "FAILED", count: "failed" },
];

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

export default function WhatsAppManager() {
  const [batches, setBatches] = useState(null);
  const [batchPage, setBatchPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [batch, setBatch] = useState(null);
  const [messages, setMessages] = useState(null);
  const [messagePage, setMessagePage] = useState(1);
  const [status, setStatus] = useState("");
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

  function selectBatch(id) {
    setLoading(true);
    setError("");
    setSelectedId(id);
    setBatch(null);
    setMessages(null);
    setMessagePage(1);
    setStatus("");
  }

  function selectStatus(value) {
    if (status === value) return;
    setLoading(true);
    setError("");
    setMessages(null);
    setStatus(value);
    setMessagePage(1);
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
        <div className="bt-wa-batch-heading"><div><h3>{batchNames[batch.type] || batch.template_name} <small>#{batch.id}</small></h3><p>Template: {batch.template_name}</p></div><Status value={batch.status} /></div>
        <div className="bt-wa-dashboard" role="group" aria-label="Filtro marrësit sipas statusit">{filters.map((filter) => <button type="button" key={filter.key} className={`bt-wa-stat-card bt-wa-stat-${filter.key.toLowerCase() || "all"} ${status === filter.key ? "active" : ""}`} aria-pressed={status === filter.key} onClick={() => selectStatus(filter.key)}><span>{filter.label}</span><strong>{batch.statistics[filter.count] ?? 0}<small> / {batch.statistics.total}</small></strong></button>)}</div>
        {(batch.statistics.pending > 0 || batch.statistics.accepted > 0) && <p className="bt-wa-note">Në pritje: {batch.statistics.pending} · Pranuar nga WhatsApp: {batch.statistics.accepted}</p>}
      </>}
      <div className="bt-wa-list-heading"><h3>{status ? `${statusNames[status]} · marrësit` : "Të gjithë marrësit"} {messages && <small>({messages.total})</small>}</h3></div>
      {loading && !messages && <p role="status">Duke ngarkuar marrësit…</p>}
      {messages && !messages.items.length && <p className="bt-wa-empty">Nuk ka marrës në këtë grup.</p>}
      <div className="bt-wa-recipients">{messages?.items.map((item) => <article className={`bt-wa-recipient ${item.status === "FAILED" ? "failed" : ""}`} key={item.id}><div className="bt-wa-recipient-main"><div><strong>{item.recipient_name || item.phone_number}</strong>{item.recipient_name && <span>{item.phone_number}</span>}</div><Status value={item.status} /></div>{item.status === "FAILED" && <FailureDetails message={item} />}</article>)}</div>
      {messages && <Pager page={messagePage} total={messages.total} onChange={(page) => { setLoading(true); setMessages(null); setMessagePage(page); }} />}
    </>}
  </section>;
}
