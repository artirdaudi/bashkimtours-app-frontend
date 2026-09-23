import { useEffect, useState } from "react";
import {
  BellRing,
  Check,
  Clock3,
  MessageSquareText,
  RefreshCw,
  Save,
  ShieldAlert,
} from "lucide-react";
import { formatDateTime } from "./dateUtils";
import { followupRulesApi } from "./api";
import { Modal } from "./PortalPages";
import messagePreview from "./assets/message_preview.png";

const initialForm = {
  is_active: true,
  overdue_enabled: true,
  overdue_day: 1,
  message_enabled: true,
  message_day: 1,
};

const toForm = (rules) => ({
  is_active: rules.is_active,
  overdue_enabled: rules.overdue_enabled,
  overdue_day: rules.overdue_day,
  message_enabled: rules.message_enabled,
  message_day: rules.message_day,
});

export default function PaymentFollowupRulesPage() {
  const [rules, setRules] = useState();
  const [form, setForm] = useState();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    followupRulesApi
      .get()
      .then((response) => {
        setRules(response);
        setForm(toForm(response));
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (key, value) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const body = {
        is_active: form.is_active,
        overdue_enabled: form.overdue_enabled,
        overdue_day: Number(form.overdue_day),
        message_enabled: form.message_enabled,
        message_day: Number(form.message_day),
      };
      const response = rules?.id
        ? await followupRulesApi.update(rules.id, body)
        : await followupRulesApi.create(body);
      setRules(response);
      setForm(toForm(response));
      setSaved(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bt-page bt-ops-page">
      <header className="bt-page-header">
        <div>
          <span className="bt-eyebrow">Bashkim Tours · Maarif</span>
          <h1>Rregullat e pagesave</h1>
          <p>Konfigurimi i vonesës dhe mesazhit automatik për pagesat.</p>
        </div>
      </header>

      {loading ? (
        <div className="bt-state-message">
          <RefreshCw className="bt-spin" /> Duke ngarkuar rregullat…
        </div>
      ) : error && !form ? (
        <section className="bt-followup-rule-setup-error">
          <p className="bt-inline-error">{error}</p>
          <p>
            Nëse konfigurimi nuk është krijuar ende, përgatiteni dhe ruajeni
            për herë të parë.
          </p>
          <button
            type="button"
            className="bt-btn-secondary"
            onClick={() => {
              setError("");
              setForm(initialForm);
            }}
          >
            Përgatit konfigurimin fillestar
          </button>
        </section>
      ) : (
        <form className="bt-followup-rules" onSubmit={save}>
          <section className="bt-followup-master-rule">
            <div>
              <span className={form.is_active ? "active" : ""}>
                <ShieldAlert />
              </span>
              <div>
                <h2>Sistemi i ndjekjes së pagesave</h2>
                <p>Aktivizoni ose çaktivizoni automatizimin e rregullave.</p>
              </div>
            </div>
            <div className="bt-followup-master-actions">
              <label className="bt-rule-switch">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => set("is_active", event.target.checked)}
                />
                <span />
                <b>{form.is_active ? "Aktiv" : "Joaktiv"}</b>
              </label>
              <button className="bt-btn-primary" disabled={saving}>
                {saving ? <RefreshCw className="bt-spin" /> : <Save />}
                {saving ? "Duke ruajtur…" : "Ruaj rregullat"}
              </button>
            </div>
          </section>

          <div className="bt-followup-rule-grid bt-followup-rule-grid--current">
            <RuleRow
              number="1"
              icon={Clock3}
              title="Pagesa me vonesë"
              description="Detyrimi mujor kalon automatikisht në statusin Me vonesë në ditën e përcaktuar."
              enabled={form.overdue_enabled}
              onEnabledChange={(value) => set("overdue_enabled", value)}
              day={form.overdue_day}
              onDayChange={(value) => set("overdue_day", value)}
            />

            <RuleRow
              number="2"
              icon={BellRing}
              title="Mesazhi automatik i pagesës"
              description="Mesazhi dërgohet automatikisht nga WhatsApp-i i Bashkim Tours te prindi i nxënësit."
              enabled={form.message_enabled}
              onEnabledChange={(value) => set("message_enabled", value)}
              day={form.message_day}
              onDayChange={(value) => set("message_day", value)}
            >
              <figure className="bt-rule-message-preview">
                <div>
                  <MessageSquareText />
                  <figcaption>
                    <strong>Pamja e mesazhit</strong>
                    <span>
                      Të dhënat e nxënësit, muajt dhe shuma plotësohen
                      automatikisht.
                    </span>
                  </figcaption>
                </div>
                <button
                  type="button"
                  className="bt-rule-message-preview-button"
                  onClick={() => setPreviewOpen(true)}
                  aria-label="Hap pamjen e zmadhuar të mesazhit"
                >
                  <img
                    src={messagePreview}
                    alt="Shembull i mesazhit automatik të pagesës në WhatsApp"
                  />
                  <span>Kliko për ta zmadhuar</span>
                </button>
              </figure>
            </RuleRow>
          </div>
          {previewOpen && (
            <Modal
              title="Pamja e mesazhit automatik"
              onClose={() => setPreviewOpen(false)}
            >
              <div className="bt-rule-message-preview-modal">
                <img
                  src={messagePreview}
                  alt="Pamja e zmadhuar e mesazhit automatik të pagesës"
                />
              </div>
            </Modal>
          )}

          <div className="bt-followup-rule-footer">
            {rules && (
              <p className="bt-followup-rule-updated">
                Përditësimi i fundit: {formatDateTime(rules.updated_at)}
              </p>
            )}
            {error && <p className="bt-inline-error">{error}</p>}
            {saved && (
              <p className="bt-followup-rule-saved">
                <Check /> Rregullat u ruajtën me sukses.
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function RuleRow({
  number,
  icon: Icon,
  title,
  description,
  enabled,
  onEnabledChange,
  day,
  onDayChange,
  children,
}) {
  return (
    <section className={!enabled ? "disabled" : ""}>
      <header>
        <span>{number}</span>
        <Icon />
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <label className="bt-rule-switch compact">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          <span />
        </label>
      </header>
      <label className="bt-rule-day-field">
        <span>Dita e muajit</span>
        <div>
          <input
            type="number"
            min="1"
            max="31"
            required
            value={day}
            onChange={(event) => onDayChange(event.target.value)}
          />
        </div>
      </label>
      {children || <span className="bt-rule-row-spacer" />}
    </section>
  );
}
