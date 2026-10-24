import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Phone, Plus, Search } from "lucide-react";
import { fuelExternalCustomersApi, fuelExternalTransactionsApi } from "./api";
import { Modal } from "./PortalPages";
import { formatDateTime } from "./dateUtils";

const pageSize = 30;
const emptyCustomer = { id: null, registration_number: "", first_name: "", last_name: "", phone_number: "", comment: "", is_active: true };
const formatNumber = (value, digits = 2) => value == null ? "—" : new Intl.NumberFormat("sq-AL", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value));
const mkd = (value) => value == null ? "—" : `${new Intl.NumberFormat("sq-AL", { maximumFractionDigits: 2 }).format(Number(value))} MKD`;
const statusOf = (detail) => detail?.unit_price == null ? "missing_price" : detail.is_settled ? "settled" : "unsettled";
const statusLabel = { missing_price: "Pa vendosur çmimin e naftës", unsettled: "Pa paguar", settled: "Të paguara" };
const customerName = (customer) => `${customer.first_name} ${customer.last_name}`;

export default function FuelExternalCustomersPage() {
  const [tab, setTab] = useState("transactions");
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [priceForm, setPriceForm] = useState(null);
  const [bulkSettleOpen, setBulkSettleOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [detailRow, setDetailRow] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerSummaries, setCustomerSummaries] = useState({});
  const [customerFilter, setCustomerFilter] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customerError, setCustomerError] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [customerWarning, setCustomerWarning] = useState(false);
  const [customerForm, setCustomerForm] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyHasNext, setHistoryHasNext] = useState(false);
  const requestId = useRef(0);
  const historyRequestId = useRef(0);

  const loadSummary = useCallback(async () => {
    setSummaryError("");
    try { setSummary(await fuelExternalTransactionsApi.summary()); }
    catch (cause) { setSummaryError(`Nuk mund të ngarkohet përmbledhja. ${cause.message}`); }
  }, []);

  const loadTransactions = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      let rows;
      if (status === "unsettled" || status === "missing_price") {
        rows = [];
        let batch;
        do {
          batch = await fuelExternalTransactionsApi.list({ status, search: appliedSearch.trim(), limit: 100, offset: rows.length });
          rows.push(...batch);
        } while (batch.length === 100 && currentRequest === requestId.current);
      } else {
        rows = await fuelExternalTransactionsApi.list({ status, search: appliedSearch.trim(), limit: pageSize + 1, offset: page * pageSize });
      }
      if (currentRequest !== requestId.current) return;
      setTransactions((previous) => status === "unsettled" || status === "missing_price" ? rows : page === 0 ? rows.slice(0, pageSize) : [...previous, ...rows.slice(0, pageSize)]);
      setHasNext(status !== "unsettled" && status !== "missing_price" && rows.length > pageSize);
    } catch (cause) { if (currentRequest === requestId.current) setError(`Nuk mund të ngarkohen transaksionet. ${cause.message}`); }
    finally { if (currentRequest === requestId.current) setLoading(false); }
  }, [status, appliedSearch, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const timer = window.setTimeout(() => setSelectedIds([]), 0);
    return () => window.clearTimeout(timer);
  }, [status, appliedSearch]);

  useEffect(() => {
    if (tab !== "transactions") return;
    const timer = window.setTimeout(loadTransactions, 0);
    return () => window.clearTimeout(timer);
  }, [tab, loadTransactions]);
  useEffect(() => {
    const timer = window.setTimeout(loadSummary, 0);
    return () => window.clearTimeout(timer);
  }, [loadSummary]);

  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true);
    setCustomerError("");
    try {
      const [rows, aggregates] = await Promise.all([
        fuelExternalCustomersApi.list(),
        fuelExternalTransactionsApi.customerSummaries(),
      ]);
      setCustomers(rows);
      setCustomerSummaries(Object.fromEntries(aggregates.map((item) => [item.external_customer_id, item])));
    } catch (cause) { setCustomerError(`Nuk mund të ngarkohen klientët. ${cause.message}`); }
    finally { setCustomersLoading(false); }
  }, []);

  useEffect(() => {
    if (tab !== "customers") return;
    const timer = window.setTimeout(loadCustomers, 0);
    return () => window.clearTimeout(timer);
  }, [tab, loadCustomers]);

  const refreshTransactions = async () => {
    if (page === 0) await Promise.all([loadTransactions(), loadSummary()]);
    else { setPage(0); await loadSummary(); }
  };

  const savePrice = async (event) => {
    event.preventDefault();
    const price = Number(priceForm.unit_price);
    if (!Number.isFinite(price) || price <= 0) { setError("Çmimi për litër duhet të jetë më i madh se zero."); return; }
    setBusy(true);
    setError("");
    try {
      await fuelExternalTransactionsApi.update(priceForm.row.id, { unit_price: price, comment: priceForm.comment.trim() || null });
      setPriceForm(null);
      await refreshTransactions();
    } catch (cause) { setError(`Çmimi nuk mund të ruhej. ${cause.message}`); }
    finally { setBusy(false); }
  };

  const settleSelected = async () => {
    setBusy(true);
    setError("");
    let failed = 0;
    for (let index = 0; index < selectedIds.length; index += 10) {
      const results = await Promise.allSettled(selectedIds.slice(index, index + 10).map((id) => fuelExternalTransactionsApi.update(id, { is_settled: true })));
      failed += results.filter((result) => result.status === "rejected").length;
    }
    const total = selectedIds.length;
    setBulkSettleOpen(false);
    setSelectedIds([]);
    await refreshTransactions();
    if (failed) setError(`${failed} nga ${total} transaksione nuk u shënuan si të paguara. Provo përsëri për ato që kanë mbetur.`);
    setBusy(false);
  };

  const revertSettlement = async () => {
    setBusy(true);
    setError("");
    try {
      await fuelExternalTransactionsApi.update(detailRow.id, { is_settled: false });
      setDetailRow(null);
      await refreshTransactions();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  const saveCustomer = async (event) => {
    event.preventDefault();
    const body = { first_name: customerForm.first_name.trim(), last_name: customerForm.last_name.trim(), phone_number: customerForm.phone_number.trim() || null, comment: customerForm.comment.trim() || null };
    if (!body.first_name || !body.last_name || !customerForm.registration_number.trim()) { setCustomerError("Plotëso targën, emrin dhe mbiemrin."); return; }
    setBusy(true);
    setCustomerError("");
    try {
      const creating = customerForm.id == null;
      if (creating) {
        const created = await fuelExternalCustomersApi.create({ registration_number: customerForm.registration_number.trim().toUpperCase(), ...body });
        setCustomerWarning(created.piusi_registration_synced === false);
        setCustomerMessage(created.piusi_registration_synced === false ? "Klienti u shtua, por targa nuk u regjistrua në PIUSI. Kontrollo regjistrimin në PIUSI." : "Klienti u shtua me sukses.");
      } else {
        await fuelExternalCustomersApi.update(customerForm.id, { ...body, is_active: customerForm.is_active });
        setCustomerWarning(false);
        setCustomerMessage("Të dhënat e klientit u ruajtën.");
      }
      setCustomerForm(null);
      setCustomerSearch("");
      if (creating && customerFilter) setCustomerFilter("");
      await loadCustomers();
    } catch (cause) { setCustomerError(`Klienti nuk mund të ruhej. ${cause.message}`); }
    finally { setBusy(false); }
  };

  const loadHistory = async (customerId, offset = 0) => {
    const currentRequest = ++historyRequestId.current;
    setHistoryLoading(true);
    setCustomerError("");
    try {
      const rows = await fuelExternalTransactionsApi.list({ external_customer_id: customerId, limit: pageSize + 1, offset });
      if (currentRequest !== historyRequestId.current) return;
      setHistory((previous) => offset === 0 ? rows.slice(0, pageSize) : [...previous, ...rows.slice(0, pageSize)]);
      setHistoryHasNext(rows.length > pageSize);
    } catch (cause) { if (currentRequest === historyRequestId.current) setCustomerError(`Nuk mund të ngarkohet historiku. ${cause.message}`); }
    finally { if (currentRequest === historyRequestId.current) setHistoryLoading(false); }
  };

  const openCustomer = (customer) => {
    setSelectedCustomer(customer);
    setHistory([]);
    setHistoryHasNext(false);
    setCustomerError("");
    loadHistory(customer.id);
  };

  const visibleCustomers = customers.filter((customer) => (customerFilter === "" || String(customer.is_active) === customerFilter) && (!customerSearch.trim() || [customer.registration_number, customer.first_name, customer.last_name, customer.phone_number].some((value) => String(value || "").toLocaleLowerCase("sq-AL").includes(customerSearch.trim().toLocaleLowerCase("sq-AL")))));
  const transactionGroups = ["unsettled", "missing_price"].includes(status) ? Object.values(transactions.reduce((groups, row) => {
    const id = row.external_customer.id;
    if (!groups[id]) groups[id] = { customer: row.external_customer, rows: [] };
    groups[id].rows.push(row);
    return groups;
  }, {})).map((group) => ({ ...group, rows: group.rows.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date)) })) : [];
  const selectedTotal = transactions.filter((row) => selectedIds.includes(row.id)).reduce((total, row) => total + Number(row.external_detail.total_amount || 0), 0);
  const toggleGroup = (rows) => {
    const ids = rows.map((row) => row.id);
    setSelectedIds((previous) => ids.every((id) => previous.includes(id)) ? previous.filter((id) => !ids.includes(id)) : [...new Set([...previous, ...ids])]);
  };
  const renderTransaction = (row, selectable = false) => {
    const detail = row.external_detail;
    const state = statusOf(detail);
    return <article className="bt-fuel-external-row" key={row.id}>{selectable && <label className="bt-fuel-unpaid-check"><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => setSelectedIds((previous) => previous.includes(row.id) ? previous.filter((id) => id !== row.id) : [...previous, row.id])} aria-label={`Zgjidh transaksionin e datës ${formatDateTime(row.transaction_date)}`} /></label>}<div className="bt-fuel-external-identity"><strong>{row.external_customer.registration_number}</strong><span>{customerName(row.external_customer)}</span><small>{formatDateTime(row.transaction_date)}</small></div><div className="bt-fuel-external-facts"><span><b>{formatNumber(row.quantity_liters)} L</b><small>Sasia</small></span><span><b>{detail.unit_price == null ? "—" : `${formatNumber(detail.unit_price)} MKD/L`}</b><small>Çmimi/L</small></span><span><b>{mkd(detail.total_amount)}</b><small>Totali</small></span></div><div className="bt-fuel-external-row-actions">{!selectable && <span className={`bt-fuel-settlement-status is-${state}`}>{statusLabel[state]}</span>}{state === "missing_price" && <button type="button" className="bt-btn-primary" onClick={() => { setError(""); setPriceForm({ row, unit_price: "", comment: detail.comment || "" }); }}>Vendos çmimin</button>}<button type="button" className="bt-fuel-external-detail-button" onClick={() => setDetailRow(row)}>Detaje</button></div></article>;
  };

  return <div className="bt-page bt-ops-page bt-fuel-customers-page">
    <header className="bt-page-header"><div><span className="bt-eyebrow">Bashkim Tours · Nafta</span><h1>Klientët e jashtëm</h1><p>Menaxho klientët, furnizimet dhe detyrimet e tyre.</p></div>{tab === "customers" && <button type="button" className="bt-btn-primary" onClick={() => { setCustomerForm({ ...emptyCustomer }); setCustomerError(""); }}><Plus size={18} /> Shto klient</button>}</header>
    <div className="bt-fuel-customer-tabs" role="tablist" aria-label="Klientët e jashtëm"><button type="button" role="tab" id="bt-fuel-transactions-tab" aria-controls="bt-fuel-transactions-panel" aria-selected={tab === "transactions"} className={tab === "transactions" ? "active" : ""} onClick={() => setTab("transactions")}>Transaksionet</button><button type="button" role="tab" id="bt-fuel-customers-tab" aria-controls="bt-fuel-customers-panel" aria-selected={tab === "customers"} className={tab === "customers" ? "active" : ""} onClick={() => setTab("customers")}>Klientët</button></div>

    {tab === "transactions" && <section id="bt-fuel-transactions-panel" role="tabpanel" aria-labelledby="bt-fuel-transactions-tab" className="bt-fuel-external-transactions">
      <div className="bt-fuel-external-transactions-head"><h2>Transaksionet e klientëve</h2><p>Furnizimet me karburant për klientët e jashtëm.</p></div>
      <section className="bt-mini-stats bt-fuel-filter-cards" aria-label="Filtro transaksionet sipas statusit">
        <button type="button" className={status === "" ? "active" : ""} aria-pressed={status === ""} onClick={() => { setStatus(""); setPage(0); }}><strong>{summary?.total_count ?? "Të gjithë"}</strong><span>Transaksionet</span></button>
        <button type="button" className={status === "missing_price" ? "active" : ""} aria-pressed={status === "missing_price"} onClick={() => { setStatus(status === "missing_price" ? "" : "missing_price"); setPage(0); }}><strong>{summary?.missing_price_count ?? "—"}</strong><span>Pa vendosur çmimin e naftës</span></button>
        <button type="button" className={status === "unsettled" ? "active" : ""} aria-pressed={status === "unsettled"} onClick={() => { setStatus(status === "unsettled" ? "" : "unsettled"); setPage(0); }}><strong>{summary?.unsettled_count ?? "—"}</strong><span>Pa paguar</span><small>{mkd(summary?.unsettled_total_mkd)}</small></button>
        <button type="button" className={status === "settled" ? "active" : ""} aria-pressed={status === "settled"} onClick={() => { setStatus(status === "settled" ? "" : "settled"); setPage(0); }}><strong>{summary?.settled_count ?? "—"}</strong><span>Të paguara</span><small>{summary?.settled_total_mkd == null ? "— MKD" : mkd(summary.settled_total_mkd)}</small></button>
      </section>
      {summaryError && <p className="bt-inline-error" role="alert">{summaryError}</p>}
      <div className="bt-admin-filters bt-student-filters bt-fuel-external-controls"><label className="bt-labeled-filter"><span>Kërko transaksionin</span><div><Search aria-hidden="true" /><input placeholder="Targë ose emër klienti…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></div></label></div>
      {error && !priceForm && !detailRow && <p className="bt-inline-error" role="alert">{error}</p>}
      {loading && <p role="status">Duke ngarkuar transaksionet…</p>}
      {!loading && !transactions.length && !error && <div className="bt-fuel-suppliers-empty"><strong>{status || search ? "Nuk u gjet asnjë transaksion" : "Nuk ka ende transaksione"}</strong>{!status && !search && <p>Transaksionet do të shfaqen automatikisht këtu kur një klient i jashtëm furnizohet me karburant.</p>}</div>}
      {!loading && !!transactions.length && status === "unsettled" && <div className="bt-fuel-unpaid-toolbar"><label><input type="checkbox" checked={selectedIds.length === transactions.length} onChange={() => setSelectedIds(selectedIds.length === transactions.length ? [] : transactions.map((row) => row.id))} /> Zgjidh të gjitha ({transactions.length})</label><span>{selectedIds.length} të zgjedhura · {mkd(selectedTotal)}</span><button type="button" className="bt-btn-primary" disabled={!selectedIds.length || busy} onClick={() => setBulkSettleOpen(true)}>Shëno si të paguara</button></div>}
      {!loading && !!transactions.length && ["unsettled", "missing_price"].includes(status) && <div className="bt-fuel-unpaid-groups">{transactionGroups.map(({ customer, rows }) => <section className="bt-fuel-unpaid-group" key={customer.id}><header className="bt-fuel-unpaid-group-head">{status === "unsettled" ? <label><input type="checkbox" checked={rows.every((row) => selectedIds.includes(row.id))} onChange={() => toggleGroup(rows)} /> <strong>{customer.registration_number}</strong> · {customerName(customer)}</label> : <div className="bt-fuel-group-customer"><strong>{customer.registration_number}</strong><span>{customerName(customer)}</span></div>}<span>{rows.length} transaksione{status === "unsettled" ? ` · ${mkd(rows.reduce((total, row) => total + Number(row.external_detail.total_amount || 0), 0))}` : ""}</span></header><div className="bt-fuel-external-list">{rows.map((row) => renderTransaction(row, status === "unsettled"))}</div></section>)}</div>}
      {!loading && !!transactions.length && !["unsettled", "missing_price"].includes(status) && <div className="bt-fuel-external-list">{transactions.map((row) => renderTransaction(row))}</div>}
      {!loading && hasNext && <div className="bt-fuel-transaction-pagination"><button type="button" className="bt-btn-secondary" onClick={() => setPage(page + 1)}>Shfaq më shumë</button></div>}
    </section>}

    {tab === "customers" && <section id="bt-fuel-customers-panel" role="tabpanel" aria-labelledby="bt-fuel-customers-tab">
      <section className="bt-mini-stats bt-fuel-filter-cards bt-fuel-customer-filter-cards" aria-label="Filtro klientët sipas statusit"><button type="button" className={customerFilter === "" ? "active" : ""} aria-pressed={customerFilter === ""} onClick={() => setCustomerFilter("")}><strong>{customersLoading ? "—" : customers.length}</strong><span>Të gjithë</span></button><button type="button" className={customerFilter === "true" ? "active" : ""} aria-pressed={customerFilter === "true"} onClick={() => setCustomerFilter("true")}><strong>{customersLoading ? "—" : customers.filter((customer) => customer.is_active).length}</strong><span>Aktivë</span></button><button type="button" className={customerFilter === "false" ? "active" : ""} aria-pressed={customerFilter === "false"} onClick={() => setCustomerFilter("false")}><strong>{customersLoading ? "—" : customers.filter((customer) => !customer.is_active).length}</strong><span>Joaktivë</span></button></section>
      <div className="bt-admin-filters bt-student-filters bt-fuel-customer-toolbar"><label className="bt-labeled-filter"><span>Kërko klientin</span><div><Search aria-hidden="true" /><input placeholder="Targë, emër ose telefon…" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} /></div></label><label className="bt-labeled-filter"><span>Statusi</span><div><select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}>{[["", "Të gjithë"], ["true", "Aktivë"], ["false", "Joaktivë"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></label></div>
      {customerMessage && <p className={customerWarning ? "bt-inline-error" : "bt-fuel-success"} role="status">{customerMessage}</p>}
      {customerError && !customerForm && !selectedCustomer && <p className="bt-inline-error" role="alert">{customerError}</p>}
      {customersLoading ? <p role="status">Duke ngarkuar klientët…</p> : !visibleCustomers.length && !customerError ? <p className="bt-fuel-suppliers-empty">Nuk u gjet asnjë klient.</p> : <div className="bt-fuel-supplier-list">{visibleCustomers.map((customer) => { const aggregate = customerSummaries[customer.id]; return <article className="bt-fuel-supplier-card bt-fuel-customer-card" key={customer.id}><button type="button" className="bt-fuel-customer-open" onClick={() => openCustomer(customer)}><strong>{customer.registration_number}</strong><span>{customerName(customer)} · {customer.is_active ? "Aktiv" : "Joaktiv"}</span>{customer.phone_number && <small>{customer.phone_number}</small>}{aggregate && <small>{aggregate.transaction_count} furnizime · {mkd(aggregate.unsettled_total_mkd)} pa paguar</small>}</button><button type="button" className="bt-fuel-edit" aria-label={`Ndrysho klientin ${customerName(customer)}`} title="Ndrysho" onClick={() => { setCustomerForm({ ...customer, phone_number: customer.phone_number || "", comment: customer.comment || "" }); setCustomerError(""); }}><Pencil size={17} /></button></article>; })}</div>}
    </section>}

    {priceForm && <Modal title="Vendos çmimin" className="bt-fuel-supplier-modal" onClose={() => { if (!busy) setPriceForm(null); }}><form onSubmit={savePrice}>{error && <p className="bt-inline-error" role="alert">{error}</p>}<p><strong>{customerName(priceForm.row.external_customer)}</strong> · {priceForm.row.external_customer.registration_number}</p><p>Sasia: <strong>{formatNumber(priceForm.row.quantity_liters)} L</strong></p><div className="bt-fuel-fields"><label>Çmimi për litër (MKD/L)<input type="number" min="0.001" step="any" required value={priceForm.unit_price} onChange={(event) => setPriceForm({ ...priceForm, unit_price: event.target.value })} /></label><div className="bt-fuel-price-preview">Totali <strong>{Number(priceForm.unit_price) > 0 ? mkd(Number(priceForm.row.quantity_liters) * Number(priceForm.unit_price)) : "—"}</strong></div><label className="bt-fuel-customer-comment-field">Koment<textarea rows={3} value={priceForm.comment} onChange={(event) => setPriceForm({ ...priceForm, comment: event.target.value })} /></label></div><div className="bt-fuel-actions"><button type="button" className="bt-btn-secondary" disabled={busy} onClick={() => setPriceForm(null)}>Anulo</button><button type="submit" className="bt-btn-primary" disabled={busy}>{busy ? "Duke ruajtur…" : "Ruaj"}</button></div></form></Modal>}
    {bulkSettleOpen && <Modal title="Shëno si të paguara?" className="bt-fuel-supplier-modal" onClose={() => { if (!busy) setBulkSettleOpen(false); }}><div><p>Do të shënosh si të paguara <strong>{selectedIds.length} transaksione</strong> me vlerë <strong>{mkd(selectedTotal)}</strong>.</p><div className="bt-fuel-actions"><button type="button" className="bt-btn-secondary" disabled={busy} onClick={() => setBulkSettleOpen(false)}>Anulo</button><button type="button" className="bt-btn-primary" disabled={busy} onClick={settleSelected}>{busy ? "Duke ruajtur…" : "Konfirmo pagesën"}</button></div></div></Modal>}
    {detailRow && <Modal title="Detajet e transaksionit" className="bt-fuel-supplier-modal" onClose={() => { if (!busy) setDetailRow(null); }}><div>{error && <p className="bt-inline-error" role="alert">{error}</p>}<p><strong>{detailRow.external_customer.registration_number}</strong> · {customerName(detailRow.external_customer)}</p><dl className="bt-fuel-external-detail-list"><div><dt>Data</dt><dd>{formatDateTime(detailRow.transaction_date)}</dd></div><div><dt>Sasia</dt><dd>{formatNumber(detailRow.quantity_liters)} L</dd></div><div><dt>Çmimi/L</dt><dd>{detailRow.external_detail.unit_price == null ? "—" : `${formatNumber(detailRow.external_detail.unit_price)} MKD/L`}</dd></div><div><dt>Totali</dt><dd>{mkd(detailRow.external_detail.total_amount)}</dd></div><div><dt>Statusi</dt><dd>{statusLabel[statusOf(detailRow.external_detail)]}</dd></div>{detailRow.external_detail.settled_at && <div><dt>Paguar më</dt><dd>{formatDateTime(detailRow.external_detail.settled_at)}</dd></div>}{detailRow.external_detail.comment && <div><dt>Koment</dt><dd>{detailRow.external_detail.comment}</dd></div>}</dl>{detailRow.external_detail.is_settled && <button type="button" className="bt-btn-secondary" disabled={busy} onClick={revertSettlement}>Kthe në pa paguar</button>}</div></Modal>}
    {customerForm && <Modal title={customerForm.id == null ? "Shto klient" : "Ndrysho klientin"} className="bt-fuel-supplier-modal" onClose={() => { if (!busy) setCustomerForm(null); }}><form onSubmit={saveCustomer}>{customerError && <p className="bt-inline-error" role="alert">{customerError}</p>}<div className="bt-fuel-fields"><label>Targa<input required maxLength={16} value={customerForm.registration_number} readOnly={customerForm.id != null} onChange={(event) => setCustomerForm({ ...customerForm, registration_number: event.target.value.toUpperCase() })} /></label><label>Emri<input required maxLength={100} value={customerForm.first_name} onChange={(event) => setCustomerForm({ ...customerForm, first_name: event.target.value })} /></label><label>Mbiemri<input required maxLength={100} value={customerForm.last_name} onChange={(event) => setCustomerForm({ ...customerForm, last_name: event.target.value })} /></label><label>Telefoni<input type="tel" maxLength={50} value={customerForm.phone_number} onChange={(event) => setCustomerForm({ ...customerForm, phone_number: event.target.value })} /></label><label className="bt-fuel-customer-comment-field">Koment<textarea rows={3} value={customerForm.comment} onChange={(event) => setCustomerForm({ ...customerForm, comment: event.target.value })} /></label>{customerForm.id != null && <label className="bt-fuel-customer-active"><input type="checkbox" checked={customerForm.is_active} onChange={(event) => setCustomerForm({ ...customerForm, is_active: event.target.checked })} /> Klient aktiv</label>}</div><div className="bt-fuel-actions"><button type="button" className="bt-btn-secondary" disabled={busy} onClick={() => setCustomerForm(null)}>Anulo</button><button type="submit" className="bt-btn-primary" disabled={busy}>{busy ? "Duke ruajtur…" : customerForm.id == null ? "Shto klient" : "Ruaj"}</button></div></form></Modal>}
    {selectedCustomer && <Modal title={customerName(selectedCustomer)} className="bt-fuel-supplier-modal" onClose={() => { historyRequestId.current++; setSelectedCustomer(null); }}><div><p><strong>{selectedCustomer.registration_number}</strong> · {selectedCustomer.is_active ? "Aktiv" : "Joaktiv"}</p>{selectedCustomer.phone_number && <p><Phone size={15} /> {selectedCustomer.phone_number}</p>}{selectedCustomer.comment && <p>{selectedCustomer.comment}</p>}<div className="bt-fuel-external-summary"><span>Pa paguar <strong>{mkd(customerSummaries[selectedCustomer.id]?.unsettled_total_mkd)}</strong></span><span>Furnizime <strong>{customerSummaries[selectedCustomer.id]?.transaction_count ?? 0}</strong></span><span>Gjithsej <strong>{formatNumber(customerSummaries[selectedCustomer.id]?.total_liters ?? 0)} L</strong></span></div><h3>Historiku</h3>{customerError && <p className="bt-inline-error" role="alert">{customerError}</p>}{historyLoading && <p role="status">Duke ngarkuar historikun…</p>}{!historyLoading && !history.length && !customerError && <p>Nuk ka ende furnizime.</p>}<div className="bt-fuel-customer-history">{history.map((row) => <div key={row.id}><span>{formatDateTime(row.transaction_date)}</span><strong>{formatNumber(row.quantity_liters)} L</strong><span>{row.external_detail.unit_price == null ? "Pa vendosur çmimin e naftës" : mkd(row.external_detail.total_amount)}</span><small>{statusLabel[statusOf(row.external_detail)]}</small></div>)}</div>{historyHasNext && !historyLoading && <button type="button" className="bt-btn-secondary" onClick={() => loadHistory(selectedCustomer.id, history.length)}>Shfaq më shumë</button>}</div></Modal>}
  </div>;
}
