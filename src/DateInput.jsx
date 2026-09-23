import { useEffect, useRef } from "react";
import { formatDate } from "./dateUtils";

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

  useEffect(() => {
    if (inputRef.current) inputRef.current.value = formatDate(value);
  }, [value]);

  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      placeholder="DD/MM/YYYY"
      defaultValue={formatDate(value)}
      required={required}
      pattern="\d{2}/\d{2}/\d{4}"
      title="Shkruani datën në formatin DD/MM/YYYY"
      onChange={(event) => {
        const masked = maskDate(event.target.value);
        event.target.value = masked;
        const parsed = parseDate(masked);
        if (parsed) onChange(parsed);
        else if (!masked) onChange("");
      }}
      onBlur={(event) => {
        event.target.value = formatDate(value);
      }}
    />
  );
}
