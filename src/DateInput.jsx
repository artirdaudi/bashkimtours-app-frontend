import { useEffect, useRef } from "react";
import { formatDate } from "./dateUtils";
import { CalendarDays } from "lucide-react";
import { CalendarGrid } from "./DateCalendar";
import useCalendarPopup from "./useCalendarPopup";

const parseDate = (value) => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  const [, day, month, year] = match;
  const candidate = new Date(`${year}-${month}-${day}T00:00:00`);
  if (
    Number.isNaN(candidate.getTime()) ||
    candidate.getFullYear() !== Number(year) ||
    candidate.getMonth() + 1 !== Number(month) ||
    candidate.getDate() !== Number(day)
  )
    return "";
  return `${year}-${month}-${day}`;
};

const maskDate = (value) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export default function DateInput({ value, onChange, required, ...props }) {
  const inputRef = useRef(null);
  const { rootRef, triggerRef, open, setOpen } = useCalendarPopup();

  useEffect(() => {
    if (inputRef.current) { inputRef.current.value = formatDate(value); inputRef.current.setCustomValidity(""); }
  }, [value]);

  return <span className="bt-date-input" ref={rootRef}>
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      enterKeyHint="next"
      placeholder="DD/MM/YYYY"
      defaultValue={formatDate(value)}
      required={required}
      pattern="\d{2}/\d{2}/\d{4}"
      title="Shkruani datën në formatin DD/MM/YYYY"
      onChange={(event) => {
        const masked = maskDate(event.target.value);
        event.target.value = masked;
        const parsed = parseDate(masked);
        event.target.setCustomValidity(masked && !parsed ? "Shkruani një datë të vlefshme në formatin DD/MM/YYYY." : "");
        if (parsed) onChange(parsed);
        else if (!masked) onChange("");
      }}
      onBlur={(event) => {
        if (parseDate(event.target.value) || !event.target.value) event.target.value = formatDate(value);
      }}
    />
    <button ref={triggerRef} type="button" className="bt-date-input-trigger" aria-label="Hap kalendarin" aria-expanded={open} onClick={(event) => { event.preventDefault(); setOpen((current) => !current); }}><CalendarDays size={18} /></button>
    {open && <CalendarGrid value={value} onSelect={(selected) => { onChange(selected); if (inputRef.current) { inputRef.current.value = formatDate(selected); inputRef.current.setCustomValidity(""); } setOpen(false); triggerRef.current?.focus(); }} />}
  </span>;
}
