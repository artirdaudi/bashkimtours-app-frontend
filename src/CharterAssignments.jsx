import CharterReferencePicker from "./CharterReferencePicker";

const busLabel = (bus) => bus?.targa || `Autobusi #${bus?.ID}`;
const driverLabel = (driver) => driver?.emri || `Shoferi #${driver?.id}`;
const matches = (parts, text) => parts.some((part) => String(part ?? "").toLocaleLowerCase("sq-AL").includes(text.toLocaleLowerCase("sq-AL")));

export default function CharterAssignments({ assignments, onChange, numberOfBuses, driversPerBus, buses, drivers, disabled }) {
  const busCount = Math.max(0, Number(numberOfBuses) || 0);
  const driverCount = Math.max(0, Number(driversPerBus) || 0);
  const updateBus = (index, busId) => {
    const next = Array.from({ length: busCount }, (_, slot) => assignments[slot] || { busId: "", driverIds: [] });
    next[index] = { ...next[index], busId, driverIds: busId ? next[index].driverIds : [] };
    onChange(next);
  };
  const updateDriver = (busIndex, driverIndex, driverId) => {
    const next = Array.from({ length: busCount }, (_, slot) => assignments[slot] || { busId: "", driverIds: [] });
    const driverIds = Array.from({ length: driverCount }, (_, slot) => next[busIndex].driverIds[slot] || "");
    driverIds[driverIndex] = driverId;
    next[busIndex] = { ...next[busIndex], driverIds };
    onChange(next);
  };
  return <div className="bt-charter-assignment-fields">
    {Array.from({ length: busCount }, (_, busIndex) => {
      const item = assignments[busIndex] || { busId: "", driverIds: [] };
      const bus = buses.find((entry) => String(entry.ID) === String(item.busId));
      const busOptions = (text) => buses.filter((entry) => (String(entry.ID) === String(item.busId) || !assignments.some((selected, index) => index !== busIndex && String(selected.busId) === String(entry.ID))) && matches([entry.targa, entry.marka, entry.tipi, entry.ID], text)).slice(0, 40).map((entry) => ({ id: entry.ID, label: busLabel(entry), meta: [entry.marka, entry.tipi, entry.ulse != null ? `${entry.ulse} ulëse` : null].filter(Boolean).join(" · ") }));
      return <div className="bt-charter-assignment-slot" key={busIndex}>
        <label><span>Autobusi {busIndex + 1}</span><CharterReferencePicker value={item.busId} selectedLabel={bus ? busLabel(bus) : item.busId ? `Autobusi #${item.busId}` : ""} placeholder="Kërko targën ose autobusin…" searchOptions={busOptions} onSelect={(option) => updateBus(busIndex, option ? String(option.id) : "")} disabled={disabled} /></label>
        <div className="bt-charter-driver-slots">{Array.from({ length: driverCount }, (_, driverIndex) => {
          const id = item.driverIds[driverIndex] || "";
          const driver = drivers.find((entry) => String(entry.id) === String(id));
          const driverOptions = (text) => drivers.filter((entry) => (String(entry.id) === String(id) || !assignments.some((selected, selectedBusIndex) => selected.driverIds.some((selectedId, selectedDriverIndex) => (selectedBusIndex !== busIndex || selectedDriverIndex !== driverIndex) && String(selectedId) === String(entry.id)))) && matches([entry.emri, entry.telefoni, entry.id], text)).slice(0, 40).map((entry) => ({ id: entry.id, label: driverLabel(entry), meta: entry.telefoni || "" }));
          return <label key={driverIndex}><span>Shoferi {driverIndex + 1} · Autobusi {busIndex + 1}</span><CharterReferencePicker value={id} selectedLabel={driver ? driverLabel(driver) : id ? `Shoferi #${id}` : ""} placeholder="Kërko emrin ose telefonin…" searchOptions={driverOptions} onSelect={(option) => updateDriver(busIndex, driverIndex, option ? String(option.id) : "")} disabled={disabled || !item.busId} /></label>;
        })}</div>
      </div>;
    })}
  </div>;
}
