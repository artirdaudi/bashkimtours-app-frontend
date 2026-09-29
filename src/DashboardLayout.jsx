import { Banknote, BellRing, ChevronDown, LogOut, Menu, Settings, ShieldCheck, UserCircle, UsersRound, Wallet, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { clearToken } from "./auth";
import logo from "./assets/bashkimtours_logo.png";
import maarifLogo from "./assets/maarif_logo.jpeg";

export default function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const inSettings = ["/messages", "/settings/accounts-roles", "/settings/cash-registers"].includes(location.pathname);
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
          <NavLink to="/income" onClick={() => setOpen(false)}>
            <Banknote />
            <span>Të hyrat</span>
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
    </div>
  );
}
