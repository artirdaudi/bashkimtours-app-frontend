import { useEffect, useRef, useState } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { CalendarGrid } from "./DateCalendar";

const dateLabel = (value) => value ? value.split("-").reverse().join("/") : "Zgjidh datën";
const twoDigits = (value) => String(value).padStart(2, "0");

export default function CharterDateTimeField({ label, value, onChange }) {
  const rootRef = useRef(null);
  const dateButtonRef = useRef(null);
  const [open, setOpen] = useState(false);
  const date = String(value || "").slice(0, 10);
  const time = String(value || "").slice(11, 16);
  const [hour, minute] = /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time.split(":") : ["", ""];

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      dateButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape, true);
    };
  }, [open]);

  function toggleCalendar() {
    setOpen((current) => !current);
  }
  function chooseDate(day) {
    onChange(`${day}T${time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : ""}`);
    setOpen(false);
    dateButtonRef.current?.focus();
  }
  function changeTime(part, selected) {
    if (!date) return;
    onChange(`${date}T${part === "hour" ? selected : hour || "00"}:${part === "minute" ? selected : minute || "00"}`);
  }

  return <div className="bt-charter-date-field" ref={rootRef}>
    <span className="bt-charter-field-label">{label}</span>
    <div className="bt-charter-date-time">
      <div className="bt-charter-calendar-control">
        <button ref={dateButtonRef} type="button" className="bt-charter-date-button" aria-label={`${label}: zgjidh datën`} aria-expanded={open} onClick={toggleCalendar}><CalendarDays size={17} />{dateLabel(date)}</button>
        {open && <CalendarGrid value={date} onSelect={chooseDate} />}
      </div>
      <div className="bt-charter-time-fields"><Clock3 size={17} aria-hidden="true" /><select aria-label={`${label}: ora`} value={hour} disabled={!date} onChange={(event) => changeTime("hour", event.target.value)}><option value="">Ora</option>{Array.from({ length: 24 }, (_, index) => <option key={index} value={twoDigits(index)}>{twoDigits(index)}</option>)}</select><span aria-hidden="true">:</span><select aria-label={`${label}: minutat`} value={minute} disabled={!date} onChange={(event) => changeTime("minute", event.target.value)}><option value="">Min</option>{Array.from({ length: 60 }, (_, index) => <option key={index} value={twoDigits(index)}>{twoDigits(index)}</option>)}</select></div>
    </div>
  </div>;
}
