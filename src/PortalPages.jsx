import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Bus,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import {
  areasApi,
  authApi,
  calendarApi,
  driverAssignmentsApi,
  driversApi,
  duesApi,
  followupApi,
  maarifReportingApi,
  studentAssignmentsApi,
  studentsApi,
  vehiclesApi,
} from "./api";
import { monthSq } from "./locale";

const date = (v) => (v ? v.split("-").reverse().join("/") : "—");
const euro = new Intl.NumberFormat("sq-AL", {
  style: "currency",
  currency: "EUR",
});
const money = (v) => euro.format(Number(v || 0));
export function Modal({ title, onClose, children }) {
  return createPortal(
    <div
      className="bt-modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className="bt-modal bt-modal--wide">
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="bt-modal-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
const State = ({ loading, error }) =>
  loading ? (
    <div className="bt-state-message">
      <RefreshCw className="bt-spin" /> Duke ngarkuar…
    </div>
  ) : error ? (
    <div className="bt-state-message">
      <AlertTriangle />
      <p>{error}</p>
    </div>
  ) : null;
function Pager({ data, setPage }) {
  if (!data || data.total_pages <= 1) return null;
  return (
    <div className="bt-pager">
      <button disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>
        <ChevronLeft />
      </button>
      <span>
        Faqja {data.page} nga {data.total_pages} · {data.total} rezultate
      </span>
      <button
        disabled={data.page >= data.total_pages}
        onClick={() => setPage(data.page + 1)}
      >
        <ChevronRight />
      </button>
    </div>
  );
}

const configs = {
  areas: {
    title: "Zonat",
    singular: "zonë",
    api: areasApi,
    icon: MapPin,
    fields: [
      { k: "name", l: "Emri", req: 1 },
      { k: "base_monthly_price", l: "Çmimi mujor", type: "number", req: 1 },
      { k: "is_active", l: "Aktive", type: "check" },
      { k: "comment", l: "Koment" },
    ],
    cols: [
      ["name", "Zona"],
      ["base_monthly_price", "Çmimi", money],
      ["is_active", "Statusi", (v) => (v ? "Aktive" : "Joaktive")],
    ],
  },
  vehicles: {
    title: "Automjetet",
    singular: "automjet",
    api: vehiclesApi,
    icon: Bus,
    fields: [
      {
        k: "vehicle_type",
        l: "Lloji",
        type: "select",
        opts: [
          ["VAN", "Furgon"],
          ["BUS", "Autobus"],
        ],
      },
      { k: "plate_number", l: "Targat", req: 1 },
      { k: "model", l: "Modeli", req: 1 },
      { k: "total_seats", l: "Ulëset", type: "number", req: 1 },
      { k: "is_active", l: "Aktiv", type: "check" },
      { k: "comment", l: "Koment" },
    ],
    cols: [
      ["plate_number", "Targat"],
      ["model", "Modeli"],
      ["vehicle_type", "Lloji"],
      ["total_seats", "Ulëset"],
      ["is_active", "Statusi", (v) => (v ? "Aktiv" : "Joaktiv")],
    ],
  },
  drivers: {
    title: "Shoferët",
    singular: "shofer",
    api: driversApi,
    icon: Users,
    fields: [
      { k: "first_name", l: "Emri", req: 1 },
      { k: "last_name", l: "Mbiemri", req: 1 },
      { k: "phone_number", l: "Telefoni", req: 1 },
      { k: "is_active", l: "Aktiv", type: "check" },
      { k: "comment", l: "Koment" },
    ],
    cols: [
      ["first_name", "Shoferi", (_, x) => `${x.first_name} ${x.last_name}`],
      ["phone_number", "Telefoni"],
      ["is_active", "Statusi", (v) => (v ? "Aktiv" : "Joaktiv")],
    ],
  },
};
function ResourcePage({ type }) {
  const c = configs[type];
  const [data, setData] = useState();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [assignedDriverIds, setAssignedDriverIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    const resourceRequest = c.api.list({
      search,
      is_active: active,
      page:
        type === "areas" || (type === "drivers" && vehicleFilter) ? 1 : page,
      page_size:
        type === "areas" || (type === "drivers" && vehicleFilter) ? 100 : 20,
      sort_by: type === "areas" ? "name" : "created_at",
      sort_order: "asc",
    });
    const assignmentsRequest =
      type === "drivers"
        ? driverAssignmentsApi.list({
            is_active: true,
            page: 1,
            page_size: 100,
            sort_by: "assigned_from",
            sort_order: "desc",
          })
        : Promise.resolve({ items: [] });
    Promise.all([resourceRequest, assignmentsRequest])
      .then(([resourceData, assignmentData]) => {
        setData(resourceData);
        setAssignedDriverIds(
          new Set(assignmentData.items.map((item) => item.driver_id)),
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [c.api, search, active, vehicleFilter, page, type]);
  useEffect(load, [load]);
  const visibleItems =
    data?.items.filter((item) => {
      if (type !== "drivers" || !vehicleFilter) return true;
      const hasVehicle = assignedDriverIds.has(item.id);
      return vehicleFilter === "with" ? hasVehicle : !hasVehicle;
    }) || [];
  return (
    <Page
      title={c.title}
      subtitle="Kërkim, filtrim dhe menaxhim nga serveri."
      action={
        <button
          className="bt-btn-primary"
          onClick={() => setEdit({ is_active: true })}
        >
          <Plus /> Shto {c.singular}
        </button>
      }
    >
      <div className="bt-list-panel">
        <Filters
          search={search}
          setSearch={(v) => {
            setSearch(v);
            setPage(1);
          }}
          active={active}
          setActive={(v) => {
            setActive(v);
            setPage(1);
          }}
          assignmentFilter={type === "drivers" ? vehicleFilter : undefined}
          setAssignmentFilter={
            type === "drivers"
              ? (value) => {
                  setVehicleFilter(value);
                  setPage(1);
                }
              : undefined
          }
          assignmentLabels={
            type === "drivers"
              ? ["Të gjitha caktimet", "Me automjet", "Pa automjet"]
              : undefined
          }
        />
        <State loading={loading} error={error} />
        {data && (
          <>
            <table className="bt-data-table">
              <thead>
                <tr>
                  {c.cols.map((x) => (
                    <th key={x[0]}>{x[1]}</th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id}>
                    {c.cols.map(([k, , f]) => (
                      <td key={k}>{f ? f(item[k], item) : item[k] || "—"}</td>
                    ))}
                    <td>
                      <div className="bt-row-actions">
                        <button
                          className="bt-row-action"
                          title="Ndrysho"
                          onClick={() => setEdit(item)}
                        >
                          <Pencil />
                        </button>
                        <button
                          className="bt-row-action danger"
                          title="Fshije"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `A jeni të sigurt që dëshironi ta fshini këtë ${c.singular}? Ky veprim nuk mund të kthehet.`,
                              )
                            )
                              return;
                            try {
                              await c.api.remove(item.id);
                              await load();
                            } catch (requestError) {
                              setError(requestError.message);
                            }
                          }}
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {type !== "areas" && !vehicleFilter && (
              <Pager data={data} setPage={setPage} />
            )}
          </>
        )}
        {edit && (
          <Modal
            title={`${edit.id ? "Ndrysho" : "Shto"} ${c.singular}`}
            onClose={() => setEdit(null)}
          >
            <DynamicForm
              fields={c.fields}
              initial={edit}
              onSave={async (body) => {
                if (edit.id) await c.api.update(edit.id, body);
                else await c.api.create(body);
                setEdit(null);
                load();
              }}
            />
          </Modal>
        )}
      </div>
    </Page>
  );
}
function Filters({
  search,
  setSearch,
  active,
  setActive,
  assignmentFilter,
  setAssignmentFilter,
  assignmentLabels,
}) {
  return (
    <div className="bt-admin-filters">
      <label>
        <Search />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Kërko…"
        />
      </label>
      <select value={active} onChange={(e) => setActive(e.target.value)}>
        <option value="">Të gjitha</option>
        <option value="true">Aktive</option>
        <option value="false">Joaktive</option>
      </select>
      {setAssignmentFilter && (
        <select
          value={assignmentFilter}
          onChange={(e) => setAssignmentFilter(e.target.value)}
        >
          <option value="">{assignmentLabels[0]}</option>
          <option value="with">{assignmentLabels[1]}</option>
          <option value="without">{assignmentLabels[2]}</option>
        </select>
      )}
    </div>
  );
}
function DynamicForm({ fields, initial, onSave }) {
  const [form, setForm] = useState(() =>
    Object.fromEntries(
      fields.map((f) => [
        f.k,
        initial[f.k] ?? (f.type === "check" ? true : f.opts?.[0]?.[0] || ""),
      ]),
    ),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="bt-form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await onSave(form);
        } catch (x) {
          setError(x.message);
        } finally {
          setSaving(false);
        }
      }}
    >
      {fields.map((f) => (
        <label key={f.k}>
          <span>{f.l}</span>
          {f.type === "select" ? (
            <select
              value={form[f.k]}
              onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}
            >
              {f.opts.map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          ) : f.type === "check" ? (
            <input
              type="checkbox"
              checked={form[f.k]}
              onChange={(e) => setForm({ ...form, [f.k]: e.target.checked })}
            />
          ) : (
            <input
              type={f.type || "text"}
              required={f.req}
              value={form[f.k]}
              onChange={(e) =>
                setForm({
                  ...form,
                  [f.k]:
                    f.type === "number"
                      ? Number(e.target.value)
                      : e.target.value,
                })
              }
            />
          )}
        </label>
      ))}
      {error && <p className="bt-inline-error bt-field-wide">{error}</p>}
      <div className="bt-modal-actions bt-field-wide">
        <button className="bt-btn-primary" disabled={saving}>
          {saving ? "Duke ruajtur…" : "Ruaj"}
        </button>
      </div>
    </form>
  );
}
function Page({ title, subtitle, action, children }) {
  return (
    <div className="bt-page bt-ops-page">
      <header className="bt-page-header">
        <div>
          <span className="bt-eyebrow">Bashkim Tours · Maarif</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}
export const AreasPage = () => <ResourcePage type="areas" />;
export const VehiclesPage = () => <ResourcePage type="vehicles" />;
export const DriversPage = () => <ResourcePage type="drivers" />;

export function DashboardPage() {
  const [data, setData] = useState();
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      studentsApi.summary(),
      studentAssignmentsApi.summary(),
      duesApi.summary(),
      followupApi.summary(),
      maarifReportingApi.summary(),
    ])
      .then(([students, assignments, dues, followup, income]) =>
        setData({ students, assignments, dues, followup, income }),
      )
      .catch((e) => setError(e.message));
  }, []);
  if (!data)
    return (
      <Page title="Përmbledhje">
        <State loading={!error} error={error} />
      </Page>
    );
  const cards = [
    ["Nxënës aktivë", data.students.active_students, Users],
    ["Pa automjet", data.assignments.unassigned_active_students, Bus],
    ["Të paguara", data.dues.paid, Check],
    ["Në pritje", data.dues.pending, CalendarDays],
    ["Me vonesë", data.dues.overdue, AlertTriangle],
    ["Të bllokuar", data.dues.blocked, ShieldAlert],
    ["Paralajmërime", data.followup.first_warning_needed, Phone],
    ["Të hyra", money(data.income.total_income), Banknote],
  ];
  return (
    <Page
      title="Përmbledhje"
      subtitle="Të dhëna operative direkt nga përmbledhjet e serverit."
    >
      <section className="bt-dashboard-cards">
        {cards.map(([l, v, I]) => (
          <article key={l}>
            <I />
            <strong>{v ?? 0}</strong>
            <span>{l}</span>
          </article>
        ))}
      </section>
    </Page>
  );
}

