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
    onNeedReload: () => window.location.reload(),
    onRegisterError: () => isStandalone() && setError("Përditësimi automatik nuk është gati. Rifreskoni faqen për të provuar përsëri."),
  });
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const viewport = document.querySelector('meta[name="viewport"]');
    const originalViewport = viewport?.getAttribute("content");
    const syncZoomMode = () => {
      const standalone = isStandalone();
      document.documentElement.classList.toggle("bt-pwa-fixed-zoom", standalone);
      document.documentElement.classList.toggle("bt-pwa-standalone", standalone);
      if (viewport) viewport.setAttribute("content", standalone
        ? "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no"
        : originalViewport);
    };
    const preventGesture = (event) => {
      if (isStandalone()) event.preventDefault();
    };
    const preventPinch = (event) => {
      if (isStandalone() && event.touches.length > 1) event.preventDefault();
    };
    const preventWheelZoom = (event) => {
      if (isStandalone() && event.ctrlKey) event.preventDefault();
    };
    const preventKeyboardZoom = (event) => {
      if (isStandalone() && (event.ctrlKey || event.metaKey) && ["+", "=", "-", "0"].includes(event.key)) {
        event.preventDefault();
      }
    };
    syncZoomMode();
    displayMode.addEventListener("change", syncZoomMode);
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("touchmove", preventPinch, { passive: false });
    window.addEventListener("wheel", preventWheelZoom, { passive: false });
    window.addEventListener("keydown", preventKeyboardZoom);
    return () => {
      displayMode.removeEventListener("change", syncZoomMode);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("touchmove", preventPinch);
      window.removeEventListener("wheel", preventWheelZoom);
      window.removeEventListener("keydown", preventKeyboardZoom);
      document.documentElement.classList.remove("bt-pwa-fixed-zoom", "bt-pwa-standalone");
      if (viewport && originalViewport !== null) viewport.setAttribute("content", originalViewport);
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
    if (app) app.inert = offline;
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
        <p id="bt-offline-description">Pagesat, të dhënat e nxënësve dhe verifikimi i kartelave kërkojnë internet. Rilidhuni për të vazhduar. Të dhënat e formularit mbeten në këtë dritare.</p>
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
