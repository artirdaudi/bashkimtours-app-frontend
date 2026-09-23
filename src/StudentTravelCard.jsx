import { forwardRef } from "react";
import { BusFront, House, MapPin, Phone, UserRound, UsersRound } from "lucide-react";
import bashkimLogo from "./assets/bashkimtours_logo.png";
import maarifLogo from "./assets/maarif_logo.jpeg";

const Row = ({ icon: Icon, label, value }) => (
  <div className="bt-card-data-row">
    <span><Icon /></span>
    <small>{label}</small>
    <i>:</i>
    <strong>{value || "—"}</strong>
  </div>
);

const StudentTravelCard = forwardRef(function StudentTravelCard(
  { student, qrSvg }, ref,
) {
  const code = `BT${student.student_code}`;
  return (
    <div className="bt-travel-card" ref={ref}>
      <header>
        <img src={bashkimLogo} className="bt-card-bashkim-logo" alt="Bashkim Tours" />
        <div className="bt-card-title">KARTELË UDHËTIMI</div>
        <div className="bt-card-maarif-brand"><img src={maarifLogo} alt="Maarif" /><span><b>MAARIF</b><small>SCHOOLS OF NORTH MACEDONIA</small></span></div>
      </header>
      <main>
        <div className="bt-card-qr-panel">
          {qrSvg ? <div className="bt-card-qr-svg" role="img" aria-label={`QR ${code}`} dangerouslySetInnerHTML={{ __html: qrSvg }} /> : <div className="bt-card-qr-loading" />}
          <small>KODI I NXËNËSIT</small><b>{code}</b>
        </div>
        <div className="bt-card-details">
          <Row icon={UserRound} label="NXËNËSI" value={`${student.first_name} ${student.last_name}`} />
          <Row icon={UsersRound} label="PRINDI / KUJDESTARI" value={student.parent_name} />
          <Row icon={Phone} label="TELEFONI" value={student.parent_phone} />
          <Row icon={MapPin} label="ZONA" value={student.area_name} />
          <Row icon={House} label="ADRESA" value={student.address} />
        </div>
      </main>
      <footer>
        <div className="bt-card-wave-one" />
        <div className="bt-card-wave-two" />
        <div className="bt-card-slogan"><BusFront /><i /><span>Udhëto i sigurt, udhëto me Bashkim Tours!</span></div>
      </footer>
    </div>
  );
});

export default StudentTravelCard;