export function IncomePage() {
  const [summary, setSummary] = useState();
  const [breakdowns, setBreakdowns] = useState([]);
  const [years, setYears] = useState([]);
  const [months, setMonths] = useState([]);
  const [yearId, setYearId] = useState("");
  const [monthId, setMonthId] = useState("");
  const [loadedCalendarYear, setLoadedCalendarYear] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    calendarApi
      .years({
        page: 1,
        page_size: 100,
        sort_by: "start_year",
        sort_order: "desc",
      })
      .then((yearData) => {
        setYears(yearData.items);
        setYearId(
          String(
            yearData.items.find((item) => item.is_active)?.id ||
              yearData.items[0]?.id ||
              "",
          ),
        );
        setReady(true);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);
  useEffect(() => {
    if (!ready || !yearId) return;
    calendarApi
      .calendar(yearId)
      .then((calendar) => {
        setMonths(
          calendar.semesters
            .flatMap((semester) => semester.months)
            .sort((a, b) => a.sequence - b.sequence),
        );
        setLoadedCalendarYear(String(yearId));
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [ready, yearId]);
  useEffect(() => {
    if (!ready || loadedCalendarYear !== String(yearId)) return;
    const common = {
      academic_year_id: yearId,
      academic_month_id: monthId,
    };
    Promise.all([
      maarifReportingApi.summary(common),
      maarifReportingApi.byUser(common),
      maarifReportingApi.byArea({
        academic_year_id: yearId,
        academic_month_id: monthId,
      }),
      yearId
        ? maarifReportingApi.byMonth({
            academic_year_id: yearId,
          })
        : Promise.resolve([]),
    ])
      .then(([summaryData, ...rest]) => {
        setSummary(summaryData);
        setBreakdowns(rest);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ready, yearId, monthId, months, loadedCalendarYear]);
  const reportSections = [
    {
      title: "Sipas zyrës",
      items: breakdowns[0] || [],
      label: (item) => item.username,
    },
    {
      title: "Sipas zonës",
      items: breakdowns[1] || [],
      label: (item) => item.area_name,
    },
    {
      title: "Sipas muajit akademik",
      items: monthId
        ? (breakdowns[2] || []).filter(
            (item) => String(item.academic_month_id) === monthId,
          )
        : breakdowns[2] || [],
      label: (item) =>
        `${monthSq(item.month, item.month_name)} ${item.calendar_year}`,
    },
  ];
  return (
    <Page
      title="Të hyrat"
      subtitle="Raporte të llogaritura nga transaksionet në backend."
    >
      <div className="bt-list-panel bt-income-filters">
        <div className="bt-admin-filters">
          <select
            value={yearId}
            onChange={(e) => {
              setLoading(true);
              setError("");
              setMonthId("");
              setYearId(e.target.value);
            }}
          >
            {years.map((year) => (
              <option value={year.id} key={year.id}>
                {year.name}
                {year.is_active ? " · Aktiv" : ""}
              </option>
            ))}
          </select>
          <select
            value={monthId}
            onChange={(e) => {
              setLoading(true);
              setError("");
              setMonthId(e.target.value);
            }}
          >
            <option value="">Të gjithë muajt / i gjithë viti</option>
            {months.map((month) => (
              <option value={month.id} key={month.id}>
                {monthSq(month.month, month.month_name)} {month.calendar_year}
              </option>
            ))}
          </select>
        </div>
      </div>
      <State loading={loading && !summary} error={error} />
      {summary && (
        <>
          <section className="bt-dashboard-cards bt-income-summary">
            <article>
              <Banknote />
              <strong>{money(summary.total_income)}</strong>
              <span>Gjithsej</span>
            </article>
            <article>
              <Check />
              <strong>{summary.payments_count}</strong>
              <span>Pagesa</span>
            </article>
          </section>
          {loading && (
            <div className="bt-state-message bt-income-refresh">
              <RefreshCw className="bt-spin" /> Duke përditësuar raportin…
            </div>
          )}
          <div className="bt-report-grid">
            {reportSections.map((section) => (
              <section key={section.title}>
                <h3>{section.title}</h3>
                {section.items.length ? (
                  <table className="bt-income-table">
                    <thead>
                      <tr>
                        <th>Emërtimi</th>
                        <th>Pagesa</th>
                        <th>Gjithsej</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.items.map((item, index) => (
                        <tr
                          key={
                            item.user_id ||
                            item.area_id ||
                            item.academic_month_id ||
                            item.payment_date ||
                            item.student_id ||
                            index
                          }
                        >
                          <td>{section.label(item)}</td>
                          <td>{item.payments_count}</td>
                          <td>
                            <strong>{money(item.total_income)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="bt-income-empty">
                    Nuk ka të dhëna për këta filtra.
                  </p>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </Page>
  );
}

export function CalendarPage() {
  const [years, setYears] = useState();
  const [calendar, setCalendar] = useState();
  const [error, setError] = useState("");
  const load = () =>
    calendarApi
      .years({
        page: 1,
        page_size: 20,
        sort_by: "start_year",
        sort_order: "desc",
      })
      .then(setYears)
      .catch((e) => setError(e.message));
  useEffect(load, []);
  const open = (id) =>
    calendarApi
      .calendar(id)
      .then(setCalendar)
      .catch((e) => setError(e.message));
  return (
    <Page
      title="Kalendari akademik"
      subtitle="Semestrat dhe muajt vijnë të grupuar nga backend-i."
      action={
        <button
          className="bt-btn-primary"
          onClick={async () => {
            const year = Number(prompt("Viti i fillimit, p.sh. 2026"));
            if (year) {
              await calendarApi.create({
                start_year: year,
                is_active: true,
                comment: null,
              });
              load();
            }
          }}
        >
          <Plus /> Vit i ri
        </button>
      }
    >
      <State loading={!years && !error} error={error} />
      {years && (
        <div className="bt-calendar-years">
          {years.items.map((y) => (
            <button
              className={y.is_active ? "active" : ""}
              key={y.id}
              onClick={() => open(y.id)}
            >
              <strong>{y.name}</strong>
              <span>{y.is_active ? "Aktiv" : "Joaktiv"}</span>
            </button>
          ))}
        </div>
      )}
      {calendar && (
        <div className="bt-semesters">
          {calendar.semesters.map((s) => (
            <section key={s.semester}>
              <h3>Semestri {s.semester}</h3>
              {s.months.map((m) => (
                <button
                  className={m.is_active ? "active" : ""}
                  key={m.id}
                  onClick={async () => {
                    await calendarApi.toggleMonth(m.id, !m.is_active);
                    open(calendar.academic_year.id);
                  }}
                >
                  {monthSq(m.month, m.month_name)}
                  <small>{m.calendar_year}</small>
                </button>
              ))}
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}

export function FleetPage() {
  const [capacities, setCap] = useState();
  const [assignments, setAssignments] = useState();
  useEffect(() => {
    studentAssignmentsApi.capacities().then(setCap);
    driverAssignmentsApi
      .list({ is_active: true, page: 1, page_size: 50 })
      .then(setAssignments);
  }, []);
  return (
    <Page
      title="Flota dhe caktimet"
      subtitle="Kapacitetet merren direkt nga endpoint-i i caktimeve."
    >
      <div className="bt-capacity-grid">
        {capacities?.map((v) => (
          <article key={v.vehicle_id}>
            <strong>{v.vehicle_plate_number}</strong>
            <span>{v.vehicle_model}</span>
            <div>
              <i style={{ width: `${v.occupancy_percentage}%` }} />
            </div>
            <b>
              {v.assigned_students}/{v.total_seats} · {v.available_seats} vende
              të lira
            </b>
          </article>
        ))}
      </div>
      <h2>Caktimet aktive shofer–automjet</h2>
      <div className="bt-followup-list">
        {assignments?.items.map((a) => (
          <article key={a.id}>
            <strong>
              {a.driver_first_name} {a.driver_last_name}
            </strong>
            <span>
              {a.vehicle_plate_number} · {a.vehicle_model}
            </span>
            <small>Prej {date(a.assigned_from)}</small>
          </article>
        ))}
      </div>
    </Page>
  );
}

export function AccountPage() {
  const [user, setUser] = useState();
  const [form, setForm] = useState({ current_password: "", new_password: "" });
  const [msg, setMsg] = useState("");
  useEffect(() => {
    authApi.me().then(setUser).catch((error) => setMsg(error.message));
  }, []);
  return (
    <Page
      title="Llogaria"
      subtitle={user ? `Kyçur si ${user.username}` : "Profili juaj"}
    >
      <form
        className="bt-account-card"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await authApi.changePassword(form);
            setMsg("Fjalëkalimi u ndryshua.");
            setForm({ current_password: "", new_password: "" });
          } catch (x) {
            setMsg(x.message);
          }
        }}
      >
        <h3>Ndrysho fjalëkalimin</h3>
        <label>
          Fjalëkalimi aktual
          <input
            type="password"
            value={form.current_password}
            onChange={(e) =>
              setForm({ ...form, current_password: e.target.value })
            }
            required
          />
        </label>
        <label>
          Fjalëkalimi i ri
          <input
            type="password"
            minLength="8"
            value={form.new_password}
            onChange={(e) => setForm({ ...form, new_password: e.target.value })}
            required
          />
        </label>
        {msg && <p>{msg}</p>}
        <button className="bt-btn-primary">Ndrysho</button>
      </form>
    </Page>
  );
}
