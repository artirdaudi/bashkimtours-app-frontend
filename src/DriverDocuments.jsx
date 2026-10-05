import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, FileText, LoaderCircle, Plus, RotateCcw, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { documentTypesApi, documentsApi } from "./api";
import { confirmAction } from "./confirmAction";
import { Modal } from "./PortalPages";
import { DOCUMENT_ENTITY_TYPES } from "./documentEntityTypes";

const imageTypes = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };

function previewBlob(blob, filename) {
  const extension = filename.split(".").pop()?.toLowerCase();
  const mime = extension === "pdf" ? "application/pdf" : imageTypes[extension] || blob.type;
  return new Blob([blob], { type: mime });
}

function UploadPreview({ file }) {
  const previewRef = useRef(null);
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  useEffect(() => {
    if (!previewRef.current) return undefined;
    const url = URL.createObjectURL(file);
    previewRef.current.src = isPdf ? `${url}#toolbar=0` : url;
    return () => URL.revokeObjectURL(url);
  }, [file, isPdf]);
  return <div className="bt-document-upload-preview"><strong>Pamje paraprake</strong><span>{file.name} · {(file.size / 1024).toLocaleString("sq-AL", { maximumFractionDigits: 0 })} KB</span>{isImage ? <img ref={previewRef} alt={`Pamje paraprake e ${file.name}`} /> : isPdf ? <iframe ref={previewRef} title={`Pamje paraprake e ${file.name}`} /> : <p>Ky format nuk ka pamje paraprake.</p>}</div>;
}

