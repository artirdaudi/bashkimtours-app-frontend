import { Banknote, BellRing, Bus, ChevronDown, CreditCard, FileText, Fuel, LogOut, Menu, Route, ScanLine, Settings, ShieldCheck, Truck, UserCircle, UsersRound, Wallet, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { logout as endSession } from "./auth";
import logo from "./assets/bashkimtours_logo.png";
import maarifLogo from "./assets/maarif_logo.jpeg";
import { prepareScanAudio } from "./scanAudio";

const maarifPages = [
  ["/students", "Nxënësit", UsersRound], ["/payments", "Pagesat", CreditCard],
  ["/arka", "Arka", Wallet], ["/skano", "Skano", ScanLine],
  ["/vehicles", "Automjetet", Bus], ["/drivers", "Shoferët", UsersRound],
  ["/areas", "Zonat", Route], ["/calendar", "Kalendari", BellRing],
  ["/cards", "Kartelat", CreditCard], ["/debts", "Borxhet", Banknote],
  ["/followup-rules", "Rregullat", FileText],
];
const fuelPages = [["/fuel", "Rezervari", Fuel], ["/fuel/suppliers", "Furnitorët", Truck]];
const charterPages = [["/charters", "Rezervimet", Route], ["/charters/payments", "Pagesat", CreditCard], ["/charters/cash", "Arka", Wallet]];

export default function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const inCharters = location.pathname === "/charters" || location.pathname.startsWith("/charters/");
  const inFuel = location.pathname === "/fuel" || location.pathname.startsWith("/fuel/");
  const inMaarif = maarifPages.some(([path]) => location.pathname === path);
  const moduleName = inFuel ? "Nafta" : inCharters ? "Charterët" : inMaarif ? "Maarif" : "Bashkim Tours";
  const modulePages = inFuel ? fuelPages : inCharters ? charterPages : inMaarif ? maarifPages : [];
  const currentPage = modulePages.find(([path]) => location.pathname === path)?.[1];
  const mobileNavRef = useRef(null);
  const inSettings = ["/messages", "/settings/accounts-roles", "/settings/cash-registers", "/settings/document-types"].includes(location.pathname);
  const [settingsOpen, setSettingsOpen] = useState(inSettings);
  const [loginArrival] = useState(() => {
    const active = sessionStorage.getItem("bt_login_transition") === "1";
    sessionStorage.removeItem("bt_login_transition");
    return active;
  });
  useEffect(() => {
    const scroller = mobileNavRef.current;
    const active = scroller?.querySelector("a.active");
    if (active) scroller.scrollTo({ left: active.offsetLeft - scroller.offsetLeft - scroller.clientWidth / 2 + active.clientWidth / 2, behavior: "smooth" });
  }, [location.pathname]);
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
          <NavLink to="/students" className={inMaarif ? "bt-module-active" : ""} onClick={() => setOpen(false)}>
            <img className="bt-menu-logo" src={maarifLogo} alt="" />
            <span>Maarif</span>
          </NavLink>
          {inMaarif && <div className="bt-mobile-module-links" aria-label="Nënmenytë Maarif"><strong className="bt-mobile-submenu-title">Maarif</strong>
            {maarifPages.map(([path, label]) => <NavLink key={path} to={path} onClick={() => setOpen(false)}>{label}</NavLink>)}
          </div>}
          <NavLink to="/charters" className={`bt-charter-nav-feature ${inCharters ? "bt-module-active" : ""}`} onClick={() => setOpen(false)}>
            <Route />
            <span>Charterët Rezervim</span>
            <small className="bt-charter-nav-ribbon">NEW</small>
          </NavLink>
          {inCharters && <div className="bt-mobile-module-links" aria-label="Nënmenytë Charterët"><strong className="bt-mobile-submenu-title">Charterët</strong>
            {charterPages.map(([path, label]) => <NavLink key={path} to={path} end={path === "/charters"} onClick={() => setOpen(false)}>{label}</NavLink>)}
          </div>}
          <NavLink to="/fuel" className={`bt-charter-nav-feature ${inFuel ? "bt-module-active" : ""}`} onClick={() => setOpen(false)}>
            <Fuel />
            <span>Nafta</span>
            <small className="bt-charter-nav-ribbon bt-fuel-nav-ribbon">NË PËRPUNIM</small>
          </NavLink>
          {inFuel && <div className="bt-mobile-module-links" aria-label="Nënmenytë Nafta"><strong className="bt-mobile-submenu-title">Nafta</strong><NavLink to="/fuel" end onClick={() => setOpen(false)}>Rezervari</NavLink><NavLink to="/fuel/suppliers" onClick={() => setOpen(false)}>Furnitorët</NavLink></div>}
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
        {currentPage && <div className="bt-mobile-module-context"><span>{moduleName}</span><strong>{currentPage}</strong></div>}
        <Outlet />
      </main>
      <nav className="bt-mobile-bottom-nav" aria-label={`Navigimi ${moduleName}`}>
        <div className="bt-mobile-nav-module"><span>MODULI</span><strong>{moduleName}</strong></div>
        <div className="bt-mobile-nav-scroller" ref={mobileNavRef}>
          {modulePages.map(([path, label, Icon]) => <NavLink key={path} to={path} end={path === "/fuel" || path === "/charters"} onClick={path === "/skano" ? prepareScanAudio : undefined}><Icon /><span>{label}</span></NavLink>)}
        </div>
        <button type="button" className={open ? "active bt-mobile-more" : "bt-mobile-more"} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Më shumë faqe"><Menu /><span>Më shumë</span></button>
      </nav>
    </div>
  );
}
