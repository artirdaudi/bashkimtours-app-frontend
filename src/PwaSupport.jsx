import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import "./pwa.css";

const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

export default function PwaSupport() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState("");
  useRegisterSW({
    onRegisterError: () => isStandalone() && setError("Përditësimi automatik nuk është gati. Rifreskoni faqen për të provuar përsëri."),
  });
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const syncDisplayMode = () => document.documentElement.classList.toggle("bt-pwa-standalone", isStandalone());
    syncDisplayMode();
    displayMode.addEventListener("change", syncDisplayMode);
    return () => {
      displayMode.removeEventListener("change", syncDisplayMode);
      document.documentElement.classList.remove("bt-pwa-standalone");
    };
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let scrollTimer;
    let fullHeight = Math.max(window.innerHeight, viewport?.height ?? 0);
    const updateKeyboard = () => {
      if (!isStandalone()) { root.classList.remove("bt-pwa-keyboard-open"); return; }
      const focused = document.activeElement?.matches("input, textarea, select, [contenteditable='true']");
      const height = viewport?.height ?? window.innerHeight;
      if (!focused) fullHeight = Math.max(fullHeight, window.innerHeight, height);
      root.classList.toggle("bt-pwa-keyboard-open", Boolean(focused && fullHeight - height > 120));
    };
    const onFocus = (event) => {
      if (!event.target.matches("input, textarea, select, [contenteditable='true']")) return;
      updateKeyboard();
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => event.target.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
    };
    const onBlur = () => window.setTimeout(updateKeyboard, 80);
    viewport?.addEventListener("resize", updateKeyboard);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    window.addEventListener("resize", updateKeyboard);
    return () => {
      window.clearTimeout(scrollTimer);
      root.classList.remove("bt-pwa-keyboard-open");
      viewport?.removeEventListener("resize", updateKeyboard);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      window.removeEventListener("resize", updateKeyboard);
    };
  }, []);

  useEffect(() => {
    const online = () => {
      // Public transport eligibility must be fetched again after reconnection.
      if (window.location.pathname.startsWith("/student/")) {
        window.location.reload();
        return;
      }
      setOffline(false);
      if (window.location.pathname === "/fuel" || window.location.pathname.startsWith("/fuel/")) {
        window.dispatchEvent(new Event("bt:fuel-reconnected"));
      }
      checkUpdate();
    };
    const offline = () => setOffline(true);
    const offerInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const installed = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    const checkUpdate = () => {
      if (document.visibilityState === "visible" && navigator.onLine && "serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistration().then((registration) => registration?.update()).catch(() => {});
      }
    };
    const updateTimer = window.setInterval(checkUpdate, 60_000);
    checkUpdate();
    window.addEventListener("focus", checkUpdate);
    window.addEventListener("pageshow", checkUpdate);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("beforeinstallprompt", offerInstall);
    window.addEventListener("appinstalled", installed);
    document.addEventListener("visibilitychange", checkUpdate);
    return () => {
      window.clearInterval(updateTimer);
      window.removeEventListener("focus", checkUpdate);
      window.removeEventListener("pageshow", checkUpdate);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("beforeinstallprompt", offerInstall);
      window.removeEventListener("appinstalled", installed);
      document.removeEventListener("visibilitychange", checkUpdate);
    };
  }, []);

  // Keep forms mounted while offline so unfinished input is not lost.
  useEffect(() => {
    const app = document.getElementById("bt-app-content");
    if (app) app.inert = offline || document.documentElement.classList.contains("bt-pwa-launch");
    return () => { if (app) app.inert = false; };
  }, [offline]);

  async function install() {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      setError("Instalimi nuk u krye. Provoni nga menyja e shfletuesit.");
    } finally {
      setInstallPrompt(null);
    }
  }

  if (offline) return (
    <div className="bt-pwa-offline" role="alertdialog" aria-modal="true" aria-labelledby="bt-offline-title" aria-describedby="bt-offline-description">
      <section>
        <img src="/icons/icon-192.png" width="96" height="96" alt="Bashkim Tours" />
        <h1 id="bt-offline-title">Nuk ka lidhje interneti</h1>
        <p id="bt-offline-description">Pagesat, të dhënat e naftës dhe të nxënësve, si dhe verifikimi i kartelave kërkojnë internet. Rilidhuni për të vazhduar. Të dhënat e formularit mbeten në këtë dritare.</p>
        <button type="button" onClick={() => { if (navigator.onLine) { setOffline(false); if (window.location.pathname === "/fuel" || window.location.pathname.startsWith("/fuel/")) window.dispatchEvent(new Event("bt:fuel-reconnected")); } }}>Provo përsëri</button>
      </section>
    </div>
  );

  if (!error && (installed || dismissed || (!installPrompt && !ios))) return null;
  return (
    <aside className="bt-pwa-notice" aria-label="Bashkim Tours aplikacioni">
      {error && <p role="alert">{error}</p>}
        {!installed && !dismissed && <>
          <strong>Instalo Bashkim Tours</strong>
          {installPrompt ? <><p>Hapeni aplikacionin direkt nga ekrani kryesor.</p><button type="button" onClick={install}>Instalo</button></> : ios ? <p>Në Safari, hapni menynë “Share”, zgjidhni “Add to Home Screen”, pastaj “Add”.</p> : null}
        </>}
      <button type="button" onClick={() => { setDismissed(true); setError(""); }}>Mbyll</button>
    </aside>
  );
}
