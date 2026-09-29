import { useCallback, useEffect, useState } from "react";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Plus, Printer, RefreshCw, Wallet } from "lucide-react";
import { authApi, cashRegistersApi, monthlyPaymentsApi } from "./api";
import { Modal } from "./PortalPages";
import bashkimToursLogo from "./assets/bashkimtours_logo.png";

const euro = new Intl.NumberFormat("sq-AL", { style: "currency", currency: "EUR" });
const money = (value) => value == null ? "—" : euro.format(Number(value));
const mkd = new Intl.NumberFormat("sq-AL", { maximumFractionDigits: 2 });
const formatMKD = (value) => value == null ? "—" : `${mkd.format(Number(value))} MKD`;
const exchangeRate = 61.5;
const dateTime = (value) => value ? new Intl.DateTimeFormat("sq-MK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const paymentDate = (value) => value ? new Intl.DateTimeFormat("sq-MK", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`)) : "—";
const differenceLabel = (value) => value == null ? "—" : Number(value) === 0 ? "Përputhet" : Number(value) > 0 ? `Tepricë: ${money(value)}` : `Mungesë: ${money(Math.abs(Number(value)))}`;
const emptyAction = () => ({ amount: "", comment: "", expense_type: "PAYMENT", currency: "EUR" });

function ExpenseAmount({ transaction }) {
  if (transaction.currency !== "MKD") return <>-{money(transaction.amount)}</>;
  return <span className="bt-cash-expense-amount">
    <strong>-{formatMKD(transaction.amount)}</strong>
    <small>≈ -{money(transaction.amount_eur)}</small>
    {transaction.exchange_rate != null && <small>1 EUR = {mkd.format(Number(transaction.exchange_rate))} MKD</small>}
  </span>;
}

function Summary({ session, closed = false, current = false }) {
  if (!session) return <p>Arka nuk ka sesion të hapur.</p>;
  if (current) return <>
    <div className="bt-cash-current-facts">
      <div className="bt-cash-current-opening">
        <div><span>Hapur më</span><strong>{dateTime(session.opened_at)}</strong></div>
        <div><span>Hapur nga</span><strong>{session.opened_by_username}</strong></div>
        <div><span>Balanci i hapjes</span><strong>{money(session.opening_balance)}</strong></div>
      </div>
      <div className="bt-cash-current-totals">
        <div><span>Të hyrat</span><strong>{money(session.total_income)}</strong></div>
        <div><span>Të dalurat</span><strong>{money(session.total_expenses)}</strong></div>
      </div>
    </div>
    {session.comment && <p><strong>Koment:</strong> {session.comment}</p>}
  </>;
  return <>
    <div className="bt-cash-session-facts">
      <div><span>Hapur më</span><strong>{dateTime(session.opened_at)}</strong></div>
      <div><span>Hapur nga</span><strong>{session.opened_by_username}</strong></div>
      <div><span>Balanci i hapjes</span><strong>{money(session.opening_balance)}</strong></div>
      <div><span>Të hyrat</span><strong>{money(session.total_income)}</strong></div>
      <div><span>Të dalurat</span><strong>{money(session.total_expenses)}</strong></div>
      {closed && <div><span>Balanci i pritshëm</span><strong>{money(session.expected_closing_balance)}</strong></div>}
      {closed && <><div><span>Mbyllur më</span><strong>{dateTime(session.closed_at)}</strong></div><div><span>Mbyllur nga</span><strong>{session.closed_by_username || "—"}</strong></div><div><span>Balanci fizik në mbyllje</span><strong>{money(session.actual_closing_balance)}</strong></div><div><span>Diferenca</span><strong className={Number(session.difference) === 0 ? "bt-cash-match" : "bt-cash-mismatch"}>{differenceLabel(session.difference)}</strong></div></>}
    </div>
    {session.comment && <p><strong>Koment:</strong> {session.comment}</p>}
  </>;
}

function TransactionColumns({ items, loading = false }) {
  const [paymentDetail, setPaymentDetail] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const income = items.filter((item) => item.transaction_type === "INCOME");
  const expenses = items.filter((item) => item.transaction_type === "EXPENSE");

  async function showPayment(id) {
    setPaymentLoading(true);
    setPaymentError("");
    try {
      setPaymentDetail(await monthlyPaymentsApi.get(id));
    } catch (requestError) {
      setPaymentError(requestError.message);
    } finally {
      setPaymentLoading(false);
    }
  }

  return <div className="bt-maarif-cash-columns">
    <section className="bt-maarif-cash-panel"><h2><ArrowDownRight size={21} /> Të hyrat</h2>
      {loading && <p>Duke ngarkuar…</p>}
      {!loading && !income.length && <p>Nuk ka të hyra në këtë sesion.</p>}
      {!!income.length && <div className="bt-accounts-table-wrap"><table className="bt-accounts-table"><thead><tr><th>Data e pagesës</th><th>Nxënësi</th><th>Prindi</th><th>Telefoni</th><th>Muaji</th><th>Koment</th><th>Shuma</th><th></th></tr></thead><tbody>{income.map((item) => <tr key={item.id}>{item.payment ? <><td>{paymentDate(item.payment.payment_date)}</td><td><strong>{item.payment.student_first_name} {item.payment.student_last_name}</strong></td><td>{item.payment.parent_name || "—"}</td><td>{item.payment.parent_phone || "—"}</td><td>{item.payment.month_name} {item.payment.calendar_year}</td><td>{item.payment.comment || "—"}</td><td>+{money(item.amount)}</td><td><button type="button" className="bt-btn-secondary bt-btn-small" disabled={paymentLoading} onClick={() => showPayment(item.payment.id)}>Detajet</button></td></> : <><td>{dateTime(item.created_at)}</td><td colSpan={5}>Detajet e pagesës nuk janë të disponueshme.</td><td>+{money(item.amount)}</td><td>{item.payment_id && <button type="button" className="bt-btn-secondary bt-btn-small" disabled={paymentLoading} onClick={() => showPayment(item.payment_id)}>Detajet</button>}</td></>}</tr>)}</tbody></table></div>}
      {paymentError && <p className="bt-inline-error" role="alert">{paymentError}</p>}
    </section>
    <section className="bt-maarif-cash-panel"><h2><ArrowUpRight size={21} /> Të dalurat</h2>
      {loading && <p>Duke ngarkuar…</p>}
      {!loading && !expenses.length && <p>Nuk ka të dalura në këtë sesion.</p>}
      {!!expenses.length && <div className="bt-accounts-table-wrap"><table className="bt-accounts-table"><thead><tr><th>Data</th><th>Lloji / Përshkrimi</th><th>Përdoruesi</th><th>Shuma</th></tr></thead><tbody>{expenses.map((item) => <tr key={item.id}><td>{dateTime(item.created_at)}</td><td>{item.expense_type === "WITHDRAWAL" ? "Tërheqje" : "Pagesë"}{item.comment ? ` · ${item.comment}` : ""}</td><td>{item.created_by_username}</td><td><ExpenseAmount transaction={item} /></td></tr>)}</tbody></table></div>}
    </section>
    {paymentDetail && <Modal title="Detajet e pagesës mujore" onClose={() => setPaymentDetail(null)}><div className="bt-cash-payment-detail">
      <div><span>Nxënësi</span><strong>{paymentDetail.student_first_name} {paymentDetail.student_last_name}</strong></div>
      <div><span>Prindi</span><strong>{paymentDetail.parent_name || "—"}</strong></div>
      <div><span>Telefoni</span><strong>{paymentDetail.parent_phone || "—"}</strong></div>
      <div><span>Zona</span><strong>{paymentDetail.area_name || "—"}</strong></div>
      <div><span>Muaji</span><strong>{paymentDetail.month_name} {paymentDetail.calendar_year}</strong></div>
      <div><span>Semestri</span><strong>{paymentDetail.semester ?? "—"}</strong></div>
      <div><span>Data e pagesës</span><strong>{paymentDate(paymentDetail.payment_date)}</strong></div>
      <div><span>Shuma</span><strong>{money(paymentDetail.amount)}</strong></div>
      <div><span>Koment</span><strong>{paymentDetail.comment || "—"}</strong></div>
      <div><span>Regjistruar nga</span><strong>{paymentDetail.created_by_username || "—"}</strong></div>
      <div><span>Regjistruar më</span><strong>{dateTime(paymentDetail.created_at)}</strong></div>
    </div></Modal>}
  </div>;
}

function SessionPrintSheet({ session }) {
  const income = session.transactions.filter((item) => item.transaction_type === "INCOME");
  const expenses = session.transactions.filter((item) => item.transaction_type === "EXPENSE");
  return <div className="bt-print-sheet bt-cash-session-print">
    <header><img src={bashkimToursLogo} alt="Bashkim Tours" /><div><strong>Bashkim Tours</strong><span>Dervish Cara Nr. 4 · 1200 Tetovë, Maqedoni</span><span>+389 44 338 003 · +389 75 312 015</span></div></header>
    <div className="bt-print-title"><div><h1>{session.status === "CLOSED" ? "Raporti i mbylljes së arkës" : "Raporti i sesionit të arkës"}</h1><p>{session.cash_register_name} · {session.status === "CLOSED" ? dateTime(session.closed_at) : "Sesioni i hapur"}</p></div><span>Sesioni #{session.id}</span></div>
    <section className="bt-print-section"><h2>Përmbledhja e sesionit</h2><table><tbody>
      <tr><th>Hapur më</th><td>{dateTime(session.opened_at)}</td><th>Hapur nga</th><td>{session.opened_by_username}</td></tr>
      <tr><th>Statusi</th><td>{session.status === "CLOSED" ? "I mbyllur" : "I hapur"}</td><th>Mbyllur më</th><td>{dateTime(session.closed_at)}</td></tr>
      {session.closed_by_username && <tr><th>Mbyllur nga</th><td colSpan={3}>{session.closed_by_username}</td></tr>}
      <tr><th>Balanci i hapjes</th><td>{money(session.opening_balance)}</td><th>Të hyrat</th><td>{money(session.total_income)}</td></tr>
      <tr><th>Të dalurat</th><td>{money(session.total_expenses)}</td><th>Balanci i pritshëm</th><td>{money(session.expected_closing_balance)}</td></tr>
      {session.status === "CLOSED" && <tr><th>Balanci fizik në mbyllje</th><td>{money(session.actual_closing_balance)}</td><th>Diferenca</th><td>{differenceLabel(session.difference)}</td></tr>}
      {session.comment && <tr><th>Koment</th><td colSpan={3}>{session.comment}</td></tr>}
    </tbody></table></section>
    <section className="bt-print-section"><h2>Të hyrat <span>{income.length} pagesa · {money(session.total_income)}</span></h2><table><thead><tr><th>Data</th><th>Nxënësi</th><th>Prindi / Telefoni</th><th>Muaji</th><th>Koment</th><th>Shuma</th></tr></thead><tbody>
      {income.map((item) => <tr key={item.id}><td>{item.payment ? paymentDate(item.payment.payment_date) : dateTime(item.created_at)}</td><td>{item.payment ? `${item.payment.student_first_name} ${item.payment.student_last_name}` : "—"}</td><td>{item.payment ? `${item.payment.parent_name || "—"} · ${item.payment.parent_phone || "—"}` : "—"}</td><td>{item.payment ? `${item.payment.month_name} ${item.payment.calendar_year}` : "—"}</td><td>{item.payment?.comment || item.comment || "—"}</td><td>+{money(item.amount)}</td></tr>)}
      {!income.length && <tr><td colSpan={6}>Nuk ka të hyra në këtë sesion.</td></tr>}
    </tbody></table></section>
    <section className="bt-print-section"><h2>Të dalurat <span>{expenses.length} dalje · {money(session.total_expenses)}</span></h2><table><thead><tr><th>Data</th><th>Lloji</th><th>Koment</th><th>Regjistruar nga</th><th>Shuma</th></tr></thead><tbody>
      {expenses.map((item) => <tr key={item.id}><td>{dateTime(item.created_at)}</td><td>{item.expense_type === "WITHDRAWAL" ? "Tërheqje" : "Pagesë"}</td><td>{item.comment || "—"}</td><td>{item.created_by_username}</td><td><ExpenseAmount transaction={item} /></td></tr>)}
      {!expenses.length && <tr><td colSpan={5}>Nuk ka të dalura në këtë sesion.</td></tr>}
    </tbody></table></section>
    <footer><span>bashkimtours.com · instagram.com/bashkim_tours_official</span><strong>Bashkim Tours</strong></footer>
  </div>;
}

export default function MaarifCashPage() {
  const [me, setMe] = useState(null);
  const [registers, setRegisters] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [session, setSession] = useState(null);
  const [currentTransactions, setCurrentTransactions] = useState([]);
  const [overviewSessions, setOverviewSessions] = useState({});
  const [history, setHistory] = useState(null);
  const [filters, setFilters] = useState({ date_from: "", date_to: "", session_status: "" });
  const [page, setPage] = useState(1);
  const [section, setSection] = useState("current");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState(null);
  const [actionForm, setActionForm] = useState(emptyAction);
  const [saving, setSaving] = useState(false);
  const [closeResult, setCloseResult] = useState(null);
  const [printSession, setPrintSession] = useState(null);
  const [printLoading, setPrintLoading] = useState(false);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [user, list] = await Promise.all([authApi.me(), cashRegistersApi.list()]);
      setMe(user);
      setRegisters(list);
      setSelectedId((current) => user.maarif_cash_register_id ?? (list.some((item) => item.id === current) ? current : null));
      if (user.maarif_cash_register_id == null && user.is_active && user.role?.is_active && ["OWNER", "ADMIN"].includes(user.role?.name?.toUpperCase())) {
        const currentSessions = await Promise.allSettled(list.map((item) => cashRegistersApi.currentSession(item.id)));
        setOverviewSessions(Object.fromEntries(list.map((item, index) => [item.id, currentSessions[index].status === "fulfilled" ? currentSessions[index].value : null])));
      }
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const request = window.setTimeout(loadOverview, 0);
    return () => window.clearTimeout(request);
  }, [loadOverview]);

  useEffect(() => {
    if (!printSession) return undefined;
    const finish = () => setPrintSession(null);
    window.addEventListener("afterprint", finish, { once: true });
    const request = window.setTimeout(() => window.print(), 120);
    return () => {
      window.clearTimeout(request);
      window.removeEventListener("afterprint", finish);
    };
  }, [printSession]);

  useEffect(() => {
    if (selectedId == null) return;
    let active = true;
    const fetchCurrent = async () => {
      setDetailLoading(true);
      setAccessDenied(false);
      setSession(null);
      setCurrentTransactions([]);
      try {
        const current = await cashRegistersApi.currentSession(selectedId);
        if (!active) return;
        setSession(current);
        if (current) {
          const detail = await cashRegistersApi.session(selectedId, current.id);
          if (active) setCurrentTransactions(detail.transactions || []);
        }
      } catch (requestError) {
        if (active) {
          if (requestError.status === 403) {
            setAccessDenied(true);
            try {
              const items = await cashRegistersApi.transactions(selectedId);
              if (active) setCurrentTransactions(items.filter((item) => item.cash_register_session_id != null && item.cash_register_session_id === registers.find((register) => register.id === selectedId)?.open_session_id));
            } catch { /* The register summary still remains available. */ }
          }
          else setError(requestError.message);
        }
      } finally {
        if (active) setDetailLoading(false);
      }
    };
    fetchCurrent();
    return () => { active = false; };
  }, [selectedId, refresh, registers]);

  useEffect(() => {
    if (selectedId == null || accessDenied) return;
    let active = true;
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const result = await cashRegistersApi.sessions(selectedId, { ...filters, page, page_size: 20 });
        if (active) setHistory(result);
      } catch (requestError) {
        if (active) {
          if (requestError.status === 403) setAccessDenied(true);
          else setError(requestError.message);
        }
      } finally {
        if (active) setHistoryLoading(false);
      }
    };
    fetchHistory();
    return () => { active = false; };
  }, [selectedId, filters, page, refresh, accessDenied]);

  const selected = registers.find((item) => item.id === selectedId);
  const roleName = me?.role?.name?.toUpperCase();
  const mayOperate = Boolean(me?.is_active && selected && (me.maarif_cash_register_id === selected.id || ((roleName === "OWNER" || roleName === "ADMIN") && me.role?.is_active)));
  const open = Boolean(session?.status === "OPEN");

  function chooseRegister(id) {
    setSelectedId(id);
    setSection("current");
    setPage(1);
    setFilters({ date_from: "", date_to: "", session_status: "" });
    setHistory(null);
    setError("");
  }

  async function submitAction(event) {
    event.preventDefault();
    if (saving || !mayOperate || !selected || !action) return;
    setSaving(true);
    setError("");
    try {
      const body = { comment: actionForm.comment.trim() || null };
      let result;
      if (action === "open") result = await cashRegistersApi.openSession(selected.id, { ...body, opening_balance: actionForm.amount });
      if (action === "close") result = await cashRegistersApi.closeSession(selected.id, { ...body, actual_closing_balance: actionForm.amount });
      if (action === "expense") result = await cashRegistersApi.createExpense(selected.id, { ...body, amount: Number(actionForm.amount), expense_type: actionForm.expense_type, currency: actionForm.currency });
      setAction(null);
      if (action === "close") setCloseResult(result);
      await loadOverview();
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function showSessionDetail(id) {
    setSessionDetailLoading(true);
    setError("");
    try {
      setSessionDetail(await cashRegistersApi.session(selectedId, id));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSessionDetailLoading(false);
    }
  }

  async function printSessionById(registerId, sessionId) {
    if (printLoading) return;
    setPrintLoading(true);
    setError("");
    try {
      setPrintSession(await cashRegistersApi.session(registerId, sessionId));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPrintLoading(false);
    }
  }

  return <div className="bt-page bt-ops-page bt-maarif-cash-page">
    <header className="bt-page-header"><div><span className="bt-eyebrow">Maarif</span><h1>Arka</h1><p>Balanci dhe sesionet ditore të arkës.</p></div></header>
    {error && !action && <p className="bt-inline-error" role="alert">{error}</p>}
    {loading && <p className="bt-accounts-state" role="status"><RefreshCw className="bt-spin" /> Duke ngarkuar…</p>}
    {!loading && me?.maarif_cash_register_id == null && selectedId == null && <>
      {!registers.length && <p className="bt-accounts-state">Nuk ka arka të regjistruara.</p>}
      {!!registers.length && <div className="bt-cash-overview">{registers.map((register) => <article className="bt-maarif-cash-panel" key={register.id}>
        <h2><Wallet size={21} /> {register.name}</h2>
        <p>Gjendja: <strong>{money(register.balance)}</strong></p>
        <p>Statusi: <span className={`bt-cash-session-status ${register.has_open_session ? "open" : ""}`}>{register.has_open_session ? "E hapur" : "E mbyllur"}</span></p>
        {overviewSessions[register.id] && <><p>Hapur nga: {overviewSessions[register.id].opened_by_username}</p><p>Hapur më: {dateTime(overviewSessions[register.id].opened_at)}</p></>}
        <button type="button" className="bt-btn-secondary" onClick={() => chooseRegister(register.id)}>Shiko arkën</button>
      </article>)}</div>}
    </>}
    {selected && <>
      {me?.maarif_cash_register_id == null && <button type="button" className="bt-cash-back" onClick={() => setSelectedId(null)}><ArrowLeft size={17} /> Të gjitha arkat</button>}
      <section className="bt-maarif-cash-balance"><div><span>{selected.name} <span className={`bt-cash-session-status ${selected.has_open_session ? "open" : ""}`}>{selected.has_open_session ? "E hapur" : "E mbyllur"}</span></span><strong>{money(selected.balance)}</strong><small>Gjendja aktuale</small></div><Wallet size={34} /></section>
      <div className="bt-accounts-tabs" role="tablist" aria-label="Seksionet e arkës"><button type="button" role="tab" aria-selected={section === "current"} className={section === "current" ? "active" : ""} onClick={() => setSection("current")}>Gjendja aktuale</button><button type="button" role="tab" aria-selected={section === "history"} className={section === "history" ? "active" : ""} onClick={() => setSection("history")}>Historia</button></div>
      {accessDenied && <p className="bt-inline-error" role="status">API-ja nuk lejon shikimin e detajeve ose historisë së sesioneve të kësaj arke për këtë përdorues.</p>}
      {section === "current" && accessDenied && <>{!selected.has_open_session && <div className="bt-maarif-cash-panel"><p>Arka nuk ka sesion të hapur.</p></div>}{selected.has_open_session && <TransactionColumns items={currentTransactions} loading={detailLoading} />}</>}
      {section === "current" && !accessDenied && <>
        {detailLoading && <p className="bt-accounts-state"><RefreshCw className="bt-spin" /> Duke ngarkuar sesionin…</p>}
        {!detailLoading && !session && <div className="bt-maarif-cash-panel"><p>Arka nuk ka sesion të hapur.</p>{mayOperate && selected.is_active && <button type="button" className="bt-btn-primary" onClick={() => { setActionForm(emptyAction()); setAction("open"); }}>Hap arkën</button>}</div>}
        {!detailLoading && open && <><div className="bt-maarif-cash-panel"><h2>Sesioni aktual</h2><Summary session={session} current /><div className="bt-cash-session-actions">{mayOperate && <button type="button" className="bt-btn-primary" onClick={() => { setActionForm(emptyAction()); setAction("expense"); }}><Plus size={17} /> Shto të dalur</button>}</div></div><TransactionColumns items={currentTransactions} />{mayOperate && <div className="bt-cash-close-section"><span>Mbyllja e sesionit bëhet pasi të numërohen paratë në arkë.</span><button type="button" className="bt-btn-danger" onClick={() => { setActionForm(emptyAction()); setAction("close"); }}>Mbyll arkën</button></div>}</>}
      </>}
      {section === "history" && !accessDenied && <section className="bt-maarif-cash-panel"><h2>Historia e sesioneve</h2>
        <div className="bt-cash-history-filters"><label>Prej datës<input type="date" value={filters.date_from} onChange={(event) => { setPage(1); setFilters({ ...filters, date_from: event.target.value }); }} /></label><label>Deri më<input type="date" value={filters.date_to} onChange={(event) => { setPage(1); setFilters({ ...filters, date_to: event.target.value }); }} /></label><label>Statusi<select value={filters.session_status} onChange={(event) => { setPage(1); setFilters({ ...filters, session_status: event.target.value }); }}><option value="">Të gjitha</option><option value="OPEN">E hapur</option><option value="CLOSED">E mbyllur</option></select></label></div>
        {historyLoading && <p>Duke ngarkuar historinë…</p>}
        {!historyLoading && !history?.items?.length && <p>Nuk ka sesione për këto filtra.</p>}
        {!!history?.items?.length && <div className="bt-accounts-table-wrap"><table className="bt-accounts-table"><thead><tr><th>Hapur më</th><th>Mbyllur më</th><th>Hapur nga</th><th>Mbyllur nga</th><th>Hapja</th><th>Të hyra</th><th>Të dalura</th><th>Pritshmëria</th><th>Fizikisht</th><th>Diferenca</th><th>Statusi</th><th></th></tr></thead><tbody>{history.items.map((item) => <tr key={item.id}><td>{dateTime(item.opened_at)}</td><td>{dateTime(item.closed_at)}</td><td>{item.opened_by_username}</td><td>{item.closed_by_username || "—"}</td><td>{money(item.opening_balance)}</td><td>{money(item.total_income)}</td><td>{money(item.total_expenses)}</td><td>{money(item.expected_closing_balance)}</td><td>{money(item.actual_closing_balance)}</td><td>{differenceLabel(item.difference)}</td><td>{item.status === "OPEN" ? "E hapur" : "E mbyllur"}</td><td><div className="bt-role-actions"><button type="button" className="bt-btn-secondary bt-btn-small" disabled={sessionDetailLoading} onClick={() => showSessionDetail(item.id)}>Detajet</button><button type="button" className="bt-btn-secondary bt-btn-small" disabled={printLoading} onClick={() => printSessionById(selected.id, item.id)}><Printer size={15} /> Printo</button></div></td></tr>)}</tbody></table></div>}
        {!!history && <div className="bt-cash-history-pages"><span>{history.total} sesione · Faqja {history.page} nga {Math.max(1, Math.ceil(history.total / history.page_size))}</span><button type="button" className="bt-btn-secondary bt-btn-small" disabled={historyLoading || page <= 1} onClick={() => setPage(page - 1)}>Mbrapa</button><button type="button" className="bt-btn-secondary bt-btn-small" disabled={historyLoading || page * history.page_size >= history.total} onClick={() => setPage(page + 1)}>Përpara</button></div>}
      </section>}
    </>}
    {action && <Modal title={action === "open" ? "Hap arkën" : action === "close" ? "Mbyll arkën" : "Shto të dalur"} className={action === "close" ? "bt-cash-close-modal" : ""} onClose={() => { if (!saving) setAction(null); }}><form className="bt-role-form" onSubmit={submitAction}>
      {action === "close" && <p>Shkruaj shumën që ke numëruar fizikisht në arkë. Sistemi do ta krahasojë me balancin e pritshëm.</p>}
      <label>{action === "open" ? "Balanci fizik në hapje (EUR)" : action === "close" ? "Balanci fizik në mbyllje (EUR)" : "Shuma"}<input type="number" min={action === "expense" ? "0.01" : "0"} step="0.01" required value={actionForm.amount} onChange={(event) => setActionForm({ ...actionForm, amount: event.target.value })} /></label>
      {action === "expense" && <label>Lloji<select value={actionForm.expense_type} onChange={(event) => setActionForm({ ...actionForm, expense_type: event.target.value })}><option value="PAYMENT">Pagesë</option><option value="WITHDRAWAL">Tërheqje</option></select></label>}
      {action === "expense" && <label>Monedha<select value={actionForm.currency} onChange={(event) => setActionForm({ ...actionForm, currency: event.target.value })}><option value="EUR">EUR</option><option value="MKD">MKD</option></select></label>}
      {action === "expense" && actionForm.currency === "MKD" && Number(actionForm.amount) > 0 && <p className="bt-cash-conversion-preview">{formatMKD(actionForm.amount)} ≈ {money(Number(actionForm.amount) / exchangeRate)}<small>Kursi: 1 EUR = 61.5 MKD · Vlera përfundimtare llogaritet nga backend-i.</small></p>}
      <label>Koment (opsional)<textarea rows={3} value={actionForm.comment} onChange={(event) => setActionForm({ ...actionForm, comment: event.target.value })} /></label>
      {error && <p className="bt-inline-error" role="alert">{error}</p>}
      <div className="bt-modal-actions"><button type="submit" className={action === "close" ? "bt-btn-danger" : "bt-btn-primary"} disabled={saving}>{saving ? "Duke ruajtur…" : action === "open" ? "Hap arkën" : action === "close" ? "Konfirmo mbylljen" : "Ruaj të dalurën"}</button></div>
    </form></Modal>}
    {closeResult && <Modal title="Arka u mbyll" onClose={() => setCloseResult(null)}><div className="bt-cash-close-result"><Summary session={closeResult} closed />{error && <p className="bt-inline-error" role="alert">{error}</p>}<div className="bt-modal-actions"><button type="button" className="bt-btn-secondary" disabled={printLoading} onClick={() => printSessionById(closeResult.cash_register_id, closeResult.id)}><Printer size={17} /> {printLoading ? "Duke përgatitur…" : "Printo sesionin"}</button><button type="button" className="bt-btn-primary" onClick={() => setCloseResult(null)}>Mbyll</button></div></div></Modal>}
    {sessionDetail && <Modal title={`Sesioni · ${sessionDetail.cash_register_name}`} onClose={() => setSessionDetail(null)} className="bt-cash-detail-modal"><div className="bt-cash-session-detail"><span className={`bt-cash-session-status ${sessionDetail.status === "OPEN" ? "open" : ""}`}>{sessionDetail.status === "OPEN" ? "E hapur" : "E mbyllur"}</span><Summary session={sessionDetail} closed={sessionDetail.status === "CLOSED"} /><TransactionColumns items={sessionDetail.transactions || []} /></div></Modal>}
    {printSession && <SessionPrintSheet session={printSession} />}
  </div>;
}
