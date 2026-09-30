import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeEuro, RefreshCw, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { studentsApi } from "./api";
import { monthSq } from "./locale";
import { StudentProfile } from "./StudentsPage";

const euro = new Intl.NumberFormat("sq-AL", {
  style: "currency",
  currency: "EUR",
});
const money = (value) => euro.format(Number(value || 0));

const isDueUpToCurrentMonth = (due) => {
  const today = new Date();
  const dueMonth = Number(due.calendar_year) * 12 + Number(due.month);
  const currentMonth = today.getFullYear() * 12 + today.getMonth() + 1;
  return dueMonth <= currentMonth;
};

export default function StudentDebtsPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const areas = useMemo(() => [...new Map(students.map((student) => [student.area_id, {
    id: student.area_id, name: student.area_name,
    base_monthly_price: student.area_base_monthly_price,
  }])).values()].sort((a, b) => a.name.localeCompare(b.name, "sq")), [students]);
  const driverAssignments = useMemo(() => [...new Map(students
    .map((student) => student.current_vehicle)
    .filter((vehicle) => vehicle?.driver_id)
    .map((vehicle) => [vehicle.vehicle_id, {
      vehicle_id: vehicle.vehicle_id,
      driver_first_name: vehicle.driver_first_name,
      driver_last_name: vehicle.driver_last_name,
    }])).values()], [students]);

  const loadStudents = useCallback(async () => {
    try {
      const response = await studentsApi.overview({
        sort_by: "first_name",
        sort_order: "asc",
      });
      setStudents(response.students);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const request = window.setTimeout(loadStudents, 0);
    return () => window.clearTimeout(request);
  }, [loadStudents]);

  function openStudentProfile(studentId) { setSelectedStudentId(studentId); }

  const debts = useMemo(
    () =>
      students
        .map((student) => {
          const unpaidDues = student.monthly_dues
            .filter(
              (due) => due.status !== "PAID" && isDueUpToCurrentMonth(due),
            )
            .sort(
              (left, right) =>
                Number(left.calendar_year) - Number(right.calendar_year) ||
                Number(left.month) - Number(right.month),
            );
          return {
            student,
            unpaidDues,
            total: unpaidDues.reduce(
              (sum, due) => sum + Number(due.amount_due || 0),
              0,
            ),
          };
        })
        .filter((entry) => entry.unpaidDues.length)
        .sort((left, right) => right.total - left.total),
    [students],
  );

  const totalDebt = debts.reduce((sum, entry) => sum + entry.total, 0);

  return (
    <div className="bt-page bt-ops-page bt-debts-page">
      <header className="bt-page-header">
        <div>
          <span className="bt-eyebrow">Bashkim Tours · Maarif</span>
          <h1>Borxhet</h1>
          <p>Të gjithë nxënësit me muaj të papaguar deri në muajin aktual.</p>
        </div>
        <button className="bt-btn-secondary" onClick={() => navigate("../students")}>
          <ArrowLeft /> Kthehu te nxënësit
        </button>
      </header>

      {!loading && !error && (
        <section className="bt-debts-summary">
          <article>
            <UserRound />
            <span>Nxënës me borxhe</span>
            <strong>{debts.length}</strong>
          </article>
          <article>
            <BadgeEuro />
            <span>Borxhi i përgjithshëm</span>
            <strong>{money(totalDebt)}</strong>
          </article>
        </section>
      )}

      {loading ? (
        <div className="bt-state-message">
          <RefreshCw className="bt-spin" /> Duke ngarkuar borxhet…
        </div>
      ) : error ? (
        <p className="bt-inline-error">{error}</p>
      ) : debts.length ? (
        <div className="bt-debts-list">
          {debts.map(({ student, unpaidDues, total }) => (
            <article
              className="bt-debt-student"
              key={student.id}
              role="button"
              tabIndex={0}
              onClick={() => openStudentProfile(student.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openStudentProfile(student.id);
                }
              }}
            >
              <div className="bt-debt-student-main">
                <div>
                  <span>NXËNËSI</span>
                  <h2>{student.first_name} {student.last_name}</h2>
                  <p>
                    {student.student_code} · {student.area_name} ·{" "}
                    <b className={`bt-debt-student-status ${student.status.toLowerCase()}`}>
                      {student.status === "ACTIVE" ? "Aktiv" : "Joaktiv"}
                    </b>
                  </p>
                </div>
                <div className="bt-debt-contact">
                  <span>Prindi / kujdestari</span>
                  <strong>{student.parent_name}</strong>
                  <small>{student.parent_phone}</small>
                </div>
                <div className="bt-debt-total">
                  <span>Gjithsej</span>
                  <strong>{money(total)}</strong>
                </div>
              </div>
              <div className="bt-debt-months">
                <span>Muajt e papaguar</span>
                <div>
                  {unpaidDues.map((due) => (
                    <span className={`bt-debt-month bt-debt-${due.status.toLowerCase()}`} key={due.id}>
                      <b>{monthSq(due.month, due.month_name)} {due.calendar_year}</b>
                      <small>{money(due.amount_due)}</small>
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="bt-empty-state">
          <BadgeEuro />
          <h3>Nuk ka borxhe</h3>
          <p>Të gjithë nxënësit i kanë pagesat në rregull.</p>
        </div>
      )}
      {selectedStudentId && (
        <StudentProfile
          id={selectedStudentId}
          overviewStudent={students.find((student) => student.id === selectedStudentId)}
          areas={areas}
          driverAssignments={driverAssignments}
          onClose={() => setSelectedStudentId(null)}
          onChanged={loadStudents}
          onDeleted={() => {
            setSelectedStudentId(null);
            loadStudents();
          }}
        />
      )}
    </div>
  );
}
