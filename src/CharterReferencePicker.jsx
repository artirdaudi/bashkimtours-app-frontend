import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export default function CharterReferencePicker({ value, selectedLabel, placeholder, searchOptions, onSelect, disabled = false, required = false }) {
  const listId = useId();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const [options, setOptions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      Promise.resolve(searchOptions(query))
        .then((items) => { if (active) { setOptions(items); setActiveIndex(0); } })
        .catch(() => { if (active) setOptions([]); })
        .finally(() => { if (active) setLoading(false); });
    }, query ? 120 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [open, query, searchOptions]);

  function showOptions() {
    if (disabled) return;
    const rect = inputRef.current?.getBoundingClientRect();
    const container = inputRef.current?.closest(".bt-modal-body");
    const bounds = container?.getBoundingClientRect();
    if (rect && bounds) setAbove(bounds.bottom - rect.bottom < 230 && rect.top - bounds.top > bounds.bottom - rect.bottom);
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }
  function choose(option) {
    onSelect(option);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }
  const visibleText = open ? query : selectedLabel || "";
  return <div className={`bt-charter-reference-picker${open ? " is-open" : ""}${above ? " opens-above" : ""}`}>
    <Search size={17} className="bt-charter-reference-search" aria-hidden="true" />
    <input ref={inputRef} role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-activedescendant={open && options.length ? `${listId}-${activeIndex}` : undefined} autoComplete="off" placeholder={placeholder} value={visibleText} disabled={disabled} required={required && !value} onFocus={showOptions} onBlur={() => setOpen(false)} onChange={(event) => { setQuery(event.target.value); onSelect(null); setOpen(true); }} onKeyDown={(event) => {
      if (event.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
      if (event.key === "ArrowDown" && open) { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, Math.max(0, options.length - 1))); }
      if (event.key === "ArrowUp" && open) { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
      if (event.key === "Enter" && open && options.length) { event.preventDefault(); choose(options[activeIndex]); }
    }} />
    {value && !open ? <button type="button" className="bt-charter-reference-clear" aria-label={`Pastro ${placeholder.toLowerCase()}`} disabled={disabled} onPointerDown={(event) => event.preventDefault()} onClick={() => { onSelect(null); setQuery(""); inputRef.current?.focus(); }}><X size={16} /></button> : <button type="button" className="bt-charter-reference-toggle" aria-label={`Hap ${placeholder.toLowerCase()}`} disabled={disabled} onPointerDown={(event) => event.preventDefault()} onClick={() => inputRef.current?.focus()}><ChevronDown size={17} /></button>}
    {open && <div id={listId} role="listbox" className="bt-charter-reference-options">{loading ? <p>Duke kërkuar…</p> : options.length ? options.map((option, index) => <button id={`${listId}-${index}`} key={option.id} type="button" role="option" aria-selected={String(value) === String(option.id)} className={index === activeIndex ? "is-active" : ""} onPointerDown={(event) => event.preventDefault()} onClick={() => choose(option)}><strong>{option.label}</strong>{option.meta && <small>{option.meta}</small>}</button>) : <p>Nuk u gjet asnjë rezultat.</p>}</div>}
  </div>;
}
