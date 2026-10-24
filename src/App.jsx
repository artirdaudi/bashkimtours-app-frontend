import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import BashkimToursApp from "./BashkimToursApp";
import PwaSupport from "./PwaSupport";
import PwaPullToRefresh from "./PwaPullToRefresh";
import MutationIndicator from "./MutationIndicator";

export default function App() {
  useEffect(() => { document.dispatchEvent(new Event("bt-app-ready")); }, []);
  return (
    <BrowserRouter>
      <div id="bt-app-content">
        <BashkimToursApp />
      </div>
      <MutationIndicator />
      <PwaPullToRefresh />
      <PwaSupport />
    </BrowserRouter>
  );
}
