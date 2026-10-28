import { Banknote, BellRing, Bus, CalendarDays, ChevronDown, Contact, CreditCard, FileText, Fuel, LogOut, MapPin, Menu, Route, ScanLine, Settings, ShieldCheck, UserCircle, UsersRound, Wallet, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { logout as endSession } from "./auth";
import logo from "./assets/bashkimtours_logo.png";
import maarifLogo from "./assets/maarif_logo.jpeg";
import { prepareScanAudio } from "./scanAudio";
import FuelTruckIcon from "./FuelTruckIcon";

const moduleTabs = {
  income: [],
  maarif: [["/students", UsersRound, "Nxënësit"], ["/payments", CreditCard, "Pagesat"], ["/arka", Wallet, "Arka"], ["/vehicles", Bus, "Automjetet"], ["/drivers", UsersRound, "Shoferët"], ["/areas", MapPin, "Zonat"], ["/calendar", CalendarDays, "Kalendari"], ["/cards", Contact, "Kartelat"], ["/debts", FileText, "Borxhet"], ["/followup-rules", Settings, "Rregullat"], ["/skano", ScanLine, "Skano"]],
  charters: [["/charters", Route, "Rezervimet"], ["/charters/payments", CreditCard, "Pagesat"], ["/charters/cash", Wallet, "Arka"]],
  fuel: [["/fuel", Fuel, "Rezervari"], ["/fuel/external-refuellings", Fuel, "Furnizimet e jashtme"], ["/fuel/external-customers", UsersRound, "Klientët e jashtëm"], ["/fuel/suppliers", FuelTruckIcon, "Furnitorët"], ["/fuel/refuelling-locations", MapPin, "Lokacionet e furnizimit"]],
  more: [],
};
const settingsTabs = [["/settings/accounts-roles", ShieldCheck, "Llogaritë dhe rolet"], ["/settings/cash-registers", Wallet, "Arkat"], ["/settings/document-types", FileText, "Llojet e dokumentave"], ["/messages", BellRing, "Mesazhet"]];
const moduleMeta = {
  income: { title: "Të hyrat", description: "Përmbledhja financiare", icon: Banknote },
  maarif: { title: "Maarif", description: "Nxënësit dhe transporti", icon: UsersRound },
  charters: { title: "Charterët", description: "Rezervimet dhe pagesat", icon: Route },
  fuel: { title: "Nafta", description: "Rezervari dhe furnizimet", icon: Fuel },
  more: { title: "Të tjera", description: "Mjetet dhe cilësimet", icon: Menu },
};
const maarifPaths = new Set(moduleTabs.maarif.map(([path]) => path));

export default function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const inCharters = location.pathname === "/charters" || location.pathname.startsWith("/charters/");
  const inFuel = location.pathname === "/fuel" || location.pathname.startsWith("/fuel/");
  const module = location.pathname === "/income" ? "income" : inCharters ? "charters" : inFuel ? "fuel" : maarifPaths.has(location.pathname) ? "maarif" : "more";
  const activeTabs = location.pathname.startsWith("/settings/") || location.pathname === "/messages" ? settingsTabs : moduleTabs[module];
  const moduleIndex = { income: 0, maarif: 1, charters: 2, fuel: 3, more: 4 }[module];
  const activeModuleMeta = location.pathname === "/autobusat" ? { title: "Autobusët", description: "Regjistri i autobusëve", icon: Bus }
    : location.pathname === "/shoferat" ? { title: "Shoferat dhe Staff", description: "Shoferët dhe personeli", icon: UsersRound }
    : location.pathname.startsWith("/settings/") || location.pathname === "/messages" ? { title: "Cilësimet", description: "Llogaritë dhe konfigurimi", icon: Settings }
    : location.pathname === "/account" ? { title: "Llogaria ime", description: "Profili dhe të dhënat e mia", icon: UserCircle }
    : moduleMeta[module];
  const ModuleIcon = activeModuleMeta.icon;
  const inSettings = ["/messages", "/settings/accounts-roles", "/settings/cash-registers", "/settings/document-types"].includes(location.pathname);
  const [settingsOpen, setSettingsOpen] = useState(inSettings);
  const [loginArrival] = useState(() => {
    const active = sessionStorage.getItem("bt_login_transition") === "1";
    sessionStorage.removeItem("bt_login_transition");
    return active;
  });
  const logout = async () => {
    await endSession();
    window.location.replace("/");
  };

  return (
    <div className={`bt-dashboard ${loginArrival ? "bt-login-arrival" : ""}`}>
      <button
        className="bt-mobile-menu"
        onClick={() => setOpen(!open)}
        aria-label="Hap menunë"
      >
        {open ? <X /> : <Menu />}
      </button>
      <aside className={`bt-sidebar bt-sidebar-new ${open ? "open" : ""}`}>
        <img className="bt-sidebar-logo" src={logo} alt="Bashkim Tours" />
        <nav className="bt-nav">
          <NavLink to="/students" onClick={() => setOpen(false)}>
            <img className="bt-menu-logo" src={maarifLogo} alt="" />
            <span>Maarif</span>
          </NavLink>
          <div className="bt-mobile-module-links" aria-label="Modulet Maarif">
            {[
              ["/vehicles", "Automjetet"], ["/drivers", "Shoferët Maarif"],
              ["/areas", "Zonat"], ["/calendar", "Kalendari"],
              ["/cards", "Kartelat"], ["/debts", "Borxhet"],
              ["/followup-rules", "Rregullat e pagesave"],
            ].map(([path, label]) => <NavLink key={path} to={path} onClick={() => setOpen(false)}>{label}</NavLink>)}
          </div>
          <NavLink to="/charters" className="bt-charter-nav-feature" onClick={() => setOpen(false)}>
            <Route />
            <span>Charterët Rezervim</span>
            <small className="bt-charter-nav-ribbon">NEW</small>
          </NavLink>
          <div className="bt-mobile-module-links" aria-label="Modulet Charterët">
            <NavLink to="/charters/payments" onClick={() => setOpen(false)}>Pagesat Charter</NavLink>
            <NavLink to="/charters/cash" onClick={() => setOpen(false)}>Arka</NavLink>
          </div>
          <NavLink to="/fuel" className="bt-charter-nav-feature" onClick={() => setOpen(false)}>
            <Fuel />
            <span>Nafta</span>
            <small className="bt-charter-nav-ribbon bt-fuel-nav-ribbon">NË PËRPUNIM</small>
          </NavLink>
          <NavLink to="/income" onClick={() => setOpen(false)}>
            <Banknote />
            <span>Të hyrat</span>
          </NavLink>
          <NavLink to="/autobusat" onClick={() => setOpen(false)}>
            <Bus />
            <span>Autobusët</span>
          </NavLink>
          <NavLink to="/shoferat" onClick={() => setOpen(false)}>
            <UsersRound />
            <span>Shoferat dhe Staff</span>
          </NavLink>
          <NavLink className="bt-pwa-settings-link" to="/settings/accounts-roles" onClick={() => setOpen(false)}><Settings /><span>Cilësimet</span></NavLink>
          <div className="bt-settings-group">
            <button
              type="button"
              className={`bt-settings-toggle ${inSettings ? "active" : ""}`}
              onClick={() => setSettingsOpen((current) => !current)}
              aria-expanded={settingsOpen}
              aria-controls="bt-settings-links"
              aria-label="Settings"
            >
              <Settings />
              <span>Settings</span>
              <ChevronDown className={`bt-settings-chevron ${settingsOpen ? "open" : ""}`} />
            </button>
            {settingsOpen && (
              <div id="bt-settings-links" className="bt-settings-links">
                <NavLink to="/messages" onClick={() => setOpen(false)}>
                  <BellRing />
                  <span>WhatsApp Messages</span>
                </NavLink>
                <NavLink to="/settings/accounts-roles" onClick={() => setOpen(false)}>
                  <ShieldCheck />
                  <span>Llogaritë dhe rolet</span>
                </NavLink>
                <NavLink to="/settings/cash-registers" onClick={() => setOpen(false)}>
                  <Wallet />
                  <span>Arkat</span>
                </NavLink>
                <NavLink to="/settings/document-types" onClick={() => setOpen(false)}>
                  <FileText />
                  <span>Llojet e Dokumentave</span>
                </NavLink>
              </div>
            )}
          </div>
          <NavLink to="/account" onClick={() => setOpen(false)}>
            <UserCircle />
            <span>Llogaria Ime</span>
          </NavLink>
        </nav>
        <button className="bt-logout" onClick={logout}>
          <LogOut />
          <span>Dil</span>
        </button>
      </aside>
      {open && (
        <button
          className="bt-sidebar-backdrop"
          aria-label="Mbyll menunë"
          onClick={() => setOpen(false)}
        />
      )}
      <main className="bt-main">
        <div className="bt-pwa-module-head" key={activeModuleMeta.title}><div className="bt-pwa-module-title"><span className="bt-pwa-module-icon"><ModuleIcon size={24} /></span><div><h2>{activeModuleMeta.title}</h2><p>{activeModuleMeta.description}</p></div></div></div>
        {activeTabs.length > 0 && <nav className="bt-pwa-subnav" aria-label={`Nënmenutë ${activeModuleMeta.title}`}>{activeTabs.map(([path, Icon, label]) => <NavLink key={path} to={path} end onClick={path === "/skano" ? prepareScanAudio : undefined}><Icon size={17} /><span>{label}</span></NavLink>)}</nav>}
        <Outlet />
      </main>
      <nav className="bt-mobile-bottom-nav" aria-label="Navigimi kryesor" style={{ "--bt-module-offset": `${(open ? 4 : moduleIndex) * 100}%` }}>
        <span className="bt-mobile-nav-indicator" aria-hidden="true" />
        <NavLink to="/income" className={module === "income" ? "active" : ""} onClick={() => setOpen(false)}><Banknote /><span>Të hyrat</span></NavLink>
        <NavLink to="/students" className={module === "maarif" ? "active" : ""} onClick={() => setOpen(false)}><UsersRound /><span>Maarif</span></NavLink>
        <NavLink to="/charters" className={module === "charters" ? "active" : ""} onClick={() => setOpen(false)}><Route /><span>Charterët</span></NavLink>
        <NavLink to="/fuel" className={module === "fuel" ? "active" : ""} onClick={() => setOpen(false)}><Fuel /><span>Nafta</span></NavLink>
        <button type="button" className={open || module === "more" ? "active" : ""} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Më shumë"><Menu /><span>Më shumë</span></button>
      </nav>
    </div>
  );
}
