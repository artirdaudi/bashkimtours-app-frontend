import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import BashkimToursApp from "./BashkimToursApp";
import PwaSupport from "./PwaSupport";

export default function App() {
  useEffect(() => { document.dispatchEvent(new Event("bt-app-ready")); }, []);
  return (
    <BrowserRouter>
      <div id="bt-app-content">
        <BashkimToursApp />
      </div>
      <PwaSupport />
    </BrowserRouter>
  );
}
