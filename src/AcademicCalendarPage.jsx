import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Check, Plus, RefreshCw } from "lucide-react";
import { calendarApi } from "./api";
import { monthSq } from "./locale";

export default function AcademicCalendarPage() {
  const [years, setYears] = useState([]);
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [startYear, setStartYear] = useState(new Date().getFullYear());

  const openCalendar = useCallback(async (id) => {
    setError("");
    try {
      setCalendar(await calendarApi.calendar(id));
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await calendarApi.years({
        page: 1,
        page_size: 100,
        sort_by: "start_year",
        sort_order: "desc",
      });
      setYears(response.items);
      if (response.items.length) {
        const selected =
          response.items.find((year) => year.is_active) || response.items[0];
        await openCalendar(selected.id);
      } else setCalendar(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [openCalendar]);

  // Initial server synchronization for the calendar route.
  useEffect(() => {
    const request = window.setTimeout(load, 0);
    return () => window.clearTimeout(request);
  }, [load]);

  async function createYear(event) {
    event.preventDefault();
    setError("");
    try {
      await calendarApi.create({
        start_year: Number(startYear),
        is_active: years.length === 0,
        comment: null,
      });
      setCreating(false);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function activateYear() {
    if (!calendar || calendar.academic_year.is_active) return;
    try {
      await calendarApi.update(calendar.academic_year.id, { is_active: true });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="bt-page bt-ops-page">
      <header className="bt-page-header">
        <div>
          <span className="bt-eyebrow">Bashkim Tours · Maarif</span>
          <h1>Kalendari akademik</h1>
          <p>Vitet, semestrat dhe muajt akademikë.</p>
        </div>
        <button
          className="bt-btn-primary"
          onClick={() => setCreating(!creating)}
        >
          <Plus /> Vit i ri
        </button>
      </header>
      {creating && (
        <form className="bt-calendar-create" onSubmit={createYear}>
          <label>
            Viti i fillimit
            <input
              type="number"
              min="2000"
              max="2200"
              value={startYear}
              onChange={(event) => setStartYear(event.target.value)}
              required
            />
          </label>
          <button className="bt-btn-primary">
            Krijo vitin {startYear}/{Number(startYear) + 1}
          </button>
        </form>
      )}
      {error && <p className="bt-inline-error">{error}</p>}
      {loading ? (
        <div className="bt-state-message">
          <RefreshCw className="bt-spin" /> Duke ngarkuar kalendarin…
        </div>
      ) : !years.length ? (
        <div className="bt-state-message">
          <CalendarDays />
          <h2>Nuk ka vit akademik</h2>
          <p>Krijoni vitin e parë akademik për të gjeneruar muajt.</p>
        </div>
      ) : (
        <>
          <div className="bt-calendar-years">
            {years.map((year) => (
              <button
                className={
                  calendar?.academic_year.id === year.id ? "selected" : ""
                }
                key={year.id}
                onClick={() => openCalendar(year.id)}
              >
                <strong>{year.name}</strong>
                <span>{year.is_active ? "Aktiv" : "Joaktiv"}</span>
              </button>
            ))}
          </div>
          {calendar && (
            <>
              <div className="bt-calendar-selected">
                <div>
                  <h2>{calendar.academic_year.name}</h2>
                  <span>
                    {calendar.academic_year.is_active
                      ? "Viti akademik aktiv"
                      : "Ky vit nuk është aktiv"}
                  </span>
                </div>
                {!calendar.academic_year.is_active && (
                  <button className="bt-btn-secondary" onClick={activateYear}>
                    <Check /> Bëje aktiv
                  </button>
                )}
              </div>
              <div className="bt-semesters">
                {calendar.semesters.map((semester) => (
                  <section key={semester.semester}>
                    <h3>Semestri {semester.semester}</h3>
                    <div>
                      {semester.months.map((month) => (
                        <button
                          className={month.is_active ? "active" : ""}
                          key={month.id}
                          onClick={async () => {
                            try {
                              await calendarApi.toggleMonth(
                                month.id,
                                !month.is_active,
                              );
                              await openCalendar(calendar.academic_year.id);
                            } catch (requestError) {
                              setError(requestError.message);
                            }
                          }}
                        >
                          <strong>{monthSq(month.month, month.month_name)}</strong>
                          <small>{month.calendar_year}</small>
                          <span>
                            {month.is_active ? "Aktiv" : "Çaktivizuar"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
