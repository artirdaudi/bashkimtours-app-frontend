import { useCallback, useEffect, useState } from "react";
import {
  Bus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { driverAssignmentsApi, driversApi, vehiclesApi } from "./api";
import { Modal } from "./PortalPages";

const today = () => {
  const date = new Date(),
    offset = date.getTimezoneOffset() * 60000;
  return new Date(date - offset).toISOString().slice(0, 10);
};
const empty = {
  vehicle_type: "VAN",
  plate_number: "",
  model: "",
  total_seats: 1,
  is_active: true,
  comment: "",
  driver_id: "",
};

export default function VehiclesManagementPage() {
  const [data, setData] = useState();
  const [drivers, setDrivers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [editing, setEditing] = useState();
  const [deletingId, setDeletingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vehicles, driverData, assignmentData] = await Promise.all([
      vehiclesApi.list({
        search,
        is_active: active,
        page: 1,
        page_size: 100,
        sort_by: "created_at",
        sort_order: "desc",
      }),
      driversApi.list({
        is_active: true,
        page: 1,
        page_size: 100,
        sort_by: "first_name",
        sort_order: "asc",
      }),
      driverAssignmentsApi.list({
        is_active: true,
        page: 1,
        page_size: 100,
        sort_by: "assigned_from",
        sort_order: "desc",
      }),
      ]);
      setData(vehicles);
      setDrivers(driverData.items);
      setAssignments(assignmentData.items);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [search, active]);
  useEffect(() => {
    const request = window.setTimeout(load, 0);
    return () => window.clearTimeout(request);
  }, [load]);
  const currentAssignment = (vehicleId) =>
    assignments.find((item) => item.vehicle_id === vehicleId && item.is_active);
  const visibleVehicles =
    data?.items.filter((vehicle) => {
      if (!driverFilter) return true;
      const hasDriver = Boolean(currentAssignment(vehicle.id));
      return driverFilter === "with" ? hasDriver : !hasDriver;
    }) || [];
  return (
    <div className="bt-page bt-ops-page">
      <header className="bt-page-header">
        <div>
          <span className="bt-eyebrow">Bashkim Tours · Maarif</span>
          <h1>Automjetet</h1>
          <p>Krijimi i automjeteve dhe caktimi i shoferëve.</p>
        </div>
        <button className="bt-btn-primary" onClick={() => setEditing(empty)}>
          <Plus /> Shto automjet
        </button>
      </header>
      <div className="bt-list-panel">
        <div className="bt-admin-filters">
          <label>
            <Search />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              placeholder="Targat ose modeli…"
            />
          </label>
          <select
            value={active}
              onChange={(event) => {
                setActive(event.target.value);
              }}
          >
            <option value="">Të gjitha</option>
            <option value="true">Aktive</option>
            <option value="false">Joaktive</option>
          </select>
          <select
            value={driverFilter}
              onChange={(event) => {
                setDriverFilter(event.target.value);
              }}
          >
            <option value="">Të gjitha caktimet</option>
            <option value="with">Me shofer</option>
            <option value="without">Pa shofer</option>
          </select>
        </div>
        {loading ? (
          <div className="bt-state-message">
            <RefreshCw className="bt-spin" /> Duke ngarkuar…
          </div>
        ) : error ? (
          <p className="bt-inline-error">{error}</p>
        ) : (
          <>
            <div className="bt-vehicle-cards">
              {visibleVehicles.map((vehicle) => {
                const assignment = currentAssignment(vehicle.id);
                return (
                  <article key={vehicle.id}>
                    <div className="bt-vehicle-card-head">
                      <span>
                        <Bus />
                      </span>
                      <div>
                        <strong>{vehicle.plate_number}</strong>
                        <small>
                          {vehicle.model} ·{" "}
                          {vehicle.vehicle_type === "BUS"
                            ? "Autobus"
                            : "Furgon"}
                        </small>
                      </div>
                      <div className="bt-vehicle-card-actions">
                        <button
                          onClick={() =>
                            setEditing({
                              ...vehicle,
                              driver_id: assignment?.driver_id || "",
                              original_driver_id: assignment?.driver_id || "",
                              assignment_id: assignment?.id,
                            })
                          }
                        >
                          <Pencil />
                        </button>
                        <button
                          className="danger"
                          title="Fshije automjetin"
                          disabled={deletingId !== null}
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `A jeni të sigurt që dëshironi ta fshini automjetin ${vehicle.plate_number}? Ky veprim nuk mund të kthehet.`,
                              )
                            )
                              return;
                            const deletedVehicleId = vehicle.id;
                            setDeletingId(deletedVehicleId);
                            try {
                              await vehiclesApi.remove(deletedVehicleId);
                              await load();
                            } catch (requestError) {
                              setError(requestError.message);
                            } finally {
                              setDeletingId(null);
                            }
                          }}
                        >
                          {deletingId === vehicle.id ? (
                            <RefreshCw className="bt-spin" />
                          ) : (
                            <Trash2 />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="bt-vehicle-meta">
                      <span>
                        Ulëset<strong>{vehicle.total_seats}</strong>
                      </span>
                      <span>
                        Statusi
                        <strong>
                          {vehicle.is_active ? "Aktiv" : "Joaktiv"}
                        </strong>
                      </span>
                    </div>
                    <div className="bt-assigned-driver">
                      <UserRound />
                      <div>
                        <span>Shoferi aktual</span>
                        <strong>
                          {assignment
                            ? `${assignment.driver_first_name} ${assignment.driver_last_name}`
                            : "Pa shofer"}
                        </strong>
                        {assignment && (
                          <small>{assignment.driver_phone_number}</small>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
      {editing && (
        <Modal
          title={
            editing.id ? "Ndrysho automjetin dhe shoferin" : "Shto automjet"
          }
          onClose={() => setEditing()}
        >
          <VehicleForm
            initial={editing}
            drivers={drivers}
            onSaved={() => {
              setEditing();
              load();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function VehicleForm({ initial, drivers, onSaved }) {
  const [form, setForm] = useState({ ...empty, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (event) =>
    setForm({
      ...form,
      [key]:
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value,
    });
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        vehicle_type: form.vehicle_type,
        plate_number: form.plate_number,
        model: form.model,
        total_seats: Number(form.total_seats),
        is_active: form.is_active,
        comment: form.comment || null,
      };
      const vehicle = initial.id
        ? await vehiclesApi.update(initial.id, body)
        : await vehiclesApi.create(body);
      const driverChanged =
        String(form.driver_id || "") !==
        String(initial.original_driver_id || "");
      if (driverChanged && initial.assignment_id)
        await driverAssignmentsApi.end(initial.assignment_id, {
          assigned_to: today(),
          comment: "Caktimi u ndryshua nga faqja e automjetit",
        });
      if (driverChanged && form.driver_id)
        await driverAssignmentsApi.create({
          driver_id: Number(form.driver_id),
          vehicle_id: vehicle.id,
          assigned_from: today(),
          comment: null,
        });
      onSaved();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="bt-form-grid" onSubmit={submit}>
      <label>
        <span>Lloji</span>
        <select value={form.vehicle_type} onChange={set("vehicle_type")}>
          <option value="VAN">Furgon</option>
          <option value="BUS">Autobus</option>
        </select>
      </label>
      <label>
        <span>Targat</span>
        <input
          value={form.plate_number}
          onChange={set("plate_number")}
          required
        />
      </label>
      <label>
        <span>Modeli</span>
        <input value={form.model} onChange={set("model")} required />
      </label>
      <label>
        <span>Numri i ulëseve</span>
        <input
          type="number"
          min="1"
          value={form.total_seats}
          onChange={set("total_seats")}
          required
        />
      </label>
      <label>
        <span>Shoferi (opsional)</span>
        <select value={form.driver_id} onChange={set("driver_id")}>
          <option value="">Pa shofer</option>
          {drivers.map((driver) => (
            <option value={driver.id} key={driver.id}>
              {driver.first_name} {driver.last_name} · {driver.phone_number}
            </option>
          ))}
        </select>
      </label>
      <label className="bt-checkbox-field">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={set("is_active")}
        />
        <span>Automjet aktiv</span>
      </label>
      <label className="bt-field-wide">
        <span>Koment</span>
        <input value={form.comment || ""} onChange={set("comment")} />
      </label>
      {error && <p className="bt-inline-error bt-field-wide">{error}</p>}
      <div className="bt-modal-actions bt-field-wide">
        <button className="bt-btn-primary" disabled={saving}>
          {saving ? "Duke ruajtur…" : "Ruaj automjetin"}
        </button>
      </div>
    </form>
  );
}
