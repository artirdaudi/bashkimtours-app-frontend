import { useEffect, useRef, useState } from "react";
import { Bus, Eye, FileText, LoaderCircle, Printer, UsersRound } from "lucide-react";
import { patenNalogsApi } from "./api";
import { Modal } from "./PortalPages";

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

async function loadNalogs(charterId) {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await patenNalogsApi.list({ charter_id: charterId, limit: 1000, offset });
    all.push(...page);
    if (page.length < 1000) return all;
  }
}

export default function CharterPatenNalogModal({ charter, onClose }) {
  const assignments = charter.assignments || [];
  const [nalogs, setNalogs] = useState([]);
  const [loading, setLoading] = useState(assignments.length > 0);
  const [busy, setBusy] = useState(false);
  const [loadingPdfId, setLoadingPdfId] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pdfReady, setPdfReady] = useState(false);
  const frameRef = useRef(null);
  const nalogsRequestRef = useRef(null);

  useEffect(() => {
    if (!assignments.length) return;
    let active = true;
    if (nalogsRequestRef.current?.charterId !== charter.id) {
      nalogsRequestRef.current = { charterId: charter.id, promise: loadNalogs(charter.id) };
    }
    nalogsRequestRef.current.promise
      .then((existing) => { if (active) setNalogs(existing); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [charter.id, assignments.length]);
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);

  async function create(event) {
    event.preventDefault();
    if (!creating || busy || !creating.drivers?.length) return;
    setBusy(true);
    setError("");
    try {
      const created = await patenNalogsApi.create(creating.id, { issue_date: today(), issue_place: "Tetovo" });
      setNalogs((current) => [...current.filter((item) => item.charter_bus_assignment_id !== creating.id), created]);
      setCreating(null);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function showPdf(nalog) {
    if (busy) return;
    setBusy(true);
    setLoadingPdfId(nalog.id);
    setError("");
    try {
      const blob = await patenNalogsApi.pdf(nalog.id);
      if (!blob.size || !(await blob.slice(0, 1024).text()).includes("%PDF-")) {
        throw new Error("Serveri nuk ktheu një dokument PDF të vlefshëm.");
      }
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      setPdfReady(false);
      setPreview({ url, serial: nalog.serial_number });
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); setLoadingPdfId(null); }
  }

  const close = () => { if (!busy) onClose(); };
  return <Modal title={`Paten Nalog · ${charter.contractor || `Charter ${charter.id}`}`} className="bt-paten-nalog-modal" onClose={close}>
    {preview ? <div className="bt-paten-preview"><div className="bt-paten-preview-actions"><strong>Paten Nalog #{preview.serial}</strong><div><button type="button" className="bt-btn-secondary" onClick={() => setPreview(null)}>Kthehu te autobusët</button><a className="bt-btn-secondary" href={preview.url} target="_blank" rel="noopener noreferrer">Hap PDF</a><button type="button" className="bt-btn-primary" disabled={!pdfReady} onClick={() => frameRef.current?.contentWindow?.print()}><Printer size={16} /> Printo PDF</button></div></div>{!pdfReady && <p role="status"><LoaderCircle size={16} className="bt-spin" /> Duke shfaqur PDF…</p>}<iframe ref={frameRef} title={`Paten Nalog ${preview.serial}`} src={preview.url} onLoad={() => setPdfReady(true)} onError={() => setError("PDF-ja nuk mund të shfaqet në këtë shfletues. Përdor butonin Hap PDF.")} /></div> : <div className="bt-paten-list">
      <p className="bt-paten-intro">Paten Nalogu krijohet veçmas për çdo autobus që ka të paktën një shofer të caktuar.</p>
      {loading && <p role="status"><LoaderCircle size={16} className="bt-spin" /> Duke ngarkuar caktimet…</p>}
      {!loading && !assignments.length && !error && <div className="bt-paten-empty"><p>Nuk ka autobusë të caktuar për këtë charter.</p><button type="button" className="bt-btn-primary" disabled>Krijo Paten Nalog</button></div>}
      {!loading && assignments.map((assignment) => {
        const bus = assignment.bus;
        const nalog = nalogs.find((item) => String(item.charter_bus_assignment_id) === String(assignment.id));
        const names = assignment.drivers?.map((entry) => entry.driver?.emri || `Shoferi #${entry.driver_id}`) || [];
        return <section className="bt-paten-bus" key={assignment.id}><div className="bt-paten-bus-main"><strong><Bus size={18} /> {bus?.targa || `Autobusi #${assignment.bus_id}`}</strong><span><UsersRound size={16} /> {names.length ? names.join(", ") : "Nuk ka shoferë të caktuar"}</span></div><div className="bt-paten-bus-action">{nalog ? <><span className="bt-paten-serial"><FileText size={16} /> Nr. serik: <strong>{nalog.serial_number}</strong></span><button type="button" className="bt-btn-secondary" disabled={busy} aria-busy={loadingPdfId === nalog.id} onClick={() => showPdf(nalog)} aria-label={`${loadingPdfId === nalog.id ? "Duke hapur" : "Shiko"} PDF për Paten Nalog ${nalog.serial_number}`}>{loadingPdfId === nalog.id ? <LoaderCircle size={16} className="bt-spin" /> : <Eye size={16} />} {loadingPdfId === nalog.id ? "Duke hapur PDF…" : "Shiko PDF"}</button></> : <button type="button" className="bt-btn-primary" disabled={!names.length || busy} onClick={() => { setCreating(assignment); setError(""); }}>Krijo Paten Nalog</button>}</div></section>;
      })}
      {creating && <form className="bt-paten-create" onSubmit={create}><h3>Krijo Paten Nalog për {creating.bus?.targa || `autobusin #${creating.bus_id}`}</h3><div><button type="button" className="bt-btn-secondary" disabled={busy} onClick={() => setCreating(null)}>Anulo</button><button type="submit" className="bt-btn-primary" disabled={busy}>{busy ? "Duke krijuar…" : "Krijo Paten Nalog"}</button></div></form>}
    </div>}
    {error && <p className="bt-inline-error" role="alert">{error}</p>}
  </Modal>;
}
