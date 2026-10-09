import { useState } from "react";
import { Bus, CircleHelp, LoaderCircle, Send, UsersRound } from "lucide-react";
import { whatsappNotificationsApi } from "./api";
import { Modal } from "./PortalPages";
import previewImage from "./assets/message-previews/charter_driver_assignment.png";

export default function CharterWhatsAppModal({ charter, onClose }) {
  const assignments = charter.assignments || [];
  const [sendingId, setSendingId] = useState(null);
  const [results, setResults] = useState({});
  const [showPreview, setShowPreview] = useState(false);

  async function send(assignment) {
    if (sendingId != null) return;
    setSendingId(assignment.id);
    setResults((current) => ({ ...current, [assignment.id]: null }));
    try {
      const response = await whatsappNotificationsApi.sendCharterDriverAssignment(assignment.id);
      const failed = Number(response?.failed || 0) > 0 || response?.success === false || response?.status === "failed";
      setResults((current) => ({ ...current, [assignment.id]: failed
        ? { type: "error", text: "Njoftimi nuk u dërgua. Ju lutemi provoni përsëri." }
        : { type: "success", text: "Njoftimi i udhëtimit u dërgua me sukses." } }));
    } catch (error) {
      setResults((current) => ({ ...current, [assignment.id]: { type: "error", text: `Dërgimi dështoi: ${error.message}` } }));
    } finally {
      setSendingId(null);
    }
  }

  return <Modal title={`WhatsApp Messages · ${charter.contractor || `Charter ${charter.id}`}`} className="bt-charter-whatsapp-modal" onClose={() => { if (sendingId == null) onClose(); }}>
    <div className="bt-charter-whatsapp-heading"><p>Dërgo njoftimin e udhëtimit veçmas për secilin shofer të caktuar.</p><button type="button" className="bt-charter-whatsapp-help" aria-label="Shiko shembullin e mesazhit" title="Shiko shembullin e mesazhit" onClick={() => setShowPreview((value) => !value)}><CircleHelp size={20} /></button></div>
    {showPreview && <figure className="bt-charter-whatsapp-preview"><img src={previewImage} alt="Shembull i njoftimit të udhëtimit për shoferin në WhatsApp" /><figcaption>Shembull i mesazhit që i dërgohet shoferit.</figcaption></figure>}
    {!assignments.length && <p className="bt-charter-whatsapp-state">Nuk ka autobusë të caktuar për këtë udhëtim.</p>}
    {!!assignments.length && <div className="bt-charter-whatsapp-buses">{assignments.map((busAssignment) => {
      const bus = busAssignment.bus;
      return <section className="bt-charter-whatsapp-bus" key={busAssignment.id}><h3><Bus size={19} /> {bus?.targa || `Autobusi #${busAssignment.bus_id}`}</h3>
        {!busAssignment.drivers?.length ? <p>Pa shoferë të caktuar.</p> : busAssignment.drivers.map((assignment) => {
          const driver = assignment.driver;
          const sending = sendingId === assignment.id;
          const result = results[assignment.id];
          return <div className="bt-charter-whatsapp-driver" key={assignment.id}><div><strong><UsersRound size={17} /> {driver?.emri || `Shoferi #${assignment.driver_id}`}</strong>{result && <p className={result.type === "success" ? "bt-charter-whatsapp-success" : "bt-inline-error"} role="status">{result.text}</p>}{sending && <p className="bt-charter-whatsapp-progress" role="status"><LoaderCircle className="bt-spin" size={16} /> Duke dërguar njoftimin…</p>}</div><button type="button" className="bt-btn-primary" disabled={sendingId != null} aria-busy={sending} onClick={() => send(assignment)}><Send size={16} /> {sending ? "Duke dërguar…" : "Dërgo njoftimin e udhëtimit"}</button></div>;
        })}
      </section>;
    })}</div>}
  </Modal>;
}
