import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthSq } from "./locale";
import { formatDate } from "./dateUtils";

const pad = (value) => String(value).padStart(2, "0");
const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export function CalendarGrid({ value, onSelect }) {
  const [shown, setShown] = useState(() => (value || todayKey()).slice(0, 7));
  const [year, month] = shown.split("-").map(Number);
  const start = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const count = new Date(year, month, 0).getDate();
  const changeMonth = (delta) => {
    const next = new Date(year, month - 1 + delta, 1);
    setShown(`${next.getFullYear()}-${pad(next.getMonth() + 1)}`);
  };
  const today = todayKey();
  return <div className="bt-date-calendar" role="group" aria-label="Zgjidh datën">
    <div className="bt-date-calendar-nav">
      <button type="button" aria-label="Muaji i kaluar" onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button>
      <select aria-label="Muaji" value={month} onChange={(event) => setShown(`${year}-${pad(event.target.value)}`)}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>{monthSq(index + 1)}</option>)}</select>
      <select aria-label="Viti" value={year} onChange={(event) => setShown(`${event.target.value}-${pad(month)}`)}>{Array.from({ length: 151 }, (_, index) => 1950 + index).map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <button type="button" aria-label="Muaji tjetër" onClick={() => changeMonth(1)}><ChevronRight size={18} /></button>
    </div>
    <div className="bt-date-calendar-grid">
      {["H", "M", "M", "E", "P", "S", "D"].map((name, index) => <span key={index} aria-label={["E hënë", "E martë", "E mërkurë", "E enjte", "E premte", "E shtunë", "E diel"][index]}>{name}</span>)}
      {Array.from({ length: start }, (_, index) => <span key={`empty-${index}`} />)}
      {Array.from({ length: count }, (_, index) => {
        const key = `${shown}-${pad(index + 1)}`;
        return <button key={key} type="button" aria-label={formatDate(key)} aria-pressed={key === value} className={key === today ? "is-today" : ""} onClick={() => onSelect(key)}>{index + 1}</button>;
      })}
    </div>
    <button type="button" className="bt-date-calendar-today" onClick={() => onSelect(today)}>Sot · {formatDate(today)}</button>
  </div>;
}


