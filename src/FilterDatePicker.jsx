import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

const pad = (value) => String(value).padStart(2, "0");
const monthOf = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value.slice(0, 7) : `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;

export default function FilterDatePicker({ label = "Data", value, onChange, clearable = false }) {
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => monthOf(value));
  const [year, monthNumber] = month.split("-").map(Number);
  const firstWeekday = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthNumber, 0).getDate();

  useEffect(() => {
    if (!open) return;
    const outside = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  const moveMonth = (delta) => {
    const next = new Date(year, monthNumber - 1 + delta, 1);
    setMonth(`${next.getFullYear()}-${pad(next.getMonth() + 1)}`);
  };
  const choose = (day) => {
    onChange(`${month}-${pad(day)}`);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return <div className="bt-filter-date-picker" ref={rootRef}>
    <button ref={triggerRef} type="button" className="bt-filter-date-trigger" aria-label={`${label}: ${value ? value.split("-").reverse().join("/") : "zgjidh datën"}`} aria-expanded={open} onClick={() => { if (!open) setMonth(monthOf(value)); setOpen((current) => !current); }}><CalendarDays size={18} aria-hidden="true" /><span>{value ? value.split("-").reverse().join("/") : "Zgjidh datën"}</span></button>
    {clearable && value && <button type="button" className="bt-filter-date-clear" aria-label={`Pastro ${label.toLowerCase()}`} onClick={() => onChange("")}><X size={16} /></button>}
    {open && <div className="bt-filter-date-calendar" role="group" aria-label={`${label}: kalendari`}>
      <div className="bt-charter-calendar-header"><button type="button" aria-label="Muaji i kaluar" onClick={() => moveMonth(-1)}><ChevronLeft size={18} /></button><strong>{new Intl.DateTimeFormat("sq-AL", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1))}</strong><button type="button" aria-label="Muaji tjetër" onClick={() => moveMonth(1)}><ChevronRight size={18} /></button></div>
      <div className="bt-charter-calendar-days">{["H", "M", "M", "E", "P", "S", "D"].map((day, index) => <span key={index}>{day}</span>)}{Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => { const date = `${month}-${pad(index + 1)}`; return <button type="button" key={date} aria-label={date.split("-").reverse().join("/")} aria-pressed={value === date} onClick={() => choose(index + 1)}>{index + 1}</button>; })}</div>
    </div>}
  </div>;
}
