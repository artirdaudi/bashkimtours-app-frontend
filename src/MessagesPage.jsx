import { useState } from "react";
import { BellRing, CreditCard, FileText, IdCard, Search, Send } from "lucide-react";
import { authApi, whatsappNotificationsApi } from "./api";
import { API_BASE_URL } from "./auth";
import { Modal } from "./PortalPages";
import PaymentFollowupRulesPage from "./PaymentFollowupRulesPage";

const previewImages = import.meta.glob("./assets/message-previews/*.{png,jpg,jpeg,webp}", { eager: true, query: "?url", import: "default" });
const previewImage = (name) => [name, `${name}_preview`]
  .flatMap((base) => ["png", "jpg", "jpeg", "webp"].map((extension) => `./assets/message-previews/${base}.${extension}`))
  .map((path) => previewImages[path])
  .find(Boolean);

const messages = [
  { id: "monthly", name: "maarif_monthly_report", title: "Raporti mujor Maarif", icon: FileText, description: "Raporti mujor për Maarif.", preview: "Raporti mujor Maarif do të shfaqë përmbledhjen e muajit përkatës. Përmbajtja përfundimtare e template-it nuk është ende e disponueshme në API." },
  { id: "card", name: "card_notification", title: "Njoftimi i kartelës", icon: IdCard, description: "Njoftim në WhatsApp për kartelat.", preview: "Njoftim për kartelën e nxënësit. Të dhënat konkrete plotësohen nga sistemi gjatë dërgimit.", send: whatsappNotificationsApi.sendCard },
  { id: "payment", name: "payment_notification", title: "Njoftimi i pagesës", icon: CreditCard, description: "Njoftim në WhatsApp për pagesat.", preview: "Njoftim për pagesën e nxënësit. Të dhënat konkrete plotësohen nga sistemi gjatë dërgimit.", send: whatsappNotificationsApi.sendPayment },
];

function sendResult(item, result) {
  if (!result || typeof result !== "object") throw new Error("Serveri nuk ktheu rezultat të vlefshëm për dërgimin.");
  if (item.id === "card") {
    const { total_without_card: total, sent, failed } = result;
    if (![total, sent, failed].every((value) => Number.isInteger(value) && value >= 0)) throw new Error("Serveri nuk ktheu numrat e dërgimit për njoftimin e kartelës.");
    if (failed > 0) return { type: "error", text: `U dërguan ${sent} nga ${total} njoftime. ${failed} dështuan.` };
    if (sent === 0) return { type: "info", text: total === 0 ? "Nuk ka nxënës pa kartelë për t'u njoftuar." : `Asnjë njoftim nuk u dërgua nga ${total} të mundshme.` };
    return { type: "success", text: `U dërguan ${sent} njoftime nga ${total} nxënës pa kartelë.` };
  }
  const sent = result.notifications_sent;
  if (!Number.isInteger(sent) || sent < 0) throw new Error("Serveri nuk ktheu numrin e njoftimeve të pagesës.");
  return sent > 0
    ? { type: "success", text: `U dërguan ${sent} njoftime të pagesës.` }
    : { type: "info", text: "Asnjë njoftim i pagesës nuk u dërgua." };
}

export default function MessagesPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sendFeedback, setSendFeedback] = useState(null);
  const filteredMessages = messages.filter((item) => `${item.name} ${item.title} ${item.description}`.toLocaleLowerCase("sq").includes(search.trim().toLocaleLowerCase("sq")));

  async function send(event) {
    event.preventDefault();
    if (busy || !selected?.send || !password) return;
    setBusy(true);
    setError("");
    try {
      const user = await authApi.me();
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, password }),
      });
      if (!response.ok) throw new Error("Fjalëkalimi është i pasaktë ose verifikimi dështoi.");
      const result = await selected.send();
      const feedback = sendResult(selected, result);
      setConfirmOpen(false);
      setPassword("");
      setSendFeedback(feedback);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bt-page bt-messages-page">
      <header className="bt-page-header">
        <div>
          <span className="bt-eyebrow">Bashkim Tours</span>
          <h1>Mesazhet dhe Njoftimet</h1>
          <p>Mesazhet WhatsApp dhe automatizimet sipas shërbimit.</p>
        </div>
      </header>
      <nav className="bt-messages-service-tabs" aria-label="Shërbimet"><button type="button" className="active">Maarif</button></nav>
      <label className="bt-messages-search">
        <Search size={19} aria-hidden="true" />
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kërko mesazhe dhe template…" aria-label="Kërko mesazhe dhe template" />
      </label>
      <div className="bt-messages-list">
        {filteredMessages.map((item) => {
          const Icon = item.icon;
          return <button type="button" key={item.id} className={selected?.id === item.id ? "selected" : ""} onClick={() => { setSelected(item); setSendFeedback(null); setError(""); }}>
            <Icon size={22} /><span><strong>{item.title}</strong><small>{item.name}</small></span><em>Joaktiv</em>
          </button>;
        })}
      </div>
      {filteredMessages.length === 0 && <p className="bt-messages-empty">Nuk u gjet asnjë mesazh për këtë kërkim.</p>}
      {selected && <Modal title={selected.title} onClose={() => { if (!busy) { setSelected(null); setConfirmOpen(false); } }}><section className="bt-messages-detail">
        <div className="bt-messages-detail-heading"><div><h2>{selected.title}</h2><p>{selected.description}</p></div><span>Template joaktiv</span></div>
        <p>Ky template nuk është aktivizuar ende. {selected.send ? "API ofron dërgim manual." : "API nuk ofron ende dërgim manual ose planifikim për këtë template."}</p>
        <figure className="bt-messages-preview">
          {previewImage(selected.name) && <img src={previewImage(selected.name)} alt={`Shembull i mesazhit ${selected.name} në WhatsApp`} />}
          <figcaption>{selected.preview}</figcaption>
        </figure>
        <div className="bt-messages-actions">
          {selected.send && <button type="button" className="bt-btn-primary" disabled={busy} onClick={() => { setPassword(""); setError(""); setConfirmOpen(true); }}><Send size={17} /> {busy ? "Duke dërguar…" : "Dërgo manualisht"}</button>}
        </div>
        {sendFeedback && <p className={sendFeedback.type === "error" ? "bt-inline-error" : sendFeedback.type === "success" ? "bt-followup-rule-saved" : "bt-messages-info"} role="status">{sendFeedback.text}</p>}
        {selected.id === "payment" && <div className="bt-messages-schedule"><h3><BellRing size={19} /> Caktimi i ditës dhe automatizimi i pagesave</h3><PaymentFollowupRulesPage /></div>}
      </section></Modal>}
      {confirmOpen && selected && <Modal title={`Konfirmo dërgimin · ${selected.title}`} onClose={() => { if (!busy) setConfirmOpen(false); }}>
        <form className="bt-messages-confirm" onSubmit={send}>
          <p>Shkruani përsëri fjalëkalimin e përdoruesit tuaj për të konfirmuar dërgimin manual.</p>
          <label className="bt-field"><span>Fjalëkalimi</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required autoFocus /></label>
          {error && <p className="bt-inline-error" role="alert">{error}</p>}
          <button className="bt-btn-primary" disabled={busy || !password} aria-busy={busy}>{busy ? "Duke dërguar…" : "Konfirmo dhe dërgo"}</button>
        </form>
      </Modal>}
    </div>
  );
}
