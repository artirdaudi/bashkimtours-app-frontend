import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bus,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  BadgeEuro,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  areasApi,
  driverAssignmentsApi,
  duesApi,
  paymentsApi,
  studentAssignmentsApi,
  studentsApi,
} from "./api";
import { Modal } from "./PortalPages";
import { monthSq } from "./locale";
import bashkimToursLogo from "./assets/bashkimtours_logo.png";
import DateInput from "./DateInput";
import { formatDateTime } from "./dateUtils";
import { groupRelatedPayments } from "./paymentGrouping";
const now = () => {
  const d = new Date(),
    o = d.getTimezoneOffset() * 60000;
  return new Date(d - o).toISOString().slice(0, 10);
};
const date = (v) => (v ? v.split("-").reverse().join("/") : "—");
const dateTime = formatDateTime;
const euro = new Intl.NumberFormat("sq-AL", {
  style: "currency",
  currency: "EUR",
});
const money = (v) => euro.format(Number(v || 0));
const assignedDriverName = (vehicleId, assignments = []) => {
  const assignment = assignments.find(
    (item) => item.vehicle_id === vehicleId && item.is_active,
  );
  return assignment
    ? `${assignment.driver_first_name} ${assignment.driver_last_name}`
    : "Pa shofer";
};
const dueStatus = (status) =>
  status === "PAID"
    ? "Paguar"
    : status === "PENDING"
      ? "Në pritje"
      : status === "OVERDUE"
        ? "Me vonesë"
        : "Bllokuar";
