import {
  BellRing,
  ScanLine,
  Bus,
  CalendarDays,
  Contact,
  CreditCard,
  MapPin,
  Users,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const tabs = [
  ["payments", CreditCard, "Pagesat"],
  ["students", Users, "Nxënësit"],
  ["vehicles", Bus, "Automjetet"],
  ["drivers", Users, "Shoferët"],
  ["areas", MapPin, "Zonat"],
  ["calendar", CalendarDays, "Kalendari"],
  ["followup-rules", BellRing, "Rregullat e pagesave"],
  ["cards", Contact, "Kartelat"],
  ["skano", ScanLine, "Skano"],
];

export default function MaarifTabs() {
  const location = useLocation();
  return (
    <div className="bt-maarif-shell">
      <nav className="bt-maarif-tabs" aria-label="Modulet Maarif">
        {tabs.map(([to, Icon, label]) => (
          <NavLink
            end={!to}
            to={`/${to}`}
            key={label}
            className={to === "cards" ? "bt-cards-tab" : undefined}
          >
            <Icon size={17} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="bt-route-stage" key={location.pathname}>
        <Outlet />
      </div>
    </div>
  );
}
