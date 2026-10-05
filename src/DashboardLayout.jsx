import { Banknote, BellRing, Bus, ChevronDown, CreditCard, FileText, LogOut, Menu, Route, ScanLine, Settings, ShieldCheck, UserCircle, UsersRound, Wallet, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { clearToken } from "./auth";
import logo from "./assets/bashkimtours_logo.png";
import maarifLogo from "./assets/maarif_logo.jpeg";
import { prepareScanAudio } from "./scanAudio";

export default function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const inCharters = location.pathname === "/charters" || location.pathname.startsWith("/charters/");
  const inSettings = ["/messages", "/settings/accounts-roles", "/settings/cash-registers", "/settings/document-types"].includes(location.pathname);
  const [settingsOpen, setSettingsOpen] = useState(inSettings);
  const [loginArrival] = useState(() => {
    const active = sessionStorage.getItem("bt_login_transition") === "1";
    sessionStorage.removeItem("bt_login_transition");
    return active;
  });
  const logout = () => {
    clearToken();
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
          <NavLink to="/charters" onClick={() => setOpen(false)}>
            <Route />
            <span>Charterët Rezervim</span>
          </NavLink>
          <div className="bt-mobile-module-links" aria-label="Modulet Charterët">
            <NavLink to="/charters/payments" onClick={() => setOpen(false)}>Pagesat Charter</NavLink>
            <NavLink to="/charters/cash" onClick={() => setOpen(false)}>Arka</NavLink>
          </div>
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
        <Outlet />
      </main>
      <nav className="bt-mobile-bottom-nav" aria-label={inCharters ? "Navigimi Charterët" : "Navigimi kryesor"}>
        {inCharters ? <>
          <NavLink to="/charters/payments"><CreditCard /><span>Pagesat</span></NavLink>
          <NavLink to="/charters/cash"><Wallet /><span>Arka</span></NavLink>
          <NavLink to="/charters" end><Route /><span>Charters</span></NavLink>
          <NavLink to="/students"><UsersRound /><span>Maarif</span></NavLink>
        </> : <>
          <NavLink to="/students"><UsersRound /><span>Nxënësit</span></NavLink>
          <NavLink to="/payments"><CreditCard /><span>Pagesat</span></NavLink>
          <NavLink to="/arka"><Wallet /><span>Arka</span></NavLink>
          <NavLink to="/skano" onClick={prepareScanAudio}><ScanLine /><span>Skano</span></NavLink>
        </>}
        <button type="button" className={open || (!inCharters && !["/students", "/payments", "/arka", "/skano"].includes(location.pathname)) ? "active" : ""} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Më shumë faqe"><Menu /><span>Më shumë</span></button>
      </nav>
    </div>
  );
}
