import { useEffect, useRef, useState } from "react";
import { BarChart3, CarFront, ChevronDown, Fuel, Layers3, MapPin, UsersRound } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import FuelTruckIcon from "./FuelTruckIcon";

export default function FuelTabs() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const moreActive = ["/fuel/suppliers", "/fuel/refuelling-locations", "/fuel/staff-vehicles"].includes(location.pathname);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!moreRef.current?.contains(event.target)) setMoreOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return <div className="bt-maarif-shell bt-fuel-shell">
    <nav className="bt-maarif-tabs bt-fuel-tabs" aria-label="Modulet Nafta">
      <NavLink to="/fuel/ledger"><Layers3 size={17} /><span>Komplet</span></NavLink>
      <NavLink to="/fuel/reports"><BarChart3 size={17} /><span>Raportet</span></NavLink>
      <NavLink to="/fuel" end><Fuel size={17} /><span>Rezervari</span></NavLink>
      <NavLink to="/fuel/external-refuellings"><Fuel size={17} /><span>Furnizimet e jashtme</span></NavLink>
      <NavLink to="/fuel/external-customers"><UsersRound size={17} /><span>Klientët e jashtëm</span></NavLink>
      <div className="bt-fuel-more" ref={moreRef}>
        <button type="button" className={moreActive ? "active" : ""} aria-expanded={moreOpen} aria-controls="bt-fuel-more-menu" onClick={() => setMoreOpen((open) => !open)}><span>Të Tjera</span><ChevronDown size={16} aria-hidden="true" /></button>
        {moreOpen && <div className="bt-fuel-more-menu" id="bt-fuel-more-menu">
          <NavLink to="/fuel/suppliers" onClick={() => setMoreOpen(false)}><FuelTruckIcon size={17} /><span>Furnitorët</span></NavLink>
          <NavLink to="/fuel/refuelling-locations" onClick={() => setMoreOpen(false)}><MapPin size={17} /><span>Lokacionet e furnizimit</span></NavLink>
          <NavLink to="/fuel/staff-vehicles" onClick={() => setMoreOpen(false)}><CarFront size={17} /><span>Automjetet e stafit</span></NavLink>
        </div>}
      </div>
    </nav>
    <div className="bt-route-stage" key={location.pathname}><Outlet /></div>
  </div>;
}
