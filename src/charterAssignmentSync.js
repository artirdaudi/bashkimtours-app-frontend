import { charterAssignmentsApi } from "./api";

export async function loadCharterAssignments(charterId) {
  const assignments = [];
  for (let offset = 0; ; offset += 100) {
    const batch = await charterAssignmentsApi.buses(charterId, { limit: 100, offset });
    assignments.push(...batch);
    if (batch.length < 100) break;
  }
  return Promise.all(assignments.map(async (assignment) => {
    const drivers = [];
    for (let offset = 0; ; offset += 100) {
      const batch = await charterAssignmentsApi.drivers(assignment.id, { limit: 100, offset });
      drivers.push(...batch);
      if (batch.length < 100) break;
    }
    return { ...assignment, drivers };
  }));
}

export async function syncCharterAssignments(charterId, desired, existing) {
  const wanted = new Set(desired.map((item) => String(item.busId)));
  for (const assignment of existing) {
    if (!wanted.has(String(assignment.bus_id))) await charterAssignmentsApi.removeBus(assignment.id);
  }
  for (const item of desired) {
    const previous = existing.find((assignment) => String(assignment.bus_id) === String(item.busId));
    const assignment = previous || await charterAssignmentsApi.assignBus(charterId, Number(item.busId));
    const wantedDrivers = new Set(item.driverIds.map(String));
    for (const driver of previous?.drivers || []) {
      if (!wantedDrivers.has(String(driver.driver_id))) await charterAssignmentsApi.removeDriver(driver.id);
    }
    for (const driverId of wantedDrivers) {
      if (!(previous?.drivers || []).some((driver) => String(driver.driver_id) === driverId)) {
        await charterAssignmentsApi.assignDriver(assignment.id, driverId);
      }
    }
  }
}
