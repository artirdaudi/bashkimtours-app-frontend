import { useEffect, useId, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

export default function CharterReferencePicker({ value, selectedLabel, placeholder, searchOptions, onSelect }) {
  const listId = useId();
  const [query, setQuery] = useState(selectedLabel || "");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      Promise.resolve(searchOptions(query)).then((items) => { if (active) setOptions(items); }).catch(() => { if (active) setOptions([]); }).finally(() => { if (active) setLoading(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [open, query, searchOptions]);
  function choose(option) {
    setQuery(option.label);
    onSelect(option);
    setOpen(false);
  }
  return <div className="bt-charter-reference-picker">
    <Search size={17} className="bt-charter-reference-search" />
    <input role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} autoComplete="off" placeholder={placeholder} value={query} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onChange={(event) => { setQuery(event.target.value); onSelect(null); setOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); if (event.key === "Enter" && open && options.length) { event.preventDefault(); choose(options[0]); } }} />
    <ChevronDown size={17} className="bt-charter-reference-chevron" />
    {open && <div id={listId} role="listbox" className="bt-charter-reference-options">{loading ? <p>Duke kërkuar…</p> : options.length ? options.map((option) => <button key={option.id} type="button" role="option" aria-selected={String(value) === String(option.id)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}><strong>{option.label}</strong>{option.meta && <small>{option.meta}</small>}</button>) : <p>Nuk u gjet asnjë rezultat.</p>}</div>}
  </div>;
}
