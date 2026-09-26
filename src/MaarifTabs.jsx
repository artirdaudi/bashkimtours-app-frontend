import {
  ScanLine,
  Bus,
  CalendarDays,
  Contact,
  CreditCard,
  MapPin,
  Users,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { prepareScanAudio } from "./scanAudio";

const tabs = [
  ["payments", CreditCard, "Pagesat"],
  ["students", Users, "Nxënësit"],
  ["vehicles", Bus, "Automjetet"],
  ["drivers", Users, "Shoferët"],
  ["areas", MapPin, "Zonat"],
  ["calendar", CalendarDays, "Kalendari"],
  ["cards", Contact, "Kartelat"],
  ["skano", ScanLine, "Skano"],
];

export default function MaarifTabs() {
  const location = useLocation();
  return (
    <div className={`bt-maarif-shell ${location.pathname === "/skano" ? "bt-maarif-shell--scan" : ""}`}>
      <nav className="bt-maarif-tabs" aria-label="Modulet Maarif">
        {tabs.map(([to, Icon, label]) => (
          <NavLink
            onClick={to === "skano" ? () => { prepareScanAudio(); } : undefined}
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
