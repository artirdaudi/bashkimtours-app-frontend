import { useEffect, useState } from "react";
import { AlertTriangle, BusFront, CalendarDays, CheckCircle2, MapPin, Phone, UserRound, XCircle } from "lucide-react";
import { useParams } from "react-router-dom";
import { qrApi } from "./api";
import { monthSq } from "./locale";
import bashkimLogo from "./assets/bashkimtours_logo.png";
import maarifLogo from "./assets/maarif_logo.jpeg";
import { formatDate } from "./dateUtils";

const dateSq = (value) => formatDate(value) || "—";
const money = (value) => `${Number(value || 0).toFixed(2)} €`;

export default function PublicStudentPage() {
  const { qrToken } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    qrApi.profile(qrToken).then((data) => { if (!cancelled) setProfile(data); }).catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [qrToken]);
  if (error) return <main className="bt-qr-page"><div className="bt-qr-state error"><XCircle /><h1>Kartela nuk u gjet</h1><p>{error}</p></div></main>;
  if (!profile) return <main className="bt-qr-page"><div className="bt-qr-state">Duke verifikuar kartelën...</div></main>;
  const { student, current_transport: transport } = profile;
  const today = new Date();
  const currentMonthValue = today.getFullYear() * 12 + today.getMonth() + 1;
  const currentDue = profile.monthly_dues.find(
    (due) =>
      Number(due.month) === today.getMonth() + 1 &&
      Number(due.calendar_year) === today.getFullYear(),
  );
  const currentDueOverdue = currentDue?.status === "OVERDUE";
  const previousOverdueDues = profile.monthly_dues
    .filter(
      (due) =>
        due.status === "OVERDUE" &&
        Number(due.calendar_year) * 12 + Number(due.month) < currentMonthValue,
    )
    .sort((a, b) => a.sequence - b.sequence);
  const previousDebtTotal = previousOverdueDues.reduce(
    (total, due) => total + Number(due.amount_due || 0),
    0,
  );
  const transportState = !profile.transport_allowed
    ? "blocked"
    : currentDueOverdue
      ? "warning"
      : "allowed";
  return (
    <main className="bt-qr-page">
      <div className="bt-qr-shell">
        <header className="bt-qr-header"><img src={bashkimLogo} alt="Bashkim Tours" /><span>KARTELË UDHËTIMI</span><div className="bt-qr-maarif"><img src={maarifLogo} alt="Maarif" /><b>MAARIF</b></div></header>
        <section className={`bt-transport-check ${transportState}`}>
          {transportState === "blocked" ? <XCircle /> : transportState === "warning" ? <AlertTriangle /> : <CheckCircle2 />}
          <div>
            <small>{transportState === "warning" ? "PAGESA E MUAJIT AKTUAL" : "STATUSI I TRANSPORTIT"}</small>
            <h1>{transportState === "blocked" ? "Nuk lejohet udhëtimi" : transportState === "warning" ? "Pagesa e këtij muaji ende nuk është paguar" : "Lejohet udhëtimi"}</h1>
            <p>{transportState === "warning" ? `${monthSq(currentDue.month, currentDue.month_name)} ${currentDue.calendar_year} · ${money(currentDue.amount_due)}` : profile.transport_status_reason}</p>
          </div>
        </section>
        <section className="bt-qr-student-head"><div className="bt-qr-avatar"><UserRound /></div><div><small>BT{student.student_code}</small><h2>{student.first_name} {student.last_name}</h2></div></section>
        <div className="bt-qr-grid">
          <section className="bt-qr-panel"><h3>Të dhënat e nxënësit</h3><dl><div><dt>Prindi / kujdestari</dt><dd>{student.parent_name}</dd></div><div><dt>Telefoni</dt><dd><a href={`tel:${student.parent_phone}`}><Phone />{student.parent_phone}</a></dd></div><div><dt>Zona</dt><dd><MapPin />{student.area_name}</dd></div><div><dt>Adresa</dt><dd>{student.address}</dd></div><div><dt>Fillimi</dt><dd>{dateSq(student.start_date)}</dd></div></dl></section>
          <section className="bt-qr-panel"><h3>Automjeti aktual</h3>{transport ? <dl><div><dt>Automjeti</dt><dd><BusFront />{transport.vehicle_type} · {transport.model}</dd></div><div><dt>Targat</dt><dd>{transport.plate_number}</dd></div><div><dt>Shoferi</dt><dd>{transport.driver ? `${transport.driver.first_name} ${transport.driver.last_name}` : "Pa shofer"}</dd></div>{transport.driver && <div><dt>Telefoni i shoferit</dt><dd><a href={`tel:${transport.driver.phone_number}`}><Phone />{transport.driver.phone_number}</a></dd></div>}</dl> : <p className="bt-qr-muted">Nxënësi nuk është caktuar në automjet.</p>}</section>
        </div>
        {previousOverdueDues.length > 0 && (
          <section className="bt-qr-debt-panel">
            <header>
              <div><AlertTriangle /><span><small>BORXH PËR PAGESË</small><h3>Pagesa të mëparshme të papaguara</h3></span></div>
              <strong>{money(previousDebtTotal)}</strong>
            </header>
            <div className="bt-qr-debt-list">
              {previousOverdueDues.map((due) => (
                <div key={due.due_id}>
                  <span>{monthSq(due.month, due.month_name)} {due.calendar_year}</span>
                  <strong>{money(due.amount_due)}</strong>
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="bt-qr-panel bt-qr-payment"><h3>Gjendja e pagesave</h3><div className="bt-qr-months">{profile.monthly_dues.map((due) => <div className={due.status.toLowerCase()} key={due.due_id}><CalendarDays /><span>{monthSq(due.month, due.month_name)}</span><b>{due.status === "PAID" ? "Paguar" : due.status === "PENDING" ? "Në pritje" : due.status === "OVERDUE" ? "Pa paguar" : "Bllokuar"}</b><small>{money(due.amount_due)}</small></div>)}</div></section>
        <footer>© Bashkim Tours · Tetovë</footer>
      </div>
    </main>
  );
}
