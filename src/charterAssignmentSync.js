import { charterAssignmentsApi } from "./api";

export function selectedCharterAssignments(drafts, busCount, driverCount) {
  return Array.from({ length: Number(busCount) || 0 }, (_, index) => ({
    busId: drafts[index]?.busId || "",
    driverIds: Array.from({ length: Number(driverCount) || 0 }, (_, slot) => drafts[index]?.driverIds[slot] || "").filter(Boolean),
  })).filter((item) => item.busId);
}

export function charterAssignmentsPayload(drafts, busCount, driverCount) {
  return selectedCharterAssignments(drafts, busCount, driverCount).map(({ busId, driverIds }) => ({
    bus_id: Number(busId),
    driver_ids: driverIds,
  }));
}

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
