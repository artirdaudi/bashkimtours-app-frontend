import { useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { documentTypesApi } from "./api";
import { Modal } from "./PortalPages";

export default function CharterAgendaDraft({ files, onChange }) {
  const [open, setOpen] = useState(false);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ typeId: "", files: [], comment: "" });
  async function add() {
    setOpen(true);
    setError("");
    setDraft({ typeId: "", files: [], comment: "" });
    setLoading(true);
    try { setTypes((await documentTypesApi.list()).filter((type) => type.is_active)); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }
  function stage(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!draft.files.length || !draft.typeId) return;
    onChange([...files, ...draft.files.map((file) => ({ typeId: draft.typeId, file, comment: draft.comment, typeName: types.find((type) => String(type.id) === draft.typeId)?.name || "Dokument" }))]);
    setOpen(false);
  }
  return <div className="bt-charter-agenda-draft">
    {files.length > 0 && <ul>{files.map((item, index) => <li key={`${item.file.name}-${index}`}><FileText size={17} /><span><strong>{item.typeName}</strong> · {item.file.name}</span><button type="button" aria-label={`Hiq ${item.file.name}`} onClick={() => onChange(files.filter((_, position) => position !== index))}><Trash2 size={17} /></button></li>)}</ul>}
    <button type="button" className="bt-btn-secondary bt-btn-small" onClick={add}><Plus size={15} /> Shto dokumente</button>
    {open && <Modal title="Shto dokumente · Agjenda" className="bt-document-upload-modal" onClose={() => setOpen(false)}><form className="bt-role-form" onSubmit={stage}><label>Lloji i dokumentit<select required disabled={loading} value={draft.typeId} onChange={(event) => setDraft({ ...draft, typeId: event.target.value })}><option value="">Zgjidh llojin</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label><label>Skedarët<input type="file" multiple required onChange={(event) => setDraft({ ...draft, files: Array.from(event.target.files || []) })} /></label>{draft.files.length > 0 && <ul className="bt-charter-selected-files">{draft.files.map((file, index) => <li key={`${file.name}-${index}`}>{file.name} · {(file.size / 1024).toLocaleString("sq-AL", { maximumFractionDigits: 0 })} KB</li>)}</ul>}<label>Koment<textarea rows={3} value={draft.comment} onChange={(event) => setDraft({ ...draft, comment: event.target.value })} /></label>{error && <p className="bt-inline-error" role="alert">{error}</p>}<div className="bt-modal-actions"><button className="bt-btn-primary" disabled={loading || !types.length}>{loading ? "Duke ngarkuar llojet…" : "Shto në rezervim"}</button></div></form></Modal>}
  </div>;
}