const dueColor = (due) => {
  if (due.status === "PAID") return "paid";
  const today = new Date();
  const dueMonth = Number(due.calendar_year) * 12 + Number(due.month);
  const currentMonth = today.getFullYear() * 12 + today.getMonth() + 1;
  return due.status === "OVERDUE" ||
    due.status === "BLOCKED" ||
    dueMonth <= currentMonth
    ? "unpaid"
    : "future";
};
function DueWarningSteps({ due, detailed = false }) {
  const steps = [
    ["P1", "Paralajmërimi 1", Boolean(due.first_warning_sent_at)],
    ["Zyrë", "Thirrja nga zyra", Boolean(due.office_call_completed_at)],
    ["Final", "Paralajmërimi final", Boolean(due.final_warning_sent_at)],
  ];
  return (
    <div className={`bt-due-warning-steps ${detailed ? "detailed" : ""}`}>
      {steps.map(([short, label, done]) => (
        <span
          className={done ? "done" : "pending"}
          title={`${label}: ${done ? "Kryer" : "Nuk është kryer"}`}
          key={short}
        >
          {detailed ? label : short} <b>{done ? "✓" : "—"}</b>
        </span>
      ))}
    </div>
  );
}
function SemesterDues({ dues, onSelect }) {
  const sorted = dues.slice().sort((a, b) => a.sequence - b.sequence);
  return (
    <div className="bt-semester-dues">
      {[1, 2].map((semester) => {
        const semesterDues = sorted.filter(
          (due) => Number(due.semester) === semester,
        );
        if (!semesterDues.length) return null;
        return (
          <section key={semester}>
            <small className="bt-semester-label">Semestri {semester}</small>
            <div>
              {semesterDues.map((due) => (
                <button
                  type="button"
                  className={`bt-month-pill ${dueColor(due)}`}
                  title={`${monthSq(due.month, due.month_name)} ${due.calendar_year} · ${dueStatus(due.status)} · ${money(due.amount_due)}`}
                  key={due.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(due);
                  }}
                >
                  <b>{monthSq(due.month, due.month_name)}</b>
                  <small>{due.calendar_year}</small>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
const driversDuringAssignment = (assignment, drivers = []) =>
  drivers.filter((driver) => {
    const assignmentEnd = assignment.assigned_to || "9999-12-31";
    const driverEnd = driver.assigned_to || "9999-12-31";
    return (
      driver.assigned_from <= assignmentEnd &&
      driverEnd >= assignment.assigned_from
    );
  });
const empty = {
  first_name: "",
  last_name: "",
  parent_name: "",
  parent_phone: "",
  address: "",
  area_id: "",
  custom_monthly_price: "",
  start_date: now(),
  status: "ACTIVE",
  comment: "",
};
function Badge({ value }) {
  return (
    <span className={`bt-due-status bt-due-${value?.toLowerCase()}`}>
      {value === "PAID"
        ? "Paguar"
        : value === "PENDING"
          ? "Në pritje"
          : value === "OVERDUE"
            ? "Me vonesë"
            : value === "BLOCKED"
              ? "Bllokuar"
              : value === "ACTIVE"
                ? "Aktiv"
                : "Joaktiv"}
    </span>
  );
}
function AnimatedCount({ value }) {
  const elementRef = useRef(null);
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;
    const target = Math.max(0, Number(value) || 0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.textContent = String(target);
      return undefined;
    }
    const duration = 650;
    const startedAt = performance.now();
    let frame;
    const animate = (time) => {
      const progress = Math.min((time - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = String(Math.round(target * eased));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    element.textContent = "0";
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);
  return (
    <strong ref={elementRef} aria-label={String(value)} aria-live="polite">
      0
    </strong>
  );
}
function MonthlyPaymentProgress({ icon: Icon, label, value, total, format, detail }) {
  const percentage = total
    ? Math.min(100, (Number(value) / Number(total)) * 100)
    : 0;
  return (
    <article className="bt-payment-progress-card">
      <div className="bt-payment-progress-icon"><Icon /></div>
      <div className="bt-payment-progress-content">
        <span>{label}</span>
        <strong>
          <small>{format(value)} nga</small>{" "}
          <b className="bt-payment-progress-total">{format(total)} gjithsej</b>
        </strong>
        <div className="bt-payment-progress-track">
          <i style={{ width: `${percentage}%` }} />
        </div>
        <footer><span>{detail}</span><b>{percentage.toFixed(0)}%</b></footer>
      </div>
    </article>
  );
}
const searchTerms = (value) =>
  value.trim().toLocaleLowerCase("sq-AL").split(/\s+/).filter(Boolean);
const includesAllTerms = (value, terms) => {
  const searchable = value.toLocaleLowerCase("sq-AL");
  return terms.every((term) => searchable.includes(term));
};
function SearchableFilter({
  label,
  icon: Icon,
  value,
  onChange,
  onSelect,
  onClear,
  options,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const terms = searchTerms(value);
  const visibleOptions = options.filter((option) =>
    includesAllTerms(
      `${option.label} ${option.description || ""}`,
      terms,
    ),
  );
  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  return (
    <div
      ref={containerRef}
      className={`bt-labeled-filter bt-searchable-filter ${open ? "is-open" : ""}`}
    >
      <span>{label}</span>
      <div>
        <Icon />
        <input
          aria-label={label}
          value={value}
          autoComplete="off"
          placeholder={`Kërko ose zgjidh ${label.toLocaleLowerCase("sq-AL")}…`}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
        />
        <button
          type="button"
          aria-label={`Hap listën për ${label.toLocaleLowerCase("sq-AL")}`}
          onClick={() => setOpen((current) => !current)}
        >
          <ChevronDown />
        </button>
      </div>
      {open && (
        <div className="bt-searchable-filter-menu">
          <header>
            <span>
              {visibleOptions.length}{" "}
              {visibleOptions.length === 1 ? "rezultat" : "rezultate"}
            </span>
            {value && (
            <button
              type="button"
              className="clear"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (onClear) onClear();
                else onChange("");
                setOpen(false);
              }}
            >
              <X /> Pastro
            </button>
            )}
          </header>
          <div className="bt-searchable-filter-options">
          {visibleOptions.length ? (
            visibleOptions.map((option) => {
              const selected = value === option.value;
              return (
                <button
                  type="button"
                  className={selected ? "selected" : ""}
                  key={option.key}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (onSelect) onSelect(option);
                    else onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="bt-searchable-option-icon"><Icon /></span>
                  <span className="bt-searchable-option-copy">
                    <strong>{option.label}</strong>
                    {option.description && <small>{option.description}</small>}
                  </span>
                  {selected && <Check className="bt-searchable-option-check" />}
                </button>
              );
            })
          ) : (
            <div className="bt-searchable-filter-empty">
              <Search />
              <strong>Nuk u gjet asnjë rezultat</strong>
              <span>Provoni një emër ose të dhënë tjetër.</span>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
function refineOverviewSearch(
  overview,
  search,
  driverAssignments = [],
  driverSearch = "",
  vehicleSearch = "",
) {
  const terms = searchTerms(search);
  const driverTerms = searchTerms(driverSearch);
  const vehicleTerms = searchTerms(vehicleSearch);
  if (!terms.length && !driverTerms.length && !vehicleTerms.length)
    return overview;
  const driverByVehicle = new Map(
    driverAssignments.map((assignment) => [assignment.vehicle_id, assignment]),
  );
  const students = overview.students.filter((student) => {
    const vehicle = student.current_vehicle;
    const driver = vehicle ? driverByVehicle.get(vehicle.vehicle_id) : null;
    const matchesStudent =
      !terms.length ||
      includesAllTerms(
        `${student.first_name} ${student.last_name} ${student.parent_name} ${student.parent_phone} ${student.student_code}`,
        terms,
      );
    const matchesDriver =
      !driverTerms.length ||
      (driver &&
        includesAllTerms(
          `${driver.driver_first_name} ${driver.driver_last_name} ${driver.driver_phone_number}`,
          driverTerms,
        ));
    const matchesVehicle =
      !vehicleTerms.length ||
      (vehicle &&
        includesAllTerms(
          `${vehicle.plate_number} ${vehicle.model} ${vehicle.vehicle_type}`,
          vehicleTerms,
        ));
    return matchesStudent && matchesDriver && matchesVehicle;
  });
  const today = new Date();
  const activeStudents = students.filter(
    (student) => student.status === "ACTIVE",
  );
  return {
    students,
    summary: {
      total_students: students.length,
      active_students: activeStudents.length,
      inactive_students: students.length - activeStudents.length,
      current_unpaid_students: activeStudents.filter((student) => {
        const due = student.monthly_dues.find(
          (item) =>
            Number(item.month) === today.getMonth() + 1 &&
            Number(item.calendar_year) === today.getFullYear(),
        );
        return due && due.status !== "PAID";
      }).length,
      current_paid_students: activeStudents.filter((student) => {
        const due = student.monthly_dues.find(
          (item) =>
            Number(item.month) === today.getMonth() + 1 &&
            Number(item.calendar_year) === today.getFullYear(),
        );
        return due?.status === "PAID";
      }).length,
      unassigned_active_students: activeStudents.filter(
        (student) => !student.current_vehicle,
      ).length,
    },
  };
}
export default function StudentsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState();
  const [summary, setSummary] = useState();
  const [academicMonths, setAcademicMonths] = useState([]);
  const [academicMonthId, setAcademicMonthId] = useState("");
  const [paymentOverviewOpen, setPaymentOverviewOpen] = useState(false);
  const [areas, setAreas] = useState([]);
  const [driverAssignments, setDriverAssignments] = useState([]);
  const [vehicleCapacities, setVehicleCapacities] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    area_id: "",
    student_status: "ACTIVE",
    sort_by: "created_at",
    sort_order: "desc",
  });
  const [selected, setSelected] = useState();
  const [editing, setEditing] = useState();
  const [assigning, setAssigning] = useState();
  const [paymentDue, setPaymentDue] = useState(null);
  const [printGroup, setPrintGroup] = useState(null);
  const [currentPaymentFilter, setCurrentPaymentFilter] = useState("");
  const [driverSearch, setDriverSearch] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [changingStatus, setChangingStatus] = useState("");
  const [draggedStudentId, setDraggedStudentId] = useState(null);
  const [dragTargetId, setDragTargetId] = useState(null);
  const [reorderingVehicleId, setReorderingVehicleId] = useState(null);
  const draggedStudentRef = useRef(null);
  const dragTargetRef = useRef(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const {
        student_status: selectedStatus,
        area_id: selectedArea,
        ...overviewFilters
      } = filters;
      delete overviewFilters.search;
      const response = await studentsApi.overview({
        ...overviewFilters,
      });
      const monthsById = new Map();
      response.students.forEach((student) =>
        student.monthly_dues.forEach((due) => {
          if (!monthsById.has(due.academic_month_id)) {
            monthsById.set(due.academic_month_id, {
              id: due.academic_month_id,
              month: due.month,
              month_name: due.month_name,
              calendar_year: due.calendar_year,
              sequence: due.sequence,
            });
          }
        }),
      );
      const availableMonths = [...monthsById.values()].sort(
        (left, right) =>
          Number(left.calendar_year) - Number(right.calendar_year) ||
          Number(left.month) - Number(right.month),
      );
      const currentDate = new Date();
      const currentMonth = availableMonths.find(
        (item) =>
          Number(item.month) === currentDate.getMonth() + 1 &&
          Number(item.calendar_year) === currentDate.getFullYear(),
      );
      setAcademicMonths(availableMonths);
      setAcademicMonthId((current) =>
        availableMonths.some((item) => String(item.id) === current)
          ? current
          : String(currentMonth?.id || availableMonths[0]?.id || ""),
      );
      const overview = refineOverviewSearch(
        {
          ...response,
          students: selectedArea
            ? response.students.filter(
                (student) => String(student.area_id) === String(selectedArea),
              )
            : response.students,
        },
        filters.search,
        driverAssignments,
        driverSearch,
        vehicleSearch,
      );
      const today = new Date();
      const currentPaidStudents = overview.students.filter((student) => {
        if (student.status !== "ACTIVE") return false;
        const due = student.monthly_dues.find(
          (item) =>
            Number(item.month) === today.getMonth() + 1 &&
            Number(item.calendar_year) === today.getFullYear(),
        );
        return due?.status === "PAID";
      }).length;
      setData({
        items: selectedStatus
          ? overview.students.filter(
              (student) => student.status === selectedStatus,
            )
          : overview.students,
        allItems: response.students,
      });
      setSummary({
        ...overview.summary,
        current_paid_students: currentPaidStudents,
      });
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setChangingStatus("");
    }
  }, [filters, driverAssignments, driverSearch, vehicleSearch]);
  const loadSupportingData = useCallback(async () => {
    try {
      const [areaData, capacities, driverData] = await Promise.all([
        areasApi.list({
          is_active: true,
          page: 1,
          page_size: 100,
          sort_by: "name",
          sort_order: "asc",
        }),
        studentAssignmentsApi.capacities(),
        driverAssignmentsApi.list({
          is_active: true,
          page: 1,
          page_size: 100,
          sort_by: "assigned_from",
          sort_order: "desc",
        }),
      ]);
      setAreas(areaData.items);
      setVehicleCapacities(capacities);
      setDriverAssignments(driverData.items);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);
  const refreshVehicleCapacities = useCallback(async () => {
    try {
      setVehicleCapacities(await studentAssignmentsApi.capacities());
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);
  useEffect(() => {
    const request = window.setTimeout(load, 0);
    return () => window.clearTimeout(request);
  }, [load]);
  useEffect(() => {
    const request = window.setTimeout(loadSupportingData, 0);
    return () => window.clearTimeout(request);
  }, [loadSupportingData]);
  useEffect(() => {
    if (!printGroup) return undefined;
    const finish = () => setPrintGroup(null);
    window.addEventListener("afterprint", finish, { once: true });
    const request = window.setTimeout(() => window.print(), 120);
    return () => {
      window.clearTimeout(request);
      window.removeEventListener("afterprint", finish);
    };
  }, [printGroup]);
  function printVehicleList(group) {
    setPrintGroup(group);
  }
  function beginRouteDrag(student, vehicleId) {
    if (!vehicleId || reorderingVehicleId) return;
    const value = { studentId: student.id, vehicleId };
    draggedStudentRef.current = value;
    dragTargetRef.current = student.id;
    setDraggedStudentId(student.id);
    setDragTargetId(student.id);
  }
  function updateRouteDragTarget(studentId, vehicleId) {
    if (draggedStudentRef.current?.vehicleId !== vehicleId) return;
    dragTargetRef.current = studentId;
    setDragTargetId(studentId);
  }
  function clearRouteDrag() {
    draggedStudentRef.current = null;
    dragTargetRef.current = null;
    setDraggedStudentId(null);
    setDragTargetId(null);
  }
  async function finishRouteDrag() {
    const dragged = draggedStudentRef.current;
    const targetId = dragTargetRef.current;
    clearRouteDrag();
    if (!dragged || !targetId || dragged.studentId === targetId || !data)
      return;

    const allVehicleStudents = (data.allItems || data.items)
      .filter(
        (student) =>
          student.current_vehicle?.vehicle_id === dragged.vehicleId,
      )
      .sort(
        (a, b) =>
          Number(a.current_vehicle?.route_order || 0) -
          Number(b.current_vehicle?.route_order || 0),
      );
    const visibleIds = new Set(
      data.items
        .filter(
          (student) =>
            student.current_vehicle?.vehicle_id === dragged.vehicleId,
        )
        .map((student) => student.id),
    );
    const visibleOrder = allVehicleStudents.filter((student) =>
      visibleIds.has(student.id),
    );
    const fromIndex = visibleOrder.findIndex(
      (student) => student.id === dragged.studentId,
    );
    const toIndex = visibleOrder.findIndex((student) => student.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = visibleOrder.splice(fromIndex, 1);
    visibleOrder.splice(toIndex, 0, moved);

    let visibleIndex = 0;
    const completeOrder = allVehicleStudents.map((student) =>
      visibleIds.has(student.id) ? visibleOrder[visibleIndex++] : student,
    );
    const orderByStudent = new Map(
      completeOrder.map((student, index) => [student.id, index + 1]),
    );
    const applyOrder = (students) =>
      students.map((student) => {
        const routeOrder = orderByStudent.get(student.id);
        return routeOrder
          ? {
              ...student,
              current_vehicle: {
                ...student.current_vehicle,
                route_order: routeOrder,
              },
            }
          : student;
      });

    setData((current) => ({
      ...current,
      items: applyOrder(current.items),
      allItems: applyOrder(current.allItems || current.items),
    }));
    setReorderingVehicleId(dragged.vehicleId);
    setError("");
    try {
      await studentAssignmentsApi.updateRouteOrder(
        dragged.vehicleId,
        completeOrder.map(
          (student) => student.current_vehicle.assignment_id,
        ),
      );
    } catch (requestError) {
      setError(`Renditja nuk u ruajt: ${requestError.message}`);
      await load();
    } finally {
      setReorderingVehicleId(null);
    }
  }
  async function openMonthlyDue(student, due) {
    if (due.status !== "PAID") return setPaymentDue({ due, student });
    setPaymentDue({ due, student, loadingPayment: true });
    try {
      const response = await paymentsApi.list({
        student_id: student.id,
        academic_month_id: due.academic_month_id,
        page: 1,
        page_size: 100,
        sort_by: "payment_date",
        sort_order: "desc",
      });
      const payment =
        response.items.find((item) => item.student_monthly_due_id === due.id) ||
        response.items[0] ||
        null;
      setPaymentDue({ due, student, payment });
    } catch (requestError) {
      setPaymentDue({ due, student, paymentError: requestError.message });
    }
  }
  const groups = useMemo(() => {
    if (!data) return [];
    const driverByVehicle = new Map(
      driverAssignments.map((item) => [item.vehicle_id, item]),
    );
    const grouped = new Map();
    const today = new Date();
    const students = currentPaymentFilter
      ? data.items.filter((student) => {
          if (student.status !== "ACTIVE") return false;
          const currentDue = student.monthly_dues.find(
            (due) =>
              Number(due.month) === today.getMonth() + 1 &&
              Number(due.calendar_year) === today.getFullYear(),
          );
          return currentPaymentFilter === "paid"
            ? currentDue?.status === "PAID"
            : currentDue && currentDue.status !== "PAID";
        })
      : data.items;
    students.forEach((student) => {
      const assignment = student.current_vehicle;
      const key = assignment ? String(assignment.vehicle_id) : "unassigned";
      if (!grouped.has(key))
        grouped.set(key, {
          key,
          plate: assignment?.plate_number || "Pa automjet",
          model: assignment?.model || "Nxënës pa caktim aktiv",
          vehicleType: assignment?.vehicle_type || null,
          driver: assignment
            ? driverByVehicle.get(assignment.vehicle_id)
            : null,
          students: [],
        });
      grouped.get(key).students.push(student);
    });
    grouped.forEach((group) => {
      if (group.key === "unassigned") return;
      group.students.sort(
        (a, b) =>
          Number(a.current_vehicle?.route_order || 0) -
          Number(b.current_vehicle?.route_order || 0),
      );
    });
    return [...grouped.values()].sort((a, b) =>
      a.key === "unassigned"
        ? -1
        : b.key === "unassigned"
          ? 1
          : a.plate.localeCompare(b.plate),
    );
  }, [data, currentPaymentFilter, driverAssignments]);
  const monthlyPaymentSummary = useMemo(() => {
    const students = (data?.allItems || data?.items || []).filter(
      (student) => student.status === "ACTIVE",
    );
    const dues = students
      .map((student) =>
        student.monthly_dues.find(
          (due) => String(due.academic_month_id) === academicMonthId,
        ),
      )
      .filter(Boolean);
    const paidDues = dues.filter((due) => due.status === "PAID");
    return {
      totalStudents: dues.length,
      paidStudents: paidDues.length,
      unpaidStudents: dues.length - paidDues.length,
      totalAmount: dues.reduce(
        (total, due) => total + Number(due.amount_due || 0),
        0,
      ),
      paidAmount: paidDues.reduce(
        (total, due) => total + Number(due.amount_due || 0),
        0,
      ),
    };
  }, [data, academicMonthId]);
  const selectedAcademicMonth = academicMonths.find(
    (academicMonth) => String(academicMonth.id) === academicMonthId,
  );
  return (
    <div className="bt-page bt-ops-page">
      {academicMonthId && (
        <section className="bt-payment-month-overview bt-students-payment-overview">
          <header
            className="bt-payment-overview-header"
            role="button"
            tabIndex={0}
            aria-expanded={paymentOverviewOpen}
            onClick={() => setPaymentOverviewOpen((current) => !current)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setPaymentOverviewOpen((current) => !current);
              }
            }}
          >
            <div>
              <span>PËRMBLEDHJA E MUAJIT</span>
              <h2>
                Gjendja e pagesave të nxënësve aktivë
                {selectedAcademicMonth
                  ? ` për ${monthSq(selectedAcademicMonth.month, selectedAcademicMonth.month_name)} ${selectedAcademicMonth.calendar_year}`
                  : ""}
              </h2>
            </div>
            <div className="bt-payment-overview-actions">
              <button
                type="button"
                className="bt-debts-link"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate("../debts");
                }}
              >
                Borxhet
              </button>
            </div>
          </header>
          <button
            type="button"
            className="bt-payment-overview-toggle"
            aria-expanded={paymentOverviewOpen}
            aria-label={paymentOverviewOpen ? "Mbyll përmbledhjen" : "Hap përmbledhjen"}
            title={paymentOverviewOpen ? "Mbyll përmbledhjen" : "Hap përmbledhjen"}
            onClick={(event) => {
              event.stopPropagation();
              setPaymentOverviewOpen((current) => !current);
            }}
          >
            {paymentOverviewOpen ? <ChevronUp /> : <ChevronDown />}
          </button>
          {paymentOverviewOpen && (
            <div className="bt-payment-overview-body">
              <div className="bt-payment-overview-month-filter">
                <label>
                  <CalendarDays />
                  <select
                    value={academicMonthId}
                    onChange={(event) => setAcademicMonthId(event.target.value)}
                  >
                    {academicMonths.map((academicMonth) => (
                      <option value={academicMonth.id} key={academicMonth.id}>
                        {monthSq(academicMonth.month, academicMonth.month_name)}{" "}
                        {academicMonth.calendar_year}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="bt-payment-month-metrics">
                <MonthlyPaymentProgress
                  icon={CheckCircle2}
                  label="Nxënës të paguar"
                  value={monthlyPaymentSummary.paidStudents}
                  total={monthlyPaymentSummary.totalStudents}
                  format={(value) => `${value} nxënës`}
                  detail={`${monthlyPaymentSummary.unpaidStudents} nxënës pa paguar`}
                />
                <MonthlyPaymentProgress
                  icon={BadgeEuro}
                  label="Shuma e arkëtuar"
                  value={monthlyPaymentSummary.paidAmount}
                  total={monthlyPaymentSummary.totalAmount}
                  format={money}
                  detail={`${money(monthlyPaymentSummary.totalAmount - monthlyPaymentSummary.paidAmount)} pa u arkëtuar`}
                />
              </div>
            </div>
          )}
        </section>
      )}

      <header className="bt-page-header">
        <div>
          <span className="bt-eyebrow">Bashkim Tours · Maarif</span>
          <h1>Nxënësit</h1>
          <p>Çmimet, zonat, transporti dhe detyrimet mujore.</p>
        </div>
        <button className="bt-btn-primary" onClick={() => setEditing(empty)}>
          <Plus /> Shto nxënës
        </button>
      </header>
      {summary && (
        <section className="bt-mini-stats">
          <button
            className={
              !currentPaymentFilter && filters.student_status === "ACTIVE"
                ? "active"
                : ""
            }
            disabled={Boolean(changingStatus)}
            onClick={() => {
              setChangingStatus("ACTIVE");
              setCurrentPaymentFilter("");
              setFilters({ ...filters, student_status: "ACTIVE" });
            }}
          >
            <AnimatedCount value={summary.active_students} />
            <span>{changingStatus === "ACTIVE" && <RefreshCw className="bt-spin" />}Aktivë</span>
          </button>
          <button
            className={
              !currentPaymentFilter && filters.student_status === "INACTIVE"
                ? "active"
                : ""
            }
            disabled={Boolean(changingStatus)}
            onClick={() => {
              setChangingStatus("INACTIVE");
              setCurrentPaymentFilter("");
              setFilters({ ...filters, student_status: "INACTIVE" });
            }}
          >
            <AnimatedCount value={summary.inactive_students} />
            <span>{changingStatus === "INACTIVE" && <RefreshCw className="bt-spin" />}Joaktivë</span>
          </button>
          <button
            className={currentPaymentFilter === "unpaid" ? "active" : ""}
            disabled={Boolean(changingStatus)}
            onClick={() => {
              setChangingStatus("UNPAID");
              setCurrentPaymentFilter("unpaid");
              setFilters({
                ...filters,
                search: "",
                area_id: "",
                student_status: "ACTIVE",
              });
            }}
          >
            <AnimatedCount value={summary.current_unpaid_students} />
            <span>{changingStatus === "UNPAID" && <RefreshCw className="bt-spin" />}Pa pagesën aktuale</span>
          </button>
          <button
            className={currentPaymentFilter === "paid" ? "active" : ""}
            disabled={Boolean(changingStatus)}
            onClick={() => {
              setChangingStatus("PAID");
              setCurrentPaymentFilter("paid");
              setFilters({
                ...filters,
                search: "",
                area_id: "",
                student_status: "ACTIVE",
              });
            }}
          >
            <AnimatedCount value={summary.current_paid_students} />
            <span>{changingStatus === "PAID" && <RefreshCw className="bt-spin" />}Paguar këtë muaj</span>
          </button>
        </section>
      )}
      <div className="bt-list-panel bt-students-list-panel">
        <div className="bt-admin-filters bt-student-filters">
          <label className="bt-labeled-filter">
            <span>Kërko nxënësin</span>
            <div>
              <Search />
              <input
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                placeholder="Emër, prind, telefon ose kod…"
              />
            </div>
          </label>
          <SearchableFilter
            label="Shoferi"
            icon={Search}
            value={driverSearch}
            onChange={setDriverSearch}
            onClear={() => {
              setDriverSearch("");
              setVehicleSearch("");
            }}
            onSelect={(option) => {
              setDriverSearch(option.value);
              setVehicleSearch(option.vehiclePlate);
            }}
            options={[
              ...new Map(
                driverAssignments.map((assignment) => [
                  assignment.driver_id,
                  {
                    key: assignment.driver_id,
                    value: `${assignment.driver_first_name} ${assignment.driver_last_name}`,
                    label: `${assignment.driver_first_name} ${assignment.driver_last_name}`,
                    description: assignment.driver_phone_number,
                    vehiclePlate: assignment.vehicle_plate_number,
                  },
                ]),
              ).values(),
            ]}
          />
          <SearchableFilter
            label="Automjeti"
            icon={Bus}
            value={vehicleSearch}
            onChange={setVehicleSearch}
            onClear={() => {
              setVehicleSearch("");
              setDriverSearch("");
            }}
            onSelect={(option) => {
              setVehicleSearch(option.value);
              setDriverSearch(option.driverName || "");
            }}
            options={vehicleCapacities.map((vehicle) => {
              const assignment = driverAssignments.find(
                (item) => item.vehicle_id === vehicle.vehicle_id,
              );
              return {
                key: vehicle.vehicle_id,
                value: vehicle.vehicle_plate_number,
                label: vehicle.vehicle_plate_number,
                description: assignment
                  ? `${vehicle.vehicle_model} · ${assignment.driver_first_name} ${assignment.driver_last_name}`
                  : `${vehicle.vehicle_model} · Pa shofer`,
                driverName: assignment
                  ? `${assignment.driver_first_name} ${assignment.driver_last_name}`
                  : "",
              };
            })}
          />
          <select
            value={filters.area_id}
            onChange={(e) =>
              setFilters({ ...filters, area_id: e.target.value })
            }
          >
            <option value="">Të gjitha zonat</option>
            {areas.map((a) => (
              <option value={a.id} key={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select
            value={filters.student_status}
            onChange={(e) => {
              setChangingStatus(e.target.value);
              setCurrentPaymentFilter("");
              setFilters({
                ...filters,
                student_status: e.target.value,
              });
            }}
          >
            <option value="">Të gjithë</option>
            <option value="ACTIVE">Aktivë</option>
            <option value="INACTIVE">Joaktivë</option>
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
            <div className="bt-vehicle-student-groups">
              {groups.map((group) => (
                <section
                  className={group.key === "unassigned" ? "unassigned" : ""}
                  key={group.key}
                >
                  <header>
                    <div className="bt-group-vehicle">
                      <Bus />
                      <span>
                        <strong>{group.plate}</strong>
                        <small>
                          {group.vehicleType
                            ? `${group.vehicleType === "VAN" ? "Kombi" : "Autobus"} · ${group.model}`
                            : group.model}
                        </small>
                      </span>
                    </div>
                    {group.key !== "unassigned" && (
                      <div className="bt-group-driver">
                        <span>
                          <small>Shoferi aktual</small>
                          <strong>
                            {group.driver
                              ? `${group.driver.driver_first_name} ${group.driver.driver_last_name}`
                              : "Pa shofer"}
                          </strong>
                          {group.driver && (
                            <a href={`tel:${group.driver.driver_phone_number}`}>
                              {group.driver.driver_phone_number}
                            </a>
                          )}
                        </span>
                      </div>
                    )}
                    <div className="bt-group-actions">
                      {reorderingVehicleId === Number(group.key) && (
                        <RefreshCw className="bt-spin bt-route-saving" />
                      )}
                      <b>{group.students.length} nxënës</b>
                      {group.key !== "unassigned" && (
                        <button
                          className="bt-btn-secondary bt-btn-small"
                          onClick={() => printVehicleList(group)}
                        >
                          <Printer /> Printo listën
                        </button>
                      )}
                    </div>
                  </header>
                  <div className="bt-student-month-list">
                    {group.students.map((s, index) => (
                      <article
                        className={`bt-student-month-row ${draggedStudentId === s.id ? "dragging" : ""} ${dragTargetId === s.id && draggedStudentId !== s.id ? "drag-target" : ""}`}
                        key={s.id}
                        data-student-id={s.id}
                        data-vehicle-id={s.current_vehicle?.vehicle_id || ""}
                        onDragOver={(event) => {
                          if (group.key === "unassigned") return;
                          event.preventDefault();
                          updateRouteDragTarget(s.id, Number(group.key));
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          finishRouteDrag();
                        }}
                        onClick={() => setSelected(s.id)}
                      >
                        <span className="bt-student-order">{index + 1}</span>
                        <span className="bt-route-drag-slot">
                          {group.key !== "unassigned" && (
                            <button
                              type="button"
                              className="bt-route-drag-handle"
                              title="Tërhiq për ta ndryshuar renditjen"
                              aria-label={`Ndrysho renditjen e ${s.first_name} ${s.last_name}`}
                              onClick={(event) => event.stopPropagation()}
                              onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                event.currentTarget.setPointerCapture(
                                  event.pointerId,
                                );
                                beginRouteDrag(s, Number(group.key));
                              }}
                              onPointerMove={(event) => {
                                if (!draggedStudentRef.current) return;
                                event.preventDefault();
                                const row = document
                                  .elementFromPoint(event.clientX, event.clientY)
                                  ?.closest(".bt-student-month-row");
                                if (row)
                                  updateRouteDragTarget(
                                    Number(row.dataset.studentId),
                                    Number(row.dataset.vehicleId),
                                  );
                              }}
                              onPointerUp={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (
                                  event.currentTarget.hasPointerCapture(
                                    event.pointerId,
                                  )
                                )
                                  event.currentTarget.releasePointerCapture(
                                    event.pointerId,
                                  );
                                finishRouteDrag();
                              }}
                              onPointerCancel={clearRouteDrag}
                            >
                              <GripVertical />
                            </button>
                          )}
                        </span>
                        <i
                          className={`bt-student-status-dot ${s.status.toLowerCase()}`}
                          title={s.status === "ACTIVE" ? "Aktiv" : "Joaktiv"}
                        />
                        <div className="bt-student-summary">
                          <strong>
                            {s.first_name} {s.last_name}
                          </strong>
                          <span>
                            {s.parent_name} · {s.parent_phone}
                          </span>
                          <small>
                            {s.area_name} · {money(s.effective_monthly_price)}
                          </small>
                        </div>
                        <SemesterDues
                          dues={s.monthly_dues}
                          onSelect={(due) => openMonthlyDue(s, due)}
                        />
                        <div className="bt-student-row-action">
                          {group.key === "unassigned" ? (
                            <button
                              className="bt-btn-secondary bt-btn-small"
                              disabled={s.status !== "ACTIVE"}
                              onClick={(event) => {
                                event.stopPropagation();
                                setAssigning(s);
                              }}
                            >
                              <Bus /> Cakto
                            </button>
                          ) : (
                            <ChevronRight />
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
      {editing && (
        <Modal
          title={editing.id ? "Ndrysho nxënësin" : "Shto nxënës"}
          onClose={() => setEditing()}
        >
          <StudentForm
            initial={editing}
            areas={areas}
            vehicleCapacities={vehicleCapacities}
            driverAssignments={driverAssignments}
            onSaved={() => {
              setEditing();
              load();
              refreshVehicleCapacities();
            }}
          />
        </Modal>
      )}
      {selected && (
        <StudentProfile
          id={selected}
          areas={areas}
          vehicleCapacities={vehicleCapacities}
          driverAssignments={driverAssignments}
          onClose={() => setSelected()}
          onChanged={() => {
            load();
            refreshVehicleCapacities();
          }}
          onDeleted={() => {
            setSelected();
            load();
            refreshVehicleCapacities();
          }}
        />
      )}
      {assigning && (
        <Modal
          title={`Cakto automjetin · ${assigning.first_name} ${assigning.last_name}`}
          onClose={() => setAssigning()}
        >
          <AssignVehicleForm
            student={assigning}
            vehicles={vehicleCapacities}
            driverAssignments={driverAssignments}
            onSaved={() => {
              setAssigning();
              load();
              refreshVehicleCapacities();
            }}
          />
        </Modal>
      )}
      {paymentDue && (
        <Modal
          title={`Pagesa · ${paymentDue.student.first_name} ${paymentDue.student.last_name}`}
          onClose={() => setPaymentDue(null)}
        >
          <MonthlyDuePaymentForm
            due={paymentDue.due}
            student={paymentDue.student}
            payment={paymentDue.payment}
            loadingPayment={paymentDue.loadingPayment}
            paymentError={paymentDue.paymentError}
            onSaved={() => {
              setPaymentDue(null);
              load();
            }}
          />
        </Modal>
      )}
      {printGroup && <VehicleGroupPrintSheet group={printGroup} />}
    </div>
  );
}
function MonthlyDuePaymentForm({
  due,
  student,
  payment,
  loadingPayment,
  paymentError,
  onSaved,
}) {
  const [paymentDate, setPaymentDate] = useState(now());
  const payableDues = student.monthly_dues
    .filter((item) => item.status !== "PAID")
    .sort((a, b) => a.sequence - b.sequence);
  const [selectedDueIds, setSelectedDueIds] = useState([due.id]);
  const [amounts, setAmounts] = useState(() =>
    Object.fromEntries(
      payableDues.map((item) => [item.id, String(item.amount_due)]),
    ),
  );
  const [comment, setComment] = useState("");
  const [showAdditionalMonths, setShowAdditionalMonths] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAmount, setSavingAmount] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  useEffect(() => {
    if (!receipt) return undefined;
    const finish = () => {
      setReceipt(null);
      onSaved();
    };
    window.addEventListener("afterprint", finish, { once: true });
    const request = window.setTimeout(() => window.print(), 120);
    return () => {
      window.clearTimeout(request);
      window.removeEventListener("afterprint", finish);
    };
  }, [receipt, onSaved]);
  async function saveCurrentAmount() {
    const amount = Number(amounts[due.id]);
    if (amounts[due.id] === "" || !Number.isFinite(amount) || amount < 0) {
      setError("Shkruani një shumë të vlefshme.");
      return;
    }
    if (amount === Number(due.amount_due)) return;
    setSavingAmount(true);
    setError("");
    try {
      await duesApi.updateAmount(due.id, {
        amount_due: amount,
        comment: comment.trim() || null,
      });
      onSaved();
    } catch (requestError) {
      setError(requestError.message);
      setSavingAmount(false);
    }
  }
  async function payAndPrint() {
    if (due.status === "PAID") return;
    const selectedDues = payableDues.filter((item) =>
      selectedDueIds.includes(item.id),
    );
    if (!selectedDues.length)
      return setError("Zgjidhni të paktën një muaj për pagesë.");
    const invalidAmount = selectedDues.some((item) => {
      const value = Number(amounts[item.id]);
      return amounts[item.id] === "" || !Number.isFinite(value) || value < 0;
    });
    if (invalidAmount) return setError("Shkruani shuma të vlefshme.");
    setSaving(true);
    setError("");
    try {
      const createdPayments = [];
      for (const selectedDue of selectedDues) {
        const paymentAmount = Number(amounts[selectedDue.id]);
        if (paymentAmount !== Number(selectedDue.amount_due)) {
          await duesApi.updateAmount(selectedDue.id, {
            amount_due: paymentAmount,
            comment: comment.trim() || null,
          });
        }
        createdPayments.push(
          await paymentsApi.create(selectedDue.id, {
            payment_date: paymentDate,
            comment: comment.trim() || null,
          }),
        );
      }
      setReceipt(createdPayments);
    } catch (requestError) {
      setError(requestError.message);
      setSaving(false);
    }
  }
  return (
    <form
      className="bt-payment-due-form"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className={`bt-payment-due-summary ${dueColor(due)}`}>
        <div>
          <small>Muaji</small>
          <strong>
            {monthSq(due.month, due.month_name)} {due.calendar_year}
          </strong>
        </div>
        <div>
          <small>Shuma</small>
          <strong>{money(due.amount_due)}</strong>
        </div>
        <div>
          <small>Statusi</small>
          <strong>{dueStatus(due.status)}</strong>
        </div>
        {dueColor(due) === "unpaid" && (
          <div className="bt-payment-warning-summary">
            <small>Paralajmërimet</small>
            <DueWarningSteps due={due} detailed />
          </div>
        )}
      </div>
      {due.status !== "PAID" && (
        <>
          {!showAdditionalMonths && (
            <label>
              <span>Shuma për këtë muaj</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amounts[due.id]}
                onChange={(event) =>
                  setAmounts((current) => ({
                    ...current,
                    [due.id]: event.target.value,
                  }))
                }
                required
              />
              {Number(amounts[due.id]) !== Number(due.amount_due) && (
                <div className="bt-amount-change-actions">
                  <small className="bt-amount-change-note">
                    Detyrimi do të ndryshohet nga {money(due.amount_due)} në{" "}
                    {money(amounts[due.id])} vetëm për këtë muaj.
                  </small>
                  <button
                    type="button"
                    className="bt-btn-secondary"
                    disabled={savingAmount || saving}
                    onClick={saveCurrentAmount}
                  >
                    {savingAmount ? "Duke ruajtur…" : "Ruaj shumën pa pagesë"}
                  </button>
                </div>
              )}
            </label>
          )}
          <button
            type="button"
            className="bt-add-months-toggle"
            onClick={() => setShowAdditionalMonths((visible) => !visible)}
          >
            {showAdditionalMonths
              ? "Mbyll zgjedhjen e muajve"
              : selectedDueIds.length > 1
                ? `Ndrysho muajt (${selectedDueIds.length} të zgjedhur)`
                : "+ Shto muaj të tjerë në këtë pagesë"}
          </button>
          {showAdditionalMonths && (
            <section className="bt-multi-month-payment">
            <div className="bt-multi-month-heading">
              <div>
                <strong>Muajt për pagesë</strong>
                <small>Zgjidhni një ose më shumë muaj.</small>
              </div>
              <strong>
                Totali: {money(
                  payableDues
                    .filter((item) => selectedDueIds.includes(item.id))
                    .reduce(
                      (total, item) => total + Number(amounts[item.id] || 0),
                      0,
                    ),
                )}
              </strong>
            </div>
            <div className="bt-multi-month-list">
              {payableDues.map((item) => {
                const checked = selectedDueIds.includes(item.id);
                return (
                  <label className={checked ? "selected" : ""} key={item.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedDueIds((current) =>
                          current.includes(item.id)
                            ? current.filter((id) => id !== item.id)
                            : [...current, item.id],
                        )
                      }
                    />
                    <span>
                      <strong>
                        {monthSq(item.month, item.month_name)} {item.calendar_year}
                      </strong>
                      <small>{dueStatus(item.status)}</small>
                    </span>
                    <input
                      aria-label={`Shuma për ${monthSq(item.month, item.month_name)}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={amounts[item.id]}
                      disabled={!checked}
                      onChange={(event) =>
                        setAmounts((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                );
              })}
            </div>
            </section>
          )}
          {!showAdditionalMonths && selectedDueIds.length > 1 && (
            <div className="bt-selected-months-compact">
              <span>{selectedDueIds.length} muaj të zgjedhur</span>
              <strong>
                {money(
                  payableDues
                    .filter((item) => selectedDueIds.includes(item.id))
                    .reduce(
                      (total, item) => total + Number(amounts[item.id] || 0),
                      0,
                    ),
                )}
              </strong>
            </div>
          )}
          <label>
            <span>Data e pagesës</span>
            <DateInput
              value={paymentDate}
              onChange={setPaymentDate}
              required
            />
            <small>{date(paymentDate)}</small>
          </label>
          <label>
            <span>Koment (opsional)</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows="3"
            />
            <small>Komenti ruhet te secila pagesë e zgjedhur.</small>
          </label>
        </>
      )}
      {due.status === "PAID" && (
        <section className="bt-payment-record-details">
          {loadingPayment ? (
            <p>
              <RefreshCw className="bt-spin" /> Duke ngarkuar të dhënat e
              pagesës…
            </p>
          ) : paymentError ? (
            <p className="bt-inline-error">{paymentError}</p>
          ) : payment ? (
            <>
              <div>
                <small>Shuma e paguar</small>
                <strong>{money(payment.amount)}</strong>
              </div>
              <div>
                <small>Data e pagesës</small>
                <strong>{date(payment.payment_date)}</strong>
              </div>
              <div>
                <small>Regjistruar nga</small>
                <strong>{payment.created_by_username}</strong>
              </div>
              <div>
                <small>Komenti</small>
                <strong>{payment.comment || "Pa koment"}</strong>
              </div>
            </>
          ) : (
            <p>Nuk u gjet transaksioni i kësaj pagese.</p>
          )}
        </section>
      )}
      {error && <p className="bt-inline-error">{error}</p>}
      <div className="bt-modal-actions">
        {due.status === "PAID" ? (
          <span className="bt-paid-message">Kjo pagesë është regjistruar.</span>
        ) : (
          <div className="bt-payment-submit-buttons">
            <button
              type="button"
              className="bt-btn-primary"
              disabled={saving}
              onClick={payAndPrint}
            >
              <Printer /> Paguaj dhe printo vërtetimin
            </button>
          </div>
        )}
      </div>
      {receipt && <PaymentReceipt payments={receipt} />}
    </form>
  );
}

export function PaymentReceipt({ payment, payments }) {
  const receiptPayments = payments || [payment];
  const firstPayment = receiptPayments[0];
  const comments = [...new Set(receiptPayments.map((item) => item.comment).filter(Boolean))];
  const totalAmount = receiptPayments.reduce(
    (total, item) => total + Number(item.amount || 0),
    0,
  );
  return (
    <div className="bt-print-sheet bt-payment-receipt">
      <header>
        <img src={bashkimToursLogo} alt="Bashkim Tours" />
        <div>
          <strong>Bashkim Tours</strong>
          <span>Dervish Cara Nr. 4 · 1200 Tetovë, Maqedoni</span>
          <span>+389 44 338 003 · +389 75 312 015</span>
        </div>
      </header>
      <div className="bt-print-title">
        <div>
          <h1>Vërtetim pagese</h1>
          <p>
            {receiptPayments.length === 1
              ? `Nr. i pagesës: ${firstPayment.id}`
              : `${receiptPayments.length} pagesa · Nr. ${receiptPayments.map((item) => item.id).join(", ")}`}
          </p>
        </div>
        <span>Printuar më {date(now())}</span>
      </div>
      <section className="bt-receipt-section">
        <h2>Të dhënat e nxënësit</h2>
        <div className="bt-receipt-student">
          <div>
            <small>Emri dhe mbiemri</small>
            <strong>
              {firstPayment.student_first_name} {firstPayment.student_last_name}
            </strong>
          </div>
          <div>
            <small>Prindi</small>
            <strong>{firstPayment.parent_name}</strong>
          </div>
          <div>
            <small>Telefoni</small>
            <strong>{firstPayment.parent_phone}</strong>
          </div>
          <div>
            <small>Zona</small>
            <strong>{firstPayment.area_name}</strong>
          </div>
        </div>
      </section>
      <section className="bt-receipt-section">
        <h2>Të dhënat e pagesës</h2>
        <div className="bt-receipt-payment">
          <div className="amount">
            <small>Shuma e paguar</small>
            <strong>{money(totalAmount)}</strong>
          </div>
          <div>
            <small>Numri i muajve</small>
            <strong>{receiptPayments.length}</strong>
          </div>
          <div>
            <small>Data e pagesës</small>
            <strong>{date(firstPayment.payment_date)}</strong>
          </div>
          <div className="comment">
            <small>Komenti</small>
            <strong>{comments.join(" · ") || "Pa koment"}</strong>
          </div>
        </div>
        <table className="bt-receipt-months">
          <thead>
            <tr><th>Muaji</th><th>Semestri</th><th>Shuma</th></tr>
          </thead>
          <tbody>
            {receiptPayments.map((item) => (
              <tr key={item.id}>
                <td>{monthSq(item.month, item.month_name)} {item.calendar_year}</td>
                <td>{item.semester}</td>
                <td>{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="bt-receipt-user">
        <small>Pagesa u pranua dhe u regjistrua nga</small>
        <strong>{firstPayment.created_by_username}</strong>
        <span>{dateTime(firstPayment.created_at)}</span>
      </section>
      <div className="bt-receipt-signatures">
        <span>Nënshkrimi i pranuesit</span>
        <span>Nënshkrimi i paguesit</span>
      </div>
      <footer>
        <span>bashkimtours.com · instagram.com/bashkim_tours_official</span>
        <strong>Bashkim Tours</strong>
      </footer>
    </div>
  );
}

function VehicleGroupPrintSheet({ group }) {
  return (
    <div className="bt-print-sheet bt-vehicle-group-print">
      <header>
        <img src={bashkimToursLogo} alt="Bashkim Tours" />
        <div>
          <strong>Bashkim Tours</strong>
          <span>Dervish Cara Nr. 4 · 1200 Tetovë, Maqedoni</span>
          <span>+389 44 338 003 · +389 75 312 015</span>
        </div>
      </header>
      <div className="bt-print-title">
        <div>
          <h1>Lista aktuale e nxënësve</h1>
          <p>
            {group.plate} · {group.vehicleType === "VAN" ? "Kombi" : "Autobus"}{" "}
            · {group.model}
          </p>
        </div>
        <span>Printuar më {date(now())}</span>
      </div>
      <table className="bt-print-vehicle-details">
        <tbody>
          <tr>
            <th>Automjeti</th>
            <td>
              {group.plate} · {group.model}
            </td>
            <th>Lloji</th>
            <td>{group.vehicleType === "VAN" ? "Kombi" : "Autobus"}</td>
          </tr>
          <tr>
            <th>Shoferi aktual</th>
            <td>
              {group.driver
                ? `${group.driver.driver_first_name} ${group.driver.driver_last_name}`
                : "Pa shofer"}
            </td>
            <th>Telefoni</th>
            <td>{group.driver?.driver_phone_number || "—"}</td>
          </tr>
        </tbody>
      </table>
      <section className="bt-print-section">
        <h2>
          Lista e nxënësve <span>{group.students.length} nxënës</span>
        </h2>
        <table className="bt-print-student-list">
          <thead>
            <tr>
              <th>Nr.</th>
              <th>Nxënësi</th>
              <th>Telefoni</th>
              <th>Adresa</th>
            </tr>
          </thead>
          <tbody>
            {group.students.map((student, index) => (
              <tr key={student.id}>
                <td>{index + 1}</td>
                <td>
                  <strong>
                    {student.first_name} {student.last_name}
                  </strong>
                </td>
                <td>
                  <strong>{student.parent_phone}</strong>
                </td>
                <td>
                  <strong>{student.address || "—"}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <footer>
        <span>bashkimtours.com · instagram.com/bashkim_tours_official</span>
        <strong>Bashkim Tours</strong>
      </footer>
    </div>
  );
}

function AssignVehicleForm({
  student,
  vehicles,
  driverAssignments,
  onSaved,
}) {
  const availableVehicles = vehicles.filter(
    (vehicle) => vehicle.available_seats > 0,
  );
  const [vehicleId, setVehicleId] = useState(
    availableVehicles[0]?.vehicle_id || "",
  );
  const [assignedFrom, setAssignedFrom] = useState(now());
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (!vehicleId) return setError("Nuk ka automjet me vende të lira.");
    setSaving(true);
    setError("");
    try {
      await studentAssignmentsApi.create({
        student_id: student.id,
        vehicle_id: Number(vehicleId),
        assigned_from: assignedFrom,
        comment: comment.trim() || null,
      });
      onSaved();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }
  return (
    <form className="bt-form-grid" onSubmit={submit}>
      <label className="bt-field-wide">
        <span>Kombi / Autobusi</span>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          disabled={!availableVehicles.length}
          required
        >
          {!availableVehicles.length && (
            <option value="">Nuk ka automjet me vende të lira</option>
          )}
          {availableVehicles.map((vehicle) => (
            <option value={vehicle.vehicle_id} key={vehicle.vehicle_id}>
              {vehicle.vehicle_plate_number} · {vehicle.vehicle_model} ·{" "}
              Shoferi: {assignedDriverName(vehicle.vehicle_id, driverAssignments)} ·{" "}
              {vehicle.available_seats} vende të lira
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Data e caktimit</span>
        <DateInput
          value={assignedFrom}
          onChange={setAssignedFrom}
          required
        />
        <small className="bt-field-help">{date(assignedFrom)}</small>
      </label>
      <label>
        <span>Koment (opsional)</span>
        <input value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      {error && <p className="bt-inline-error bt-field-wide">{error}</p>}
      <div className="bt-modal-actions bt-field-wide">
        <button
          className="bt-btn-primary"
          disabled={saving || !availableVehicles.length}
        >
          {saving ? "Duke ruajtur…" : "Cakto automjetin"}
        </button>
      </div>
    </form>
  );
}
function StudentForm({
  initial,
  areas,
  vehicleCapacities,
  driverAssignments,
  onSaved,
}) {
  const [form, setForm] = useState({
    ...empty,
    ...initial,
    custom_monthly_price: initial.custom_monthly_price ?? "",
    vehicle_id: "",
  });
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    const body = {
      first_name: form.first_name,
      last_name: form.last_name,
      parent_name: form.parent_name,
      parent_phone: form.parent_phone,
      address: form.address,
      area_id: Number(form.area_id),
      custom_monthly_price:
        form.custom_monthly_price === ""
          ? null
          : Number(form.custom_monthly_price),
      start_date: form.start_date,
      status: form.status,
      comment: form.comment || null,
    };
    try {
      if (initial.id) await studentsApi.update(initial.id, body);
      else {
        const student = await studentsApi.create(body);
        if (form.vehicle_id) {
          await studentAssignmentsApi.create({
            student_id: student.id,
            vehicle_id: Number(form.vehicle_id),
            assigned_from: form.start_date,
            comment: "Caktuar gjatë krijimit të nxënësit",
          });
        }
      }
      onSaved();
    } catch (x) {
      setError(x.message);
    }
  }
  return (
    <form className="bt-form-grid" onSubmit={submit}>
      {[
        ["first_name", "Emri"],
        ["last_name", "Mbiemri"],
        ["parent_name", "Prindi"],
        ["parent_phone", "Telefoni"],
        ["address", "Adresa"],
      ].map(([k, l]) => (
        <label key={k}>
          <span>{l}</span>
          <input value={form[k]} onChange={set(k)} required />
        </label>
      ))}
      <label>
        <span>Zona</span>
        <select value={form.area_id} onChange={set("area_id")} required>
          <option value="">Zgjidh zonën</option>
          {areas.map((a) => (
            <option value={a.id} key={a.id}>
              {a.name} · {money(a.base_monthly_price)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Çmimi personal (bosh=zona, 0=pa pagesë)</span>
        <input
          type="number"
          min="0"
          value={form.custom_monthly_price}
          onChange={set("custom_monthly_price")}
        />
      </label>
      <label>
        <span>Data e fillimit</span>
        <DateInput
          value={form.start_date}
          onChange={(value) => setForm({ ...form, start_date: value })}
          required
        />
      </label>
      <label>
        <span>Statusi</span>
        <select value={form.status} onChange={set("status")}>
          <option value="ACTIVE">Aktiv</option>
          <option value="INACTIVE">Joaktiv</option>
        </select>
      </label>
      {!initial.id && (
        <label className="bt-field-wide">
          <span>Automjeti (opsional)</span>
          <select value={form.vehicle_id} onChange={set("vehicle_id")}>
            <option value="">Pa automjet — caktoje më vonë</option>
            {vehicleCapacities.map((vehicle) => (
              <option
                value={vehicle.vehicle_id}
                key={vehicle.vehicle_id}
                disabled={vehicle.available_seats <= 0}
              >
                {vehicle.vehicle_plate_number} · {vehicle.vehicle_model} ·{" "}
                Shoferi: {assignedDriverName(vehicle.vehicle_id, driverAssignments)} ·{" "}
                {vehicle.available_seats > 0
                  ? `${vehicle.available_seats} vende të lira`
                  : "I mbushur"}
              </option>
            ))}
          </select>
          <small className="bt-field-help">
            Kapaciteti verifikohet përsëri nga backend-i gjatë ruajtjes.
          </small>
        </label>
      )}
      <label className="bt-field-wide">
        <span>Koment</span>
        <input value={form.comment || ""} onChange={set("comment")} />
      </label>
      {error && <p className="bt-inline-error bt-field-wide">{error}</p>}
      <div className="bt-modal-actions bt-field-wide">
        <button className="bt-btn-primary">Ruaj</button>
      </div>
    </form>
  );
}
function VehicleAssignmentEditor({
  student,
  current,
  vehicles,
  driverAssignments,
  onSaved,
}) {
  const canAssignVehicle = student.status === "ACTIVE";
  const choices = canAssignVehicle
    ? vehicles.filter(
        (item) =>
          item.available_seats > 0 && item.vehicle_id !== current?.vehicle_id,
      )
    : [];
  const [vehicleId, setVehicleId] = useState(choices[0]?.vehicle_id || "");
  const [moveDate, setMoveDate] = useState(now());
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (!vehicleId && !current)
      return setError("Nuk ka automjet me vende të lira.");
    setSaving(true);
    setError("");
    try {
      if (current && !vehicleId)
        await studentAssignmentsApi.end(current.id, {
          assigned_to: moveDate,
          comment: comment.trim() || "Nxënësi u la pa automjet",
        });
      else if (current)
        await studentAssignmentsApi.move(student.id, {
          vehicle_id: Number(vehicleId),
          move_date: moveDate,
          comment: comment.trim() || null,
        });
      else
        await studentAssignmentsApi.create({
          student_id: student.id,
          vehicle_id: Number(vehicleId),
          assigned_from: moveDate,
          comment: comment.trim() || null,
        });
      onSaved();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }
  return (
    <form className="bt-profile-vehicle-editor bt-form-grid" onSubmit={submit}>
      <label className="bt-field-wide">
        <span>Automjeti i ri</span>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
        >
          {current && <option value="">Pa automjet</option>}
          {!current && !choices.length && (
            <option value="">Nuk ka automjet me vende të lira</option>
          )}
          {choices.map((item) => (
            <option value={item.vehicle_id} key={item.vehicle_id}>
              {item.vehicle_plate_number} · {item.vehicle_model} ·{" "}
              Shoferi: {assignedDriverName(item.vehicle_id, driverAssignments)} ·{" "}
              {item.available_seats} vende të lira
            </option>
          ))}
        </select>
        {current && !vehicleId && (
          <small className="bt-field-help">
            Caktimi aktual do të përfundojë dhe do të ruhet në historik.
          </small>
        )}
        {!canAssignVehicle && current && (
          <small className="bt-field-help">
            Nxënësi joaktiv mund të lihet pa automjet, por nuk mund të caktohet
            në një automjet tjetër.
          </small>
        )}
      </label>
      <label>
        <span>{current ? "Data e ndërrimit" : "Data e caktimit"}</span>
        <DateInput
          value={moveDate}
          onChange={setMoveDate}
          required
        />
        <small className="bt-field-help">{date(moveDate)}</small>
      </label>
      <label>
        <span>Koment (opsional)</span>
        <input value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      {error && <p className="bt-inline-error bt-field-wide">{error}</p>}
      <div className="bt-modal-actions bt-field-wide">
        <button
          className="bt-btn-primary"
          disabled={saving || (!current && !choices.length)}
        >
          {saving
            ? "Duke ruajtur…"
            : current && !vehicleId
              ? "Lëre pa automjet"
              : current
              ? "Ndrysho automjetin"
              : "Cakto automjetin"}
        </button>
      </div>
    </form>
  );
}
export function StudentProfile({
  id,
  areas,
  vehicleCapacities,
  driverAssignments,
  onClose,
  onChanged,
  onDeleted,
}) {
  const [student, setStudent] = useState();
  const [payments, setPayments] = useState([]);
  const [vehicle, setVehicle] = useState(null);
  const [vehicleHistory, setVehicleHistory] = useState([]);
  const [driversByVehicle, setDriversByVehicle] = useState({});
  const [editingProfile, setEditingProfile] = useState(false);
  const [changingVehicle, setChangingVehicle] = useState(false);
  const [printSection, setPrintSection] = useState("");
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [deletingPaymentGroup, setDeletingPaymentGroup] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(
    () =>
      Promise.all([
        studentsApi.get(id),
        paymentsApi.list({
          student_id: id,
          page: 1,
          page_size: 100,
          sort_by: "payment_date",
          sort_order: "desc",
        }),
        studentAssignmentsApi.current(id).catch(() => null),
        studentAssignmentsApi.list({
          student_id: id,
          page: 1,
          page_size: 100,
          sort_by: "assigned_from",
          sort_order: "desc",
        }),
      ])
        .then(async ([s, p, v, history]) => {
          const vehicleIds = [
            ...new Set(
              [
                ...history.items.map((item) => item.vehicle_id),
                v?.vehicle_id,
              ].filter(Boolean),
            ),
          ];
          const driverHistory = await Promise.all(
            vehicleIds.map(async (vehicleId) => [
              vehicleId,
              await driverAssignmentsApi.list({
                vehicle_id: vehicleId,
                page: 1,
                page_size: 100,
                sort_by: "assigned_from",
                sort_order: "desc",
              }),
            ]),
          );
          setStudent(s);
          setPayments(p.items);
          setVehicle(v);
          setVehicleHistory(history.items);
          setDriversByVehicle(
            Object.fromEntries(
              driverHistory.map(([vehicleId, response]) => [
                vehicleId,
                response.items,
              ]),
            ),
          );
        })
        .catch((e) => setError(e.message)),
    [id],
  );
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!printSection) return undefined;
    const finish = () => setPrintSection("");
    window.addEventListener("afterprint", finish, { once: true });
    const request = window.setTimeout(() => window.print(), 120);
    return () => {
      window.clearTimeout(request);
      window.removeEventListener("afterprint", finish);
    };
  }, [printSection]);
  useEffect(() => {
    if (!receiptPayment) return undefined;
    const finish = () => setReceiptPayment(null);
    window.addEventListener("afterprint", finish, { once: true });
    const request = window.setTimeout(() => window.print(), 120);
    return () => {
      window.clearTimeout(request);
      window.removeEventListener("afterprint", finish);
    };
  }, [receiptPayment]);
  const currentDriver = vehicle
    ? (driversByVehicle[vehicle.vehicle_id] || []).find(
        (item) => item.is_active,
      )
    : null;
  const paymentGroups = useMemo(() => groupRelatedPayments(payments), [payments]);
  async function deletePaymentGroup(group) {
    const months = group.payments
      .map((payment) => monthSq(payment.month, payment.month_name))
      .join(", ");
    const confirmed = window.confirm(
      `A jeni të sigurt që dëshironi ta fshini këtë pagesë${group.payments.length > 1 ? ` me ${group.payments.length} muaj` : ""}?\n\nMuajt: ${months}\nShuma: ${money(group.totalAmount)}\n\nPas fshirjes, detyrimet mujore përkatëse do të rikthehen në statusin Në pritje.`,
    );
    if (!confirmed) return;
    setDeletingPaymentGroup(group.key);
    setError("");
    try {
      await Promise.all(
        group.payments.map((payment) => paymentsApi.remove(payment.id)),
      );
      await load();
      onChanged();
    } catch (requestError) {
      setError(requestError.message);
      await load();
      onChanged();
    } finally {
      setDeletingPaymentGroup("");
    }
  }
  return (
    <Modal
      title={
        student
          ? `${student.first_name} ${student.last_name}`
          : "Profili i nxënësit"
      }
      onClose={onClose}
    >
      {!student ? (
        <div className="bt-state-message">
          <RefreshCw className="bt-spin" />
          {error}
        </div>
      ) : (
        <>
          <div className="bt-profile-actionbar">
            <Badge value={student.status} />
            <div className="bt-profile-top-actions">
              <button
                className="bt-btn-secondary"
                onClick={() => setPrintSection("profile")}
              >
                <Printer /> Printo profilin
              </button>
              <button
                className="bt-btn-secondary"
                onClick={() => setEditingProfile(!editingProfile)}
              >
                <Pencil />{" "}
                {editingProfile ? "Mbyll ndryshimin" : "Ndrysho të dhënat"}
              </button>
              <button
                className="bt-btn-danger"
                onClick={async () => {
                  if (
                    !window.confirm(
                      `A jeni të sigurt që dëshironi ta fshini nxënësin ${student.first_name} ${student.last_name}? Ky veprim nuk mund të kthehet.`,
                    )
                  )
                    return;
                  try {
                    await studentsApi.remove(student.id);
                    onDeleted();
                  } catch (requestError) {
                    const message = requestError.message || "";
                    setError(
                      /is in use/i.test(message)
                        ? "Nxënësi nuk mund të fshihet sepse përdoret ende nga caktimet, detyrimet ose pagesat. Përfundo fillimisht caktimin aktiv të automjetit. Nëse gabimi vazhdon, backend-i nuk lejon fshirjen e një nxënësi me histori të ruajtur."
                        : message,
                    );
                  }
                }}
              >
                <Trash2 /> Fshije
              </button>
            </div>
          </div>
          {editingProfile ? (
            <section className="bt-profile-edit-section">
              <StudentForm
                initial={student}
                areas={areas}
                vehicleCapacities={vehicleCapacities}
                driverAssignments={driverAssignments}
                onSaved={() => {
                  setEditingProfile(false);
                  load();
                  onChanged();
                }}
              />
            </section>
          ) : (
            <section className="bt-profile-info-grid">
              <article>
                <small>Nxënësi</small>
                <strong>
                  {student.first_name} {student.last_name}
                </strong>
                <span>Filloi më {date(student.start_date)}</span>
              </article>
              <article>
                <small>Prindi / Telefoni</small>
                <strong>{student.parent_name}</strong>
                <a href={`tel:${student.parent_phone}`}>
                  {student.parent_phone}
                </a>
              </article>
              <article>
                <small>Adresa / Zona</small>
                <strong>{student.area_name}</strong>
                <span>{student.address || "Pa adresë"}</span>
              </article>
              <article>
                <small>Pagesa mujore</small>
                <strong>{money(student.effective_monthly_price)}</strong>
                <span>
                  {student.custom_monthly_price === null
                    ? "Çmimi bazë i zonës"
                    : student.custom_monthly_price === 0
                      ? "Pa pagesë"
                      : "Çmim personal"}
                </span>
              </article>
              {student.comment && (
                <article className="wide">
                  <small>Koment</small>
                  <span>{student.comment}</span>
                </article>
              )}
            </section>
          )}
          <section className="bt-profile-transport">
            <div className="bt-profile-vehicle">
              <Bus />
              <div>
                <span>Automjeti aktual</span>
                <strong>
                  {vehicle
                    ? `${vehicle.vehicle_plate_number} · ${vehicle.vehicle_type === "VAN" ? "Kombi" : "Autobus"} · ${vehicle.vehicle_model}`
                    : "Nuk është caktuar"}
                </strong>
                {vehicle && (
                  <small>Caktuar më {date(vehicle.assigned_from)}</small>
                )}
                {vehicle &&
                  (() => {
                    const driver = (
                      driversByVehicle[vehicle.vehicle_id] || []
                    ).find((item) => item.is_active);
                    return driver ? (
                      <span className="bt-current-driver">
                        Shoferi:{" "}
                        <strong>
                          {driver.driver_first_name} {driver.driver_last_name}
                        </strong>{" "}
                        ·{" "}
                        <a href={`tel:${driver.driver_phone_number}`}>
                          {driver.driver_phone_number}
                        </a>
                      </span>
                    ) : (
                      <span className="bt-current-driver">Pa shofer aktiv</span>
                    );
                  })()}
              </div>
            </div>
            <button
              className="bt-btn-secondary"
              disabled={student.status !== "ACTIVE" && !vehicle}
              onClick={() => setChangingVehicle(!changingVehicle)}
            >
              <Bus />{" "}
              {student.status !== "ACTIVE" && vehicle
                ? "Lëre pa automjet"
                : vehicle
                  ? "Ndrysho automjetin"
                  : "Cakto automjet"}
            </button>
          </section>
          {changingVehicle && (
            <VehicleAssignmentEditor
              student={student}
              current={vehicle}
              vehicles={vehicleCapacities}
              driverAssignments={driverAssignments}
              onSaved={() => {
                setChangingVehicle(false);
                load();
                onChanged();
              }}
            />
          )}
          <section className="bt-vehicle-history-section">
            <div className="bt-section-heading">
              <div>
                <h3>Historiku i automjeteve</h3>
                <p>{vehicleHistory.length} caktime gjithsej</p>
              </div>
            </div>
            {vehicleHistory.length ? (
              <div className="bt-history-table-wrap">
                <table className="bt-history-table">
                  <thead>
                    <tr>
                      <th>Automjeti</th>
                      <th>Shoferi</th>
                      <th>Periudha</th>
                      <th>Statusi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleHistory.map((assignment) => {
                      const assignedDrivers = driversDuringAssignment(
                        assignment,
                        driversByVehicle[assignment.vehicle_id],
                      );
                      return (
                        <tr key={assignment.id}>
                          <td>
                            <strong>{assignment.vehicle_plate_number}</strong>
                            <small>
                              {assignment.vehicle_model} ·{" "}
                              {assignment.vehicle_type === "VAN"
                                ? "Kombi"
                                : "Autobus"}
                            </small>
                            {assignment.comment && (
                              <small>{assignment.comment}</small>
                            )}
                          </td>
                          <td>
                            {assignedDrivers.length ? (
                              assignedDrivers.map((driver) => (
                                <span key={driver.id}>
                                  <strong>
                                    {driver.driver_first_name}{" "}
                                    {driver.driver_last_name}
                                  </strong>
                                  <a href={`tel:${driver.driver_phone_number}`}>
                                    {driver.driver_phone_number}
                                  </a>
                                </span>
                              ))
                            ) : (
                              <small>Pa të dhëna</small>
                            )}
                          </td>
                          <td>
                            <strong>{date(assignment.assigned_from)}</strong>
                            <small>
                              deri më{" "}
                              {assignment.assigned_to
                                ? date(assignment.assigned_to)
                                : "sot"}
                            </small>
                          </td>
                          <td>
                            <span
                              className={`bt-table-status ${assignment.is_active ? "active" : "ended"}`}
                            >
                              {assignment.is_active ? "Aktual" : "Përfunduar"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="bt-empty-inline">
                Ky nxënës nuk ka histori të caktimit në automjete.
              </p>
            )}
          </section>
          {error && <p className="bt-inline-error">{error}</p>}
          <div className="bt-section-heading">
            <div>
              <h3>Historiku i pagesave</h3>
              <p>{paymentGroups.length} pagesa · {payments.length} muaj</p>
            </div>
            {payments.length > 0 && (
              <button
                className="bt-btn-secondary"
                onClick={() => setPrintSection("payments")}
              >
                <Printer /> Printo të gjitha pagesat
              </button>
            )}
          </div>
          {payments.length ? (
            <div className="bt-history-table-wrap">
              <table className="bt-history-table">
                <thead>
                  <tr>
                    <th>Muaji</th>
                    <th>Shuma</th>
                    <th>Data e pagesës</th>
                    <th>Regjistruar nga</th>
                    <th>Komenti</th>
                    <th aria-label="Veprimet"></th>
                  </tr>
                </thead>
                <tbody>
                  {paymentGroups.map((group) => {
                    const p = group.firstPayment;
                    return (
                    <tr key={group.key}>
                      <td>
                        <strong>{group.payments.map((item) => monthSq(item.month, item.month_name)).join(", ")}</strong>
                        <small>{[...new Set(group.payments.map((item) => item.calendar_year))].join(", ")}</small>
                      </td>
                      <td>
                        <strong>{money(group.totalAmount)}</strong>
                        {group.payments.length > 1 && <small>{group.payments.length} muaj të paguar së bashku</small>}
                      </td>
                      <td>{date(p.payment_date)}</td>
                      <td>{p.created_by_username}</td>
                      <td>{p.comment || "—"}</td>
                      <td>
                        <div className="bt-history-row-actions">
                        <button
                          className="bt-history-print-button"
                          title="Printo vërtetimin"
                          aria-label={`Printo vërtetimin për ${monthSq(p.month, p.month_name)}`}
                          onClick={() => setReceiptPayment(group.payments)}
                        >
                          <Printer />
                        </button>
                        <button
                          className="bt-history-delete-button"
                          title="Fshije pagesën"
                          aria-label={`Fshije pagesën për ${group.payments.map((item) => monthSq(item.month, item.month_name)).join(", ")}`}
                          disabled={deletingPaymentGroup === group.key}
                          onClick={() => deletePaymentGroup(group)}
                        >
                          {deletingPaymentGroup === group.key ? (
                            <RefreshCw className="bt-spin" />
                          ) : (
                            <Trash2 />
                          )}
                        </button>
                        </div>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="bt-empty-inline">Nuk ka pagesa të regjistruara.</p>
          )}
          {printSection && (
            <StudentPrintSheet
              type={printSection}
              student={student}
              vehicle={vehicle}
              currentDriver={currentDriver}
              vehicleHistory={vehicleHistory}
              driversByVehicle={driversByVehicle}
              payments={payments}
            />
          )}
          {receiptPayment && <PaymentReceipt payments={receiptPayment} />}
        </>
      )}
    </Modal>
  );
}

function StudentPrintSheet({
  type,
  student,
  vehicle,
  currentDriver,
  vehicleHistory,
  driversByVehicle,
  payments,
}) {
  const paymentGroups = groupRelatedPayments(payments);
  const title =
    type === "profile"
      ? "Profili i nxënësit"
      : type === "vehicles"
        ? "Historiku i automjeteve"
        : "Historiku i pagesave";
  return (
    <div className="bt-print-sheet">
      <header>
        <img src={bashkimToursLogo} alt="Bashkim Tours" />
        <div>
          <strong>Bashkim Tours</strong>
          <span>Dervish Cara Nr. 4 · 1200 Tetovë, Maqedoni</span>
          <span>+389 44 338 003 · +389 75 312 015</span>
        </div>
      </header>
      <div className="bt-print-title">
        <div>
          <h1>{title}</h1>
          <p>
            {student.first_name} {student.last_name}
          </p>
        </div>
        <span>Printuar më {date(now())}</span>
      </div>
      {type === "profile" && (
        <>
          <table>
            <tbody>
              <tr>
                <th>Emri dhe mbiemri</th>
                <td>
                  {student.first_name} {student.last_name}
                </td>
                <th>Statusi</th>
                <td>{student.status === "ACTIVE" ? "Aktiv" : "Joaktiv"}</td>
              </tr>
              <tr>
                <th>Prindi</th>
                <td>{student.parent_name}</td>
                <th>Telefoni</th>
                <td>{student.parent_phone}</td>
              </tr>
              <tr>
                <th>Zona</th>
                <td>{student.area_name}</td>
                <th>Adresa</th>
                <td>{student.address || "—"}</td>
              </tr>
              <tr>
                <th>Çmimi mujor</th>
                <td>{money(student.effective_monthly_price)}</td>
                <th>Data e fillimit</th>
                <td>{date(student.start_date)}</td>
              </tr>
              <tr>
                <th>Automjeti aktual</th>
                <td>
                  {vehicle
                    ? `${vehicle.vehicle_plate_number} · ${vehicle.vehicle_model}`
                    : "Pa automjet"}
                </td>
                <th>Shoferi aktual</th>
                <td>
                  {currentDriver
                    ? `${currentDriver.driver_first_name} ${currentDriver.driver_last_name} · ${currentDriver.driver_phone_number}`
                    : "Pa shofer"}
                </td>
              </tr>
            </tbody>
          </table>
          {student.comment && (
            <p className="bt-print-comment">
              <strong>Koment:</strong> {student.comment}
            </p>
          )}
        </>
      )}
      {(type === "profile" || type === "vehicles") && (
        <section className="bt-print-section">
          {type === "profile" && (
            <h2>
              Historiku i automjeteve{" "}
              <span>{vehicleHistory.length} caktime</span>
            </h2>
          )}
          <table>
            <thead>
              <tr>
                <th>Automjeti</th>
                <th>Shoferi</th>
                <th>Periudha</th>
                <th>Statusi</th>
              </tr>
            </thead>
            <tbody>
              {vehicleHistory.map((assignment) => {
                const drivers = driversDuringAssignment(
                  assignment,
                  driversByVehicle[assignment.vehicle_id],
                );
                return (
                  <tr key={assignment.id}>
                    <td>
                      {assignment.vehicle_plate_number} ·{" "}
                      {assignment.vehicle_model}
                    </td>
                    <td>
                      {drivers.length
                        ? drivers
                            .map(
                              (driver) =>
                                `${driver.driver_first_name} ${driver.driver_last_name} · ${driver.driver_phone_number}`,
                            )
                            .join("; ")
                        : "Pa të dhëna"}
                    </td>
                    <td>
                      {date(assignment.assigned_from)} —{" "}
                      {assignment.assigned_to
                        ? date(assignment.assigned_to)
                        : "Sot"}
                    </td>
                    <td>{assignment.is_active ? "Aktual" : "Përfunduar"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      {(type === "profile" || type === "payments") && (
        <section className="bt-print-section">
          {type === "profile" && (
            <h2>
              Historiku i pagesave <span>{paymentGroups.length} pagesa · {payments.length} muaj</span>
            </h2>
          )}
          <table>
            <thead>
              <tr>
                <th>Muaji</th>
                <th>Shuma</th>
                <th>Data</th>
                <th>Regjistruar nga</th>
                <th>Komenti</th>
              </tr>
            </thead>
            <tbody>
              {paymentGroups.map((group) => {
                const payment = group.firstPayment;
                return (
                <tr key={group.key}>
                  <td>
                    {group.payments.map((item) => `${monthSq(item.month, item.month_name)} ${item.calendar_year}`).join(", ")}
                  </td>
                  <td>{money(group.totalAmount)}</td>
                  <td>{date(payment.payment_date)}</td>
                  <td>{payment.created_by_username}</td>
                  <td>{payment.comment || "—"}</td>
                </tr>
              );})}
            </tbody>
          </table>
        </section>
      )}
      <footer>
        <span>bashkimtours.com · instagram.com/bashkim_tours_official</span>
        <strong>Bashkim Tours</strong>
      </footer>
    </div>
  );
}
