import { useLayoutEffect, useSyncExternalStore } from "react";
import { LoaderCircle } from "lucide-react";
import { getMutationCount, subscribeMutations } from "./api/mutationState";

export default function MutationIndicator() {
  const count = useSyncExternalStore(subscribeMutations, getMutationCount);

  useLayoutEffect(() => {
    const blockInteraction = (event) => {
      if (!getMutationCount()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    for (const type of ["click", "submit", "keydown"]) {
      document.addEventListener(type, blockInteraction, true);
    }
    return () => {
      for (const type of ["click", "submit", "keydown"]) {
        document.removeEventListener(type, blockInteraction, true);
      }
    };
  }, []);

  useLayoutEffect(() => {
    const content = document.getElementById("bt-app-content");
    if (content) content.inert = count > 0;
    return () => { if (content) content.inert = false; };
  }, [count]);

  if (!count) return null;
  return (
    <div className="bt-mutation-overlay" role="status" aria-live="polite" aria-label="Veprimi është në proces">
      <div className="bt-mutation-message">
        <LoaderCircle className="bt-spin" aria-hidden="true" />
        <span>Duke përpunuar kërkesën…</span>
        <small>Ju lutemi prisni.</small>
      </div>
    </div>
  );
}
