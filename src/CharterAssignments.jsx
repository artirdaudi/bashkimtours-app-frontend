export default function CharterAssignments({ assignments, onChange, numberOfBuses, driversPerBus, buses, drivers, disabled }) {
  const busCount = Math.max(0, Number(numberOfBuses) || 0);
  const driverCount = Math.max(0, Number(driversPerBus) || 0);
  const updateBus = (index, busId) => {
    const next = Array.from({ length: busCount }, (_, slot) => assignments[slot] || { busId: "", driverIds: [] });
    next[index] = { busId, driverIds: next[index].driverIds };
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
      return <div className="bt-charter-assignment-slot" key={busIndex}>
        <label><span>Autobusi {busIndex + 1}</span><select required disabled={disabled} value={item.busId || ""} onChange={(event) => updateBus(busIndex, event.target.value)}><option value="">Zgjidh autobusin</option>{buses.filter((bus) => String(bus.ID) === String(item.busId) || !assignments.some((entry, index) => index !== busIndex && String(entry.busId) === String(bus.ID))).map((bus) => <option key={bus.ID} value={bus.ID}>{[bus.targa || `Autobusi #${bus.ID}`, bus.marka, bus.tipi].filter(Boolean).join(" · ")}</option>)}</select></label>
        <div className="bt-charter-driver-slots">{Array.from({ length: driverCount }, (_, driverIndex) => <label key={driverIndex}><span>Shoferi {driverIndex + 1} · Autobusi {busIndex + 1}</span><select required disabled={disabled} value={item.driverIds[driverIndex] || ""} onChange={(event) => updateDriver(busIndex, driverIndex, event.target.value)}><option value="">Zgjidh shoferin</option>{drivers.filter((driver) => String(driver.id) === String(item.driverIds[driverIndex]) || !assignments.some((entry, entryIndex) => entry.driverIds.some((id, index) => (entryIndex !== busIndex || index !== driverIndex) && String(id) === String(driver.id)))).map((driver) => <option key={driver.id} value={driver.id}>{driver.emri || `Shoferi #${driver.id}`}</option>)}</select></label>)}</div>
      </div>;
    })}
  </div>;
}
