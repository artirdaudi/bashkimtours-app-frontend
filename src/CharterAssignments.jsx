import { useCallback, useEffect, useState } from "react";
import { charterAssignmentsApi } from "./api";
import CharterReferencePicker from "./CharterReferencePicker";
import { confirmAction } from "./confirmAction";

const labelBus = (bus) => bus?.targa || `Autobusi #${bus?.ID}`;
const labelDriver = (driver) => driver?.emri || `Shoferi #${driver?.id}`;

export default function CharterAssignments({ charter, buses, drivers }) {
  const [assignments, setAssignments] = useState([]);
  const [busId, setBusId] = useState("");
  const [busLabel, setBusLabel] = useState("");
  const [driverIds, setDriverIds] = useState({});
  const [driverLabels, setDriverLabels] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const busAssignments = [];
    let offset = 0;
    while (true) {
      const batch = await charterAssignmentsApi.buses(charter.id, { limit: 100, offset });
      busAssignments.push(...batch);
      if (batch.length < 100) break;
      offset += batch.length;
    }
    const withDrivers = await Promise.all(busAssignments.map(async (assignment) => {
      const assignedDrivers = [];
      let driverOffset = 0;
      while (true) {
        const batch = await charterAssignmentsApi.drivers(assignment.id, { limit: 100, offset: driverOffset });
        assignedDrivers.push(...batch);
        if (batch.length < 100) break;
        driverOffset += batch.length;
      }
      return { ...assignment, drivers: assignedDrivers };
    }));
    setAssignments(withDrivers);
  }, [charter.id]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      load().catch((requestError) => { if (active) setError(requestError.message); })
        .finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [load]);
  async function change(action) {
    if (busy) return;
    setBusy(true); setError("");
    try { await action(); await load(); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  const availableBuses = buses.filter((bus) => !assignments.some((item) => String(item.bus_id) === String(bus.ID)));
  const busChoices = (text) => availableBuses.filter((bus) => [bus.targa, bus.marka, bus.tipi, bus.ID].some((part) => String(part ?? "").toLocaleLowerCase("sq-AL").includes(text.toLocaleLowerCase("sq-AL")))).slice(0, 30).map((bus) => ({ id: bus.ID, label: labelBus(bus), meta: [bus.marka, bus.tipi].filter(Boolean).join(" · ") }));
  const driverChoices = (assignment, text) => drivers.filter((driver) => !assignment.drivers.some((item) => String(item.driver_id) === String(driver.id)) && [driver.emri, driver.telefoni, driver.id].some((part) => String(part ?? "").toLocaleLowerCase("sq-AL").includes(text.toLocaleLowerCase("sq-AL")))).slice(0, 30).map((driver) => ({ id: driver.id, label: labelDriver(driver), meta: driver.telefoni || "" }));
  return <section className="bt-charter-assignments">
    <h3>Autobusët dhe shoferët</h3>
    <p>{assignments.length} / {charter.number_of_buses ?? "—"} autobusë · deri {charter.drivers_per_bus ?? "—"} shoferë për autobus</p>
    {loading && <p role="status">Duke ngarkuar caktimet…</p>}
    {error && <p className="bt-inline-error" role="alert">{error}</p>}
    {!loading && assignments.map((assignment) => {
      const bus = buses.find((item) => String(item.ID) === String(assignment.bus_id));
      const selectedDriver = driverIds[assignment.id];
      return <div className="bt-charter-assignment" key={assignment.id}>
        <div className="bt-charter-assignment-header"><strong>{bus ? labelBus(bus) : `Autobusi #${assignment.bus_id}`}</strong><button type="button" className="bt-btn-danger bt-btn-small" disabled={busy} onClick={async () => { if (await confirmAction("Të hiqet autobusi dhe caktimet e shoferëve të tij?")) change(() => charterAssignmentsApi.removeBus(assignment.id)); }}>Hiq autobusin</button></div>
        <div className="bt-charter-assignment-drivers">{assignment.drivers.map((item) => {
          const driver = drivers.find((entry) => String(entry.id) === String(item.driver_id));
          return <div key={item.id}><span>{driver ? labelDriver(driver) : `Shoferi #${item.driver_id}`}</span><button type="button" className="bt-btn-secondary bt-btn-small" disabled={busy} onClick={() => change(() => charterAssignmentsApi.removeDriver(item.id))}>Hiq</button></div>;
        })}</div>
        {assignment.drivers.length < Number(charter.drivers_per_bus || 0) && <div className="bt-charter-assignment-add"><CharterReferencePicker value={selectedDriver || ""} selectedLabel={driverLabels[assignment.id] || ""} placeholder="Kërko shoferin…" searchOptions={(text) => driverChoices(assignment, text)} onSelect={(option) => { setDriverIds((current) => ({ ...current, [assignment.id]: option?.id || "" })); setDriverLabels((current) => ({ ...current, [assignment.id]: option?.label || "" })); }} /><button type="button" className="bt-btn-secondary" disabled={busy || !selectedDriver} onClick={() => change(async () => { await charterAssignmentsApi.assignDriver(assignment.id, selectedDriver); setDriverIds((current) => ({ ...current, [assignment.id]: "" })); setDriverLabels((current) => ({ ...current, [assignment.id]: "" })); })}>Shto shofer</button></div>}
      </div>;
    })}
    {!loading && assignments.length < Number(charter.number_of_buses || 0) && <div className="bt-charter-assignment-add"><CharterReferencePicker value={busId} selectedLabel={busLabel} placeholder="Kërko autobusin…" searchOptions={busChoices} onSelect={(option) => { setBusId(option?.id || ""); setBusLabel(option?.label || ""); }} /><button type="button" className="bt-btn-secondary" disabled={busy || !busId} onClick={() => change(async () => { await charterAssignmentsApi.assignBus(charter.id, busId); setBusId(""); setBusLabel(""); })}>Shto autobus</button></div>}
  </section>;
}
