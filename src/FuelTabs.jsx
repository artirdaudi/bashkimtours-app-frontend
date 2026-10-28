import { Fuel, MapPin, UsersRound } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import FuelTruckIcon from "./FuelTruckIcon";

export default function FuelTabs() {
  const location = useLocation();
  return <div className="bt-maarif-shell bt-fuel-shell">
    <nav className="bt-maarif-tabs bt-fuel-tabs" aria-label="Modulet Nafta">
      <NavLink to="/fuel" end><Fuel size={17} /><span>Rezervari</span></NavLink>
      <NavLink to="/fuel/external-refuellings"><Fuel size={17} /><span>Furnizimet e jashtme</span></NavLink>
      <NavLink to="/fuel/external-customers"><UsersRound size={17} /><span>Klientët e jashtëm</span></NavLink>
      <NavLink to="/fuel/suppliers" className="bt-cards-tab"><FuelTruckIcon size={17} /><span>Furnitorët</span></NavLink>
      <NavLink to="/fuel/refuelling-locations"><MapPin size={17} /><span>Lokacionet e furnizimit</span></NavLink>
    </nav>
    <div className="bt-route-stage" key={location.pathname}><Outlet /></div>
  </div>;
}
