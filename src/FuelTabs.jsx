import { Fuel, Truck } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

export default function FuelTabs() {
  const location = useLocation();
  return <div className="bt-maarif-shell bt-fuel-shell">
    <nav className="bt-maarif-tabs bt-fuel-tabs" aria-label="Modulet Nafta">
      <NavLink to="/fuel" end><Fuel size={17} /><span>Rezervari</span></NavLink>
      <NavLink to="/fuel/suppliers"><Truck size={17} /><span>Furnitorët</span></NavLink>
    </nav>
    <div className="bt-route-stage" key={location.pathname}><Outlet /></div>
  </div>;
}
