import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const threshold = 80;
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const atTop = () => window.scrollY <= 1 && (document.scrollingElement?.scrollTop || 0) <= 1;

function hasScrolledParent(target) {
  for (let node = target; node instanceof Element; node = node.parentElement) {
    if (node.scrollTop > 1 && node.scrollHeight > node.clientHeight) return true;
  }
  return false;
}

export default function PwaPullToRefresh() {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const gesture = useRef(null);
  const pullDistance = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    let refreshTimer;
    const reset = () => {
      gesture.current = null;
      pullDistance.current = 0;
      setDistance(0);
    };
    const start = (event) => {
      if (!isStandalone() || refreshingRef.current || event.touches.length !== 1 || !atTop()) return;
      if (document.documentElement.classList.contains("bt-pwa-keyboard-open")) return;
      const target = event.target;
      if (!(target instanceof Element) || target.closest("input, textarea, select, [contenteditable='true'], .bt-modal-backdrop, .bt-sidebar, .bt-pwa-subnav, .bt-mobile-bottom-nav")) return;
      if (hasScrolledParent(target)) return;
      gesture.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    };
    const move = (event) => {
      if (!gesture.current || event.touches.length !== 1) return;
      const deltaX = event.touches[0].clientX - gesture.current.x;
      const deltaY = event.touches[0].clientY - gesture.current.y;
      if (deltaY <= 0 || Math.abs(deltaX) > deltaY || !atTop()) { reset(); return; }
      if (event.cancelable) event.preventDefault();
      pullDistance.current = Math.min(112, deltaY * 0.46);
      setDistance(pullDistance.current);
    };
    const end = () => {
      if (!gesture.current) return;
      const ready = pullDistance.current >= threshold;
      gesture.current = null;
      if (ready) {
        refreshingRef.current = true;
        setRefreshing(true);
        setDistance(56);
        refreshTimer = window.setTimeout(() => window.location.reload(), 180);
      } else reset();
    };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", end, { passive: true });
    document.addEventListener("touchcancel", reset, { passive: true });
    return () => {
      window.clearTimeout(refreshTimer);
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", reset);
    };
  }, []);

  return <div className={`bt-pwa-pull-refresh ${distance > 0 ? "visible" : ""} ${refreshing ? "refreshing" : ""}`} style={{ "--bt-pull-distance": `${distance}px` }} role={distance > 0 ? "status" : undefined} aria-live="polite"><RefreshCw size={19} /><span>{refreshing ? "Duke rifreskuar…" : distance >= threshold ? "Lësho për rifreskim" : "Tërhiq për rifreskim"}</span></div>;
}
