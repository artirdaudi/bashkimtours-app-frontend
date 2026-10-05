import { CreditCard, Route, Wallet } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const tabs = [
  ["payments", CreditCard, "Pagesat"],
  ["cash", Wallet, "Arka"],
  ["", Route, "Charters"],
];

export default function CharterTabs() {
  const location = useLocation();
  return <div className="bt-maarif-shell bt-charter-shell">
    <nav className="bt-maarif-tabs bt-charter-tabs" aria-label="Modulet Charterët">
      {tabs.map(([path, Icon, label]) => <NavLink key={label} to={path ? `/charters/${path}` : "/charters"} end={!path}><Icon size={17} /><span>{label}</span></NavLink>)}
    </nav>
    <div className="bt-route-stage" key={location.pathname}><Outlet /></div>
  </div>;
}
