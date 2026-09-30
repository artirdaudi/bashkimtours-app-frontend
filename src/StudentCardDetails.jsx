import { useCallback, useState } from "react";
import { confirmAction } from "./confirmAction";
import { cardPaymentsApi, maarifSettingsApi, transportCardsApi } from "./api";
import { formatDateTime } from "./dateUtils";

const money = (value) => new Intl.NumberFormat("sq-AL", {
  style: "currency", currency: "EUR",
}).format(Number(value || 0));

export default function StudentCardDetails({ studentId, hasTransportCard, onChanged }) {
  const [card, setCard] = useState(null);
  const [payments, setPayments] = useState([]);
  const [newCardPrice, setNewCardPrice] = useState(null);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [pendingPaidAt, setPendingPaidAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadDetails = useCallback(async () => {
    setDetailsLoading(true);
    try {
      const [currentCard, history, settings] = await Promise.all([
        transportCardsApi.getForStudent(studentId),
        cardPaymentsApi.forStudent(studentId),
        maarifSettingsApi.get(),
      ]);
      setCard(currentCard);
      setNewCardPrice(settings.new_card_price);
      const orderedPayments = [...history].sort((a, b) => b.paid_at.localeCompare(a.paid_at));
      setPayments(orderedPayments);
      setDetailsLoaded(true);
      setPendingPaidAt(
        currentCard && orderedPayments[0] &&
        new Date(orderedPayments[0].paid_at) > new Date(currentCard.issued_at)
          ? orderedPayments[0].paid_at
          : null,
      );
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDetailsLoading(false);
    }
  }, [studentId]);

  async function saveCard() {
    setSaving(true);
    setError("");
    try {
      if (payments.length) throw new Error("Kartela mungon, por ka pagesa të mëparshme. Kontaktoni administratorin.");
      await transportCardsApi.issue(studentId, {
        issued_at: new Date().toISOString(),
        comment: null,
      });
      await loadDetails();
      onChanged?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function replaceCard() {
    setSaving(true);
    setError("");
    let paymentRecorded = Boolean(pendingPaidAt);
    try {
      let paidAt = pendingPaidAt;
      if (!paidAt) {
        const settings = await maarifSettingsApi.get();
        const amount = Number(settings.new_card_price);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error("Vendosni fillimisht çmimin e kartelës së re te skeda Kartelat.");
        }
        if (!await confirmAction(`Të regjistrohet pagesa ${money(amount)} dhe të lëshohet kartelë e re?`, { destructive: false })) return;
        const payment = await cardPaymentsApi.create(studentId, {
          amount,
          paid_at: new Date().toISOString(),
          comment: null,
        });
        paidAt = payment.paid_at;
        setPendingPaidAt(paidAt);
        paymentRecorded = true;
      }
      await transportCardsApi.update(studentId, { issued_at: paidAt });
      setPendingPaidAt(null);
      await loadDetails();
      onChanged?.();
    } catch (requestError) {
      setError(paymentRecorded
        ? `Pagesa është regjistruar. Provojeni sërish për të përfunduar lëshimin: ${requestError.message}`
        : requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bt-student-card-section">
      <div className="bt-section-heading"><div><h3>Kartela e transportit</h3></div></div>
      <p>{detailsLoaded ? (card ? <>Lëshuar më <strong>{formatDateTime(card.issued_at)}</strong> · Përdoruesi #{card.issued_by_user_id}</> : "Nuk ka kartelë të lëshuar.") : hasTransportCard ? "Kartela është lëshuar." : "Nuk ka kartelë të lëshuar."}</p>
      {!detailsLoaded && <button type="button" className="bt-btn-secondary" disabled={detailsLoading} onClick={loadDetails}>{detailsLoading ? "Duke ngarkuar…" : "Shiko dhe menaxho kartelën"}</button>}
      {detailsLoaded && (
        <>
          <div className="bt-card-record-actions">
            {!card && <button type="button" className="bt-btn-secondary" disabled={saving || (detailsLoaded && payments.length > 0)} onClick={saveCard}>Lësho kartelën fillestare falas</button>}
            {card && detailsLoaded && <button type="button" className="bt-btn-secondary" disabled={saving || (!pendingPaidAt && Number(newCardPrice) <= 0)} onClick={replaceCard}>
              {pendingPaidAt ? "Përfundo lëshimin e kartelës" : `Kartelë e re me pagesë (${money(newCardPrice)})`}
            </button>}
            {!card && detailsLoaded && payments.length > 0 && <p className="bt-inline-error">Kartela mungon, por ka pagesa të mëparshme. Kontaktoni administratorin.</p>}
          </div>
          <div className="bt-section-heading"><div><h3>Pagesat dhe çmimi i kartelës</h3><p>{payments.length} pagesa · Kartela e re: {money(newCardPrice)}</p></div></div>
          {detailsLoaded && (payments.length ? <div className="bt-history-table-wrap"><table className="bt-history-table">
            <thead><tr><th>Data</th><th>Shuma</th><th>Regjistruar nga</th></tr></thead>
            <tbody>{payments.map((payment) => <tr key={payment.id}>
              <td>{formatDateTime(payment.paid_at)}</td><td>{money(payment.amount)}</td>
              <td>#{payment.paid_by_user_id}</td>
            </tr>)}</tbody>
          </table></div> : <p className="bt-empty-inline">Nuk ka pagesa për kartelën.</p>)}
        </>
      )}
      {error && <p className="bt-inline-error">{error}</p>}
    </section>
  );
}
