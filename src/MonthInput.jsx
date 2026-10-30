import { monthSq } from "./locale";

export default function MonthInput({ value, onChange }) {
  const [year, month] = String(value || "").split("-");
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 151 }, (_, index) => 1950 + index);
  return <span className="bt-month-input">
    <select aria-label="Muaji" value={month || ""} onChange={(event) => onChange(`${year || currentYear}-${event.target.value}`)}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={String(index + 1).padStart(2, "0")}>{monthSq(index + 1)}</option>)}</select>
    <select aria-label="Viti" value={year || ""} onChange={(event) => onChange(`${event.target.value}-${month || "01"}`)}>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select>
  </span>;
}
