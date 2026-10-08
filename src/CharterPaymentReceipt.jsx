import bashkimToursLogo from "./assets/bashkimtours_logo.png";
import { charterCurrency, formatCharterMoney } from "./charterCurrency";

const date = (value) => value ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)) : "—";
const dateTime = (value) => value ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value)) : "—";

export default function CharterPaymentReceipt({ charter, payment, remaining }) {
  const currency = charterCurrency(payment?.currency ? payment : charter);
  return <div className="bt-print-sheet bt-payment-receipt bt-charter-payment-receipt">
    <header><img src={bashkimToursLogo} alt="Bashkim Tours" /><div><strong>Bashkim Tours</strong><span>Dervish Cara Nr. 4 · 1200 Tetovë, Maqedoni</span><span>+389 44 338 003 · +389 75 312 015</span></div></header>
    <div className="bt-print-title"><div><h1>Vërtetim pagese</h1><p>Nr. i pagesës: {payment.id}</p></div><span>Printuar më {date(new Date())}</span></div>
    <section className="bt-receipt-section"><h2>Të dhënat e udhëtimit</h2><div className="bt-receipt-student"><div><small>Porositësi</small><strong>{charter.contractor || "—"}</strong></div><div><small>Relacioni</small><strong>{charter.route || "—"}</strong></div><div><small>Nisja</small><strong>{dateTime(charter.departure_at)}</strong></div><div><small>Lloji i faturimit</small><strong>{charter.billing_type === "INVOICE" ? "Faturë" : "Kesh"}</strong></div></div></section>
    <section className="bt-receipt-section"><h2>Të dhënat e pagesës</h2><div className="bt-receipt-payment"><div className="amount"><small>Shuma e paguar</small><strong>{formatCharterMoney(payment.amount, currency)}</strong></div><div><small>Data e pagesës</small><strong>{date(payment.payment_date)}</strong></div><div><small>Çmimi i udhëtimit</small><strong>{formatCharterMoney(charter.price, charterCurrency(charter))}</strong></div>{charter.billing_type === "CASH" && <div><small>Shuma e mbetur</small><strong>{formatCharterMoney(Math.max(0, Number(remaining || 0)), charterCurrency(charter))}</strong></div>}</div></section>
    <div className="bt-receipt-signatures"><span>Nënshkrimi i pranuesit</span><span>Nënshkrimi i paguesit</span></div>
    <footer><span>bashkimtours.com · instagram.com/bashkim_tours_official</span><strong>Bashkim Tours</strong></footer>
  </div>;
}