function openBlob(blob, filename, download = false) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  if (download) link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export default function DriverDocuments({ driver, defer = false, documents, loadDocuments, entityType = DOCUMENT_ENTITY_TYPES.SHOFER_STAFF, addLabel = "Shto dokumente", multiple = false, readOnly = false }) {
  const rootRef = useRef(null);
  const [visible, setVisible] = useState(!defer);
  const [types, setTypes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const loading = documents === undefined && !error;
  const [form, setForm] = useState(null);
  const [typeQuery, setTypeQuery] = useState("");
  const [typeListOpen, setTypeListOpen] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [operation, setOperation] = useState(null);
  const locked = busy || operation !== null;

  useEffect(() => {
    if (!viewer?.url) return undefined;
    const url = viewer.url;
    return () => { window.setTimeout(() => URL.revokeObjectURL(url), 60000); };
  }, [viewer?.url]);

  useEffect(() => {
    if (!defer || visible) return undefined;
    const node = rootRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); });
    observer.observe(node);
    return () => observer.disconnect();
  }, [defer, visible]);

  useEffect(() => {
    if (!visible || !loading) return undefined;
    let active = true;
    loadDocuments(driver.id)
      .then(() => { if (active) setError(""); })
      .catch((requestError) => { if (active) setError(requestError.message); })
    return () => { active = false; };
  }, [driver.id, visible, loading, loadDocuments]);

  async function addDocument() {
    if (locked) return;
    setError("");
    setTypeQuery("");
    setTypeListOpen(false);
    setForm({ documentTypeId: "", files: [], comment: "" });
    setOperation({ kind: "types" });
    try { setTypes((await documentTypesApi.list()).filter((type) => type.is_active)); }
    catch (requestError) { setError(requestError.message); }
    finally { setOperation(null); }
  }

  async function upload(event) {
    event.preventDefault();
    event.stopPropagation();
    if (locked || !form.files.length || !form.documentTypeId) return;
    setBusy(true);
    setOperation({ kind: "upload" });
    setError("");
    try {
      for (const file of form.files) {
        const body = new FormData();
        body.append("document_type_id", form.documentTypeId);
        body.append("entity_type", entityType);
        body.append("entity_id", String(driver.id));
        body.append("file", file);
        if (form.comment.trim()) body.append("comment", form.comment.trim());
        await documentsApi.upload(body);
        setForm((current) => ({ ...current, files: current.files.filter((pending) => pending !== file) }));
      }
      await loadDocuments(driver.id, true);
      setForm(null);
    } catch (requestError) {
      setError(requestError.message);
      await loadDocuments(driver.id, true).catch(() => {});
    }
    finally { setBusy(false); setOperation(null); }
  }

  async function remove(item) {
    if (locked || !await confirmAction(`Të fshihet dokumenti “${item.original_filename}”?`)) return;
    setBusy(true);
    setOperation({ kind: "remove", id: item.id });
    setError("");
    try {
      await documentsApi.remove(item.id);
      await loadDocuments(driver.id, true);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); setOperation(null); }
  }

  async function openDocument(item, download) {
    if (locked) return;
    setError("");
    const extension = item.original_filename.split(".").pop()?.toLowerCase();
    const canPreview = extension === "pdf" || Boolean(imageTypes[extension]);
    const shouldDownload = download || !canPreview;
    setOperation({ kind: shouldDownload ? "download" : "view", id: item.id });
    try {
      const blob = await (shouldDownload ? documentsApi.download(item.id) : documentsApi.view(item.id));
      if (shouldDownload) { openBlob(blob, item.original_filename, true); return; }
      const preview = previewBlob(blob, item.original_filename);
      const kind = preview.type === "application/pdf" ? "pdf" : "image";
      setViewer({ item, url: URL.createObjectURL(preview), kind });
      setZoom(1);
    } catch (requestError) { setError(requestError.message); }
    finally { setOperation(null); }
  }

  function closeViewer() {
    setViewer(null);
  }

  const matchingTypes = types.filter((type) => type.name.toLocaleLowerCase("sq").includes(typeQuery.trim().toLocaleLowerCase("sq")));
  function chooseType(type) {
    setForm((current) => ({ ...current, documentTypeId: String(type.id) }));
    setTypeQuery(type.name);
    setTypeListOpen(false);
  }

  return <div ref={rootRef} className="bt-driver-documents">
    {loading && <span role="status">Duke ngarkuar…</span>}
    {operation && <span className="bt-document-operation-status" role="status">{operation.kind === "view" ? "Duke hapur dokumentin…" : operation.kind === "download" ? "Duke shkarkuar dokumentin…" : operation.kind === "remove" ? "Duke fshirë dokumentin…" : operation.kind === "types" ? "Duke ngarkuar llojet e dokumenteve…" : "Duke ngarkuar dokumentin…"}</span>}
    {!loading && !documents?.length && !error && <span>Pa dokumente</span>}
    {!!documents?.length && <ul>{documents.map((item) => <li key={item.id}>
      <div><FileText size={16} aria-hidden="true" /><button type="button" className="bt-driver-document-link" disabled={locked} onClick={() => openDocument(item, false)}>{(operation?.kind === "view" || operation?.kind === "download") && operation.id === item.id && <LoaderCircle size={15} className="bt-document-spinner" aria-hidden="true" />}{item.document_type?.name || "Dokument"} · {item.original_filename}</button></div>
      {item.comment && <small>{item.comment}</small>}
      <div className="bt-driver-document-actions">
        <button type="button" title="Shkarko dokumentin" aria-label={`Shkarko ${item.original_filename}`} disabled={locked} onClick={() => openDocument(item, true)}>{operation?.kind === "download" && operation.id === item.id ? <LoaderCircle size={16} className="bt-document-spinner" /> : <Download size={16} />}</button>
        {!readOnly && <button type="button" title="Fshi dokumentin" aria-label={`Fshi ${item.original_filename}`} disabled={locked} onClick={() => remove(item)}>{operation?.kind === "remove" && operation.id === item.id ? <LoaderCircle size={16} className="bt-document-spinner" /> : <Trash2 size={16} />}</button>}
      </div>
    </li>)}</ul>}
    {error && !form && <p className="bt-inline-error" role="alert">{error}</p>}
    {!readOnly && <button type="button" className="bt-btn-secondary bt-btn-small" disabled={locked} onClick={addDocument}>{operation?.kind === "types" ? <LoaderCircle size={15} className="bt-document-spinner" /> : <Plus size={15} />} {addLabel}</button>}
    {viewer && <Modal title={viewer.item.original_filename} className="bt-document-viewer-modal" onClose={() => { if (!locked) closeViewer(); }}><div className="bt-document-viewer">
      <div className="bt-document-viewer-toolbar">
        {viewer.kind === "image" && <div className="bt-document-zoom"><button type="button" title="Zvogëlo" aria-label="Zvogëlo" disabled={zoom <= .5} onClick={() => setZoom((value) => Math.max(.5, +(value - .25).toFixed(2)))}><ZoomOut size={18} /></button><span>{Math.round(zoom * 100)}%</span><button type="button" title="Zmadho" aria-label="Zmadho" disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, +(value + .25).toFixed(2)))}><ZoomIn size={18} /></button><button type="button" title="Madhësia fillestare" aria-label="Madhësia fillestare" onClick={() => setZoom(1)}><RotateCcw size={17} /></button></div>}
        <div className="bt-document-viewer-actions"><a href={viewer.url} target="_blank" rel="noopener noreferrer" title="Hap në skedë të re"><ExternalLink size={17} /> Hap veçmas</a><button type="button" disabled={locked} onClick={() => openDocument(viewer.item, true)}>{operation?.kind === "download" ? <LoaderCircle size={17} className="bt-document-spinner" /> : <Download size={17} />} {operation?.kind === "download" ? "Duke shkarkuar…" : "Shkarko"}</button></div>
      </div>
      <div className="bt-document-viewer-content">{viewer.kind === "pdf" ? <iframe title={viewer.item.original_filename} src={`${viewer.url}#toolbar=1`} /> : <img src={viewer.url} alt={viewer.item.original_filename} style={{ width: `${zoom * 100}%` }} />}</div>
    </div></Modal>}
    {form && <Modal title={`Shto dokument · ${driver.emri}`} className="bt-document-upload-modal" onClose={() => { if (!locked) setForm(null); }}><form className="bt-role-form" onSubmit={upload}>
      <div className="bt-driver-type-field" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setTypeListOpen(false); }}>
        <label htmlFor={`bt-driver-type-${driver.id}`}>Lloji i dokumentit</label>
        <input id={`bt-driver-type-${driver.id}`} type="text" role="combobox" aria-autocomplete="list" aria-expanded={typeListOpen} aria-controls={`bt-driver-type-list-${driver.id}`} placeholder="Kërko llojin e dokumentit…" autoComplete="off" disabled={locked} value={typeQuery} onFocus={() => setTypeListOpen(true)} onChange={(event) => { setTypeQuery(event.target.value); setForm({ ...form, documentTypeId: "" }); setTypeListOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setTypeListOpen(false); if (event.key === "ArrowDown") { event.preventDefault(); event.currentTarget.nextElementSibling?.querySelector("button")?.focus(); } if (event.key === "Enter" && typeListOpen && matchingTypes.length) { event.preventDefault(); chooseType(matchingTypes[0]); } }} />
        {typeListOpen && <div id={`bt-driver-type-list-${driver.id}`} className="bt-driver-type-list" role="listbox">{matchingTypes.length ? matchingTypes.map((type) => <button key={type.id} type="button" role="option" aria-selected={String(type.id) === String(form.documentTypeId)} onPointerDown={(event) => { event.preventDefault(); chooseType(type); }} onClick={() => chooseType(type)} onKeyDown={(event) => { if (event.key === "ArrowDown" && event.currentTarget.nextElementSibling) { event.preventDefault(); event.currentTarget.nextElementSibling.focus(); } if (event.key === "ArrowUp") { event.preventDefault(); (event.currentTarget.previousElementSibling || event.currentTarget.parentElement.previousElementSibling)?.focus(); } if (event.key === "Escape") { setTypeListOpen(false); document.getElementById(`bt-driver-type-${driver.id}`)?.focus(); } }}>{type.name}</button>) : <span>Nuk u gjet asnjë lloj dokumenti.</span>}</div>}
      </div>
      <label>{multiple ? "Skedarët" : "Skedari"}<input type="file" multiple={multiple} required disabled={locked} onChange={(event) => setForm({ ...form, files: Array.from(event.target.files || []) })} /></label>
      {form.files.map((file, index) => <UploadPreview key={`${file.name}-${index}`} file={file} />)}
      <label>Koment<textarea rows={3} disabled={locked} value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} /></label>
      {error && <p className="bt-inline-error" role="alert">{error}</p>}
      <div className="bt-modal-actions"><button type="submit" className="bt-btn-primary" disabled={locked || !types.length}>{operation?.kind === "upload" && <LoaderCircle size={16} className="bt-document-spinner" />}{operation?.kind === "upload" ? "Duke ngarkuar…" : operation?.kind === "types" ? "Duke ngarkuar llojet…" : "Ngarko dokumentin"}</button></div>
    </form></Modal>}
  </div>;
}
