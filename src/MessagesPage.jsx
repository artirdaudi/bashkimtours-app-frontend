import { useEffect, useState } from "react";
import { BellRing, CreditCard, FileText, IdCard, Search, Send, ChartNoAxesCombined } from "lucide-react";
import { authApi, followupRulesApi, whatsappNotificationsApi } from "./api";
import { API_BASE_URL } from "./auth";
import { Modal } from "./PortalPages";
import PaymentFollowupRulesPage from "./PaymentFollowupRulesPage";
import WhatsAppManager from "./WhatsAppManager";

const previewImages = import.meta.glob("./assets/message-previews/*.{png,jpg,jpeg,webp}", { eager: true, query: "?url", import: "default" });
const previewImage = (name) => [name, `${name}_preview`]
  .flatMap((base) => ["png", "jpg", "jpeg", "webp"].map((extension) => `./assets/message-previews/${base}.${extension}`))
  .map((path) => previewImages[path])
  .find(Boolean);

const messages = [
  { id: "charter-reminder", service: "charters", name: "charter_departure_reminder", title: "Kujtesë për Rezervim Autobusi", icon: BellRing, description: "Kujtesë automatike për rezervimin e autobusit. Mesazhi dërgohet 3 ditë para datës së nisjes së charterit te numrat: 38975201015, 38970321120 dhe 38976448448.", preview: "Shembull i kujtesës që dërgohet 3 ditë para nisjes. Të dhënat e udhëtimit plotësohen automatikisht nga sistemi." },
  { id: "monthly", name: "maarif_monthly_report", title: "Raporti mujor Maarif", icon: FileText, description: "Përmbledhja automatike e muajit të kaluar: të hyrat, pagesat e nxënësve, detyrimet e mbetura dhe përqindjet e pagesave. Dërgohet te marrësit e raportit mujor.", preview: "Raporti përmbledh të hyrat, nxënësit që kanë paguar, shumën e paguar dhe detyrimet e papaguara për muajin e kaluar." },
  { id: "card", name: "card_collection_deadline", title: "Njoftimi i kartelës", icon: IdCard, description: "Njoftim në WhatsApp për afatin e marrjes së kartelës.", preview: "Shembull i mesazhit për afatin e marrjes së kartelës. Të dhënat konkrete plotësohen nga sistemi gjatë dërgimit.", send: whatsappNotificationsApi.sendCard },
  { id: "payment", name: "payment_notification", title: "Njoftimi i pagesës", icon: CreditCard, description: "Njoftim automatik në WhatsApp për pagesat.", preview: "Njoftim për pagesën e nxënësit. Të dhënat konkrete plotësohen nga sistemi gjatë dërgimit." },
  { id: "test", name: "test_message", title: "Mesazh testues", icon: Send, description: "Dërgo një template WhatsApp te një numër për testim.", manual: true },
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
  const [managerOpen, setManagerOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testForm, setTestForm] = useState({ to: "", template_name: "", language_code: "sq", variables: "", header_image_url: "" });
  const [testFeedback, setTestFeedback] = useState("");
  const [activeTab, setActiveTab] = useState("automatic");
  const [service, setService] = useState("maarif");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sendFeedback, setSendFeedback] = useState(null);
  const [paymentRules, setPaymentRules] = useState(null);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState(false);
  const filteredMessages = messages.filter((item) => (item.service || "maarif") === service && (activeTab === "manual" ? item.id === "card" || item.manual : item.id !== "card" && !item.manual) && `${item.name} ${item.title} ${item.description}`.toLocaleLowerCase("sq").includes(search.trim().toLocaleLowerCase("sq")));

  useEffect(() => {
    followupRulesApi.get()
      .then((rules) => { setPaymentRules(rules); setRulesError(false); })
      .catch(() => setRulesError(true))
      .finally(() => setRulesLoading(false));
  }, []);

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

  async function sendTest(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await whatsappNotificationsApi.sendTest({
        to: testForm.to.trim(),
        template_name: testForm.template_name.trim(),
        language_code: testForm.language_code.trim(),
        variables: testForm.variables.split("\n").map((value) => value.trim()).filter(Boolean),
        header_image_url: testForm.header_image_url.trim(),
      });
      setTestFeedback(`Testi u krye. Grupimi #${result.batch_id ?? "—"}: ${result.sent ?? 0} dërguar, ${result.failed ?? 0} dështuar.`);
      setTestOpen(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bt-page bt-messages-page">
      <header className="bt-page-header bt-messages-header">
        <div>
          <span className="bt-eyebrow">Bashkim Tours</span>
          <h1>Whatsapp Messages</h1>
          <p>Mesazhet WhatsApp dhe automatizimet sipas shërbimit.</p>
        </div>
        <button type="button" className="bt-btn-primary" onClick={() => { setManagerOpen((value) => !value); setSelected(null); setTestOpen(false); }}><ChartNoAxesCombined size={18} /> {managerOpen ? "Mesazhet" : "WhatsApp Manager"}</button>
      </header>
      {managerOpen ? <WhatsAppManager /> : <>
      <nav className="bt-messages-service-tabs" aria-label="Shërbimet"><button type="button" className={service === "maarif" ? "active" : ""} aria-current={service === "maarif" ? "page" : undefined} onClick={() => { setService("maarif"); setSelected(null); setSearch(""); }}>Maarif</button><button type="button" className={service === "charters" ? "active" : ""} aria-current={service === "charters" ? "page" : undefined} onClick={() => { setService("charters"); setActiveTab("automatic"); setSelected(null); setSearch(""); }}>Charters</button></nav>
      <div className="bt-messages-type-tabs" role="tablist" aria-label="Lloji i mesazheve">
        <button type="button" role="tab" aria-selected={activeTab === "automatic"} className={activeTab === "automatic" ? "active" : ""} onClick={() => setActiveTab("automatic")}>Automatike</button>
        {service === "maarif" && <button type="button" role="tab" aria-selected={activeTab === "manual"} className={activeTab === "manual" ? "active" : ""} onClick={() => setActiveTab("manual")}>Manuale</button>}
      </div>
      <label className="bt-messages-search">
        <Search size={19} aria-hidden="true" />
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kërko mesazhe dhe template…" aria-label="Kërko mesazhe dhe template" />
      </label>
      <div className="bt-messages-list" role="tabpanel">{filteredMessages.map((item) => {
          const Icon = item.icon;
          return <div key={item.id} className={`bt-messages-list-row ${selected?.id === item.id ? "selected" : ""}`}>
            <button type="button" className="bt-messages-list-detail" onClick={() => { if (item.id === "test") { setTestOpen(true); setError(""); } else { setSelected(item); setSendFeedback(null); setError(""); } }}>
              <Icon size={22} /><span><strong>{item.title}</strong><small>{item.name}</small>
                {item.id === "payment" && <small>{rulesLoading ? "Duke ngarkuar statusin…" : rulesError ? "Statusi nuk u lexua" : paymentRules ? `Dita e muajit: ${paymentRules.message_day}` : "Pa konfigurim"}</small>}
              </span>
            </button>
            {item.id === "monthly" && <em className="bt-messages-status active">Aktiv</em>}
            {item.id === "charter-reminder" && <em className="bt-messages-status active">Aktiv</em>}
            {item.id === "payment" && <em className={`bt-messages-status ${paymentRules?.is_active && paymentRules?.message_enabled ? "active" : ""}`}>{rulesLoading || rulesError ? "—" : paymentRules?.is_active && paymentRules?.message_enabled ? "Aktiv" : "Joaktiv"}</em>}
            {item.id === "card" && <button type="button" className="bt-btn-primary bt-messages-list-send" onClick={() => { setSelected(item); setSendFeedback(null); setPassword(""); setError(""); setConfirmOpen(true); }}><Send size={17} /> Dërgo</button>}
            {item.id === "test" && <button type="button" className="bt-btn-primary bt-messages-list-send" onClick={() => { setTestOpen(true); setError(""); }}><Send size={17} /> Testo</button>}
          </div>;
        })}</div>
      {filteredMessages.length === 0 && <p className="bt-messages-empty">Nuk u gjet asnjë mesazh për këtë kërkim.</p>}
      {selected && <Modal title={selected.title} className="bt-messages-detail-modal" onClose={() => { if (!busy) { setSelected(null); setConfirmOpen(false); } }}><section className="bt-messages-detail">
        <div className="bt-messages-detail-content">
        <div className="bt-messages-detail-heading"><div><h2>{selected.title}</h2><p>{selected.description}</p></div></div>
        <div className="bt-messages-actions">
          {selected.id === "card" && <button type="button" className="bt-btn-primary" disabled={busy} onClick={() => { setPassword(""); setError(""); setConfirmOpen(true); }}><Send size={17} /> {busy ? "Duke dërguar…" : "Dërgo"}</button>}
        </div>
        {sendFeedback && <p className={sendFeedback.type === "error" ? "bt-inline-error" : sendFeedback.type === "success" ? "bt-followup-rule-saved" : "bt-messages-info"} role="status">{sendFeedback.text}</p>}
        {selected.id === "payment" && <div className="bt-messages-schedule"><h3><BellRing size={19} /> Caktimi i ditës dhe automatizimi i pagesave</h3><PaymentFollowupRulesPage onSaved={(rules) => { setPaymentRules(rules); setRulesError(false); }} /></div>}
        </div>
        <figure className="bt-messages-preview">
          {previewImage(selected.name) && <img src={previewImage(selected.name)} alt={`Shembull i mesazhit ${selected.name} në WhatsApp`} />}
          <figcaption>{selected.preview}</figcaption>
        </figure>
      </section></Modal>}
      {confirmOpen && selected && <Modal title={`Konfirmo dërgimin · ${selected.title}`} onClose={() => { if (!busy) setConfirmOpen(false); }}>
        <form className="bt-messages-confirm" onSubmit={send}>
          <p>Shkruani përsëri fjalëkalimin e përdoruesit tuaj për të konfirmuar dërgimin manual.</p>
          <label className="bt-field"><span>Fjalëkalimi</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required autoFocus /></label>
          {error && <p className="bt-inline-error" role="alert">{error}</p>}
          <button className="bt-btn-primary" disabled={busy || !password} aria-busy={busy}>{busy ? "Duke dërguar…" : "Konfirmo dhe dërgo"}</button>
        </form>
      </Modal>}
      {testFeedback && <p className="bt-followup-rule-saved" role="status">{testFeedback}</p>}
      {testOpen && <Modal title="Dërgo mesazh testues" onClose={() => { if (!busy) setTestOpen(false); }}><form className="bt-wa-test-form" onSubmit={sendTest}>
        <label>Numri i marrësit<input required type="tel" value={testForm.to} onChange={(event) => setTestForm({ ...testForm, to: event.target.value })} placeholder="3897…" /></label>
        <label>Emri i template-it<input required value={testForm.template_name} onChange={(event) => setTestForm({ ...testForm, template_name: event.target.value })} placeholder="Emri i aprovuar në WhatsApp" /></label>
        <label>Kodi i gjuhës<input required value={testForm.language_code} onChange={(event) => setTestForm({ ...testForm, language_code: event.target.value })} placeholder="sq" /></label>
        <label>URL e figurës në krye<input required type="url" value={testForm.header_image_url} onChange={(event) => setTestForm({ ...testForm, header_image_url: event.target.value })} placeholder="https://…" /></label>
        <label>Variablat e template-it <small>(një për rresht, sipas renditjes së template-it)</small><textarea rows={5} value={testForm.variables} onChange={(event) => setTestForm({ ...testForm, variables: event.target.value })} /></label>
        {error && <p className="bt-inline-error" role="alert">{error}</p>}
        <button type="submit" className="bt-btn-primary" disabled={busy}>{busy ? "Duke dërguar…" : "Dërgo testin"}</button>
      </form></Modal>}
      </>}
    </div>
  );
}
