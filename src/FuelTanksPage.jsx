import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Fuel, LoaderCircle, MoreVertical, Pencil, Plus, Search, X } from "lucide-react";
import { fuelExternalCustomersApi, fuelExternalRefuellingsApi, fuelExternalTransactionsApi, fuelLedgerApi, fuelRefuellingLocationsApi, fuelSuppliersApi, fuelTanksApi, fuelTransactionsApi } from "./api";
import { Modal } from "./PortalPages";
import CharterDateTimeField from "./CharterDateTimeField";
import DateInput from "./DateInput";
import CharterReferencePicker from "./CharterReferencePicker";
import { formatDateTime } from "./dateUtils";

const fuelTypes = { DIESEL: "Naftë", PETROL: "Benzinë", ADBLUE: "AdBlue" };
const liters = (value) => `${new Intl.NumberFormat("sq-AL", { maximumFractionDigits: 2 }).format(Number(value || 0))} L`;
const money = (value, currency) => value == null ? "—" : new Intl.NumberFormat("sq-AL", currency ? { style: "currency", currency } : { maximumFractionDigits: 2 }).format(Number(value));
const detailValue = (value) => value == null || value === "" ? "—" : value;
const vehicleLabel = (vehicle) => vehicle ? [vehicle.registration_number, vehicle.brand, vehicle.type].filter(Boolean).join(" · ") : "";
const transactionMapping = (transaction) => transaction.transaction_type === "INCOMING" ? "incoming" : transaction.vehicle ? "vehicle" : transaction.staff_vehicle ? "staff" : transaction.external_customer ? "external" : transaction.piusi_detail?.registration_number?.trim() ? "unmapped" : "outgoing";
const externalCustomerLabel = (customer) => [customer.registration_number, [customer.first_name, customer.last_name].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
const transactionPlate = (transaction) => transaction.piusi_detail?.registration_number || transaction.vehicle?.registration_number || transaction.staff_vehicle?.registration_number || transaction.external_customer?.registration_number;
const transactionOdometer = (transaction) => transaction.piusi_detail?.odometer == null ? "—" : new Intl.NumberFormat("sq-AL", { maximumFractionDigits: 2 }).format(Number(transaction.piusi_detail.odometer));
const calculatedTotal = (quantity, unitPrice) => {
  if (quantity === "" || unitPrice === "") return "";
  const total = Number(quantity) * Number(unitPrice);
  return Number.isFinite(total) && total > 0 ? Number(total.toPrecision(12)).toString() : "";
};
const localDateTime = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const pageSize = 20;
const emptyHistoryFilters = { search: "", date_from: "", date_to: "", transaction_type: "", supplier_id: "", external_customer_id: "", location_id: "", registration_number: "", piusi_driver_id: "", min_liters: "", max_liters: "", min_odometer: "", max_odometer: "", is_settled: "", sort_order: "desc" };
const filterFieldsByType = {
  "": ["registration_number", "supplier_id", "external_customer_id", "location_id", "min_liters", "max_liters", "min_odometer", "max_odometer", "is_settled"],
  INCOMING: ["supplier_id", "min_liters", "max_liters"],
  EXTERNAL_REFUELLING: ["registration_number", "location_id", "min_liters", "max_liters", "min_odometer", "max_odometer"],
  EXTERNAL_CUSTOMER: ["registration_number", "external_customer_id", "min_liters", "max_liters", "min_odometer", "max_odometer", "is_settled"],
  STAFF_VEHICLE: ["registration_number", "min_liters", "max_liters", "min_odometer", "max_odometer"],
  UNMAPPED: ["registration_number", "piusi_driver_id", "min_liters", "max_liters", "min_odometer", "max_odometer"],
};
const filtersForType = (filters, type) => Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, ["search", "date_from", "date_to", "sort_order"].includes(key) || filterFieldsByType[type].includes(key) ? value : ""]));
const tankId = 1;
const historyParams = (filters, page) => ({ tank_id: tankId, ...filters, page, page_size: pageSize });
const overviewTypes = [["", "Të gjitha", "all"], ["INCOMING", "Nafta hyrëse", "incoming"], ["EXTERNAL_REFUELLING", "Furnizimet nga Jashtë", "refuelling"], ["EXTERNAL_CUSTOMER", "Furnizimet e klientëve", "customer"], ["STAFF_VEHICLE", "Veturat e Stafit", "staff"], ["UNMAPPED", "Pa Mapping", "unmapped"]];
const externalColors = { GREEN: "Gjelbër", ORANGE: "Portokalli", YELLOW: "Verdhë", RED: "Kuqe" };
const numberText = (value) => value == null ? "—" : new Intl.NumberFormat("sq-AL", { maximumFractionDigits: 2 }).format(Number(value));
const mkd = (value) => value == null ? "—" : `${numberText(value)} MKD`;
const externalEditValues = (detail) => ({ id: detail.id, refuelling_date: detail.refuelling_date, bus: detail.bus ? `${detail.bus.source}:${detail.bus.id}` : "", quantity_liters: String(detail.quantity_liters), odometer_km: detail.odometer_km == null ? "" : String(detail.odometer_km), driver_id: detail.driver?.id == null ? "" : String(detail.driver.id), location_id: detail.location?.id == null ? "" : String(detail.location.id), card: detail.card || "", comment: detail.comment || "" });
const overviewDetails = (row, detail) => {
  const base = [["Data", formatDateTime(row.transaction_date)], ["Lloji", row.source_type === "EXTERNAL_REFUELLING" ? "Furnizim nga Jashte" : overviewTypes.find(([type]) => type === row.source_type)?.[1] || "Dalje nga rezervari"], ["Sasia", liters(row.quantity_liters)]];
  if (row.source_type === "EXTERNAL_REFUELLING") return [...base, ["Targa", detail?.bus?.registration_number || row.registration_number], ["Kilometrazha", numberText(detail?.odometer_km ?? row.odometer_km)], ["Shoferi", detail?.driver?.name || row.driver_name], ["Lokacioni", detail?.location?.name || row.location_name], ["Kartela", detail?.card || row.card], ["Koment", detail?.comment || row.comment]];
  if (row.source_type === "EXTERNAL_CUSTOMER") {
    const customer = detail?.external_customer;
    const payment = detail?.external_detail;
    const price = payment?.unit_price ?? row.unit_price;
    const settled = payment?.is_settled ?? row.is_settled;
    return [...base, ["Targa", customer?.registration_number || row.registration_number], ["Klienti", customer ? externalCustomerLabel(customer) : row.external_customer_name], ["Telefoni", customer?.phone_number], ["Kilometrazha", numberText(detail?.piusi_detail?.odometer ?? row.odometer_km)], ["Çmimi për litër", price == null ? "—" : `${numberText(price)} MKD/L`], ["Totali", mkd(payment?.total_amount ?? row.total_amount)], ["Statusi", price == null ? "Pa vendosur çmimin e naftës" : settled ? "Paguar" : "Pa paguar"], ["Paguar më", payment?.settled_at || row.settled_at ? formatDateTime(payment?.settled_at || row.settled_at) : null], ["Koment", payment?.comment || row.comment]];
  }
  const piusi = detail?.piusi_detail;
  const incoming = detail?.incoming_detail;
  const rows = [...base];
  if (row.source_type === "INCOMING") rows.push(["Furnitori", row.supplier_name], ["Çmimi për litër", money(incoming?.unit_price ?? row.unit_price, incoming?.currency)], ["Shuma totale", money(incoming?.total_amount ?? row.total_amount, incoming?.currency)], ["Valuta", incoming?.currency], ["Koment", incoming?.comment || row.comment]);
  else {
    rows.push(["Targa", piusi?.registration_number || row.registration_number], ["Kilometrazha", numberText(piusi?.odometer ?? row.odometer_km)]);
    if (row.source_type === "STAFF_VEHICLE") rows.push(["Pronari", detail?.staff_vehicle?.owner_name || row.staff_vehicle_owner_name], ["Automjeti i stafit", detail?.staff_vehicle?.registration_number], ["Statusi i automjetit", detail?.staff_vehicle ? detail.staff_vehicle.is_active ? "Aktiv" : "Joaktiv" : null]);
    if (detail?.vehicle) rows.push(["Automjeti", vehicleLabel(detail.vehicle)], ["Viti", detail.vehicle.year], ["Vendet", detail.vehicle.seats]);
    rows.push(["Njësia e kilometrazhit", piusi?.odometer_unit], ["PIUSI ID", piusi?.piusi_driver_id ?? row.piusi_driver_id], ["ID e transaksionit PIUSI", piusi?.piusi_transaction_id], ["ID progresive PIUSI", piusi?.piusi_progressive_id], ["ID e dispenserit", piusi?.piusi_dispenser_id], ["ID e pompës", piusi?.piusi_pump_id], ["Autorizimi", piusi?.auth], ["Lloji i furnizimit", piusi?.dispense_type], ["Anomalia", piusi?.anomaly], ["Statusi PIUSI", piusi?.status]);
  }
  return rows;
};

export default function FuelTanksPage() {
  const [tanks, setTanks] = useState([]);
  const [transactions, setTransactions] = useState({});
  const [transactionPage, setTransactionPage] = useState(1);
  const [historyFilters, setHistoryFilters] = useState(emptyHistoryFilters);
  const [overviewType, setOverviewType] = useState("");
  const [overview, setOverview] = useState(null);
  const [overviewPage, setOverviewPage] = useState(1);
  const [customerPaymentFilter, setCustomerPaymentFilter] = useState("");
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState("");
  const [overviewSelected, setOverviewSelected] = useState(null);
  const [overviewDetail, setOverviewDetail] = useState(null);
  const [overviewDetailLoading, setOverviewDetailLoading] = useState(false);
  const [overviewDetailError, setOverviewDetailError] = useState("");
  const [inlineExternalEdit, setInlineExternalEdit] = useState(null);
  const [inlineColorId, setInlineColorId] = useState(null);
  const [inlineExternalOptions, setInlineExternalOptions] = useState(null);
  const [externalCreate, setExternalCreate] = useState(null);
  const [externalCreateLoading, setExternalCreateLoading] = useState(false);
  const [externalCreateBusy, setExternalCreateBusy] = useState(false);
  const [externalCreateError, setExternalCreateError] = useState("");
  const [inlineColorDetails, setInlineColorDetails] = useState({});
  const [inlineBusyId, setInlineBusyId] = useState(null);
  const [inlineError, setInlineError] = useState("");
  const [customerPriceEdit, setCustomerPriceEdit] = useState(null);
  const [customerDetailEdit, setCustomerDetailEdit] = useState(null);
  const [customerBusyId, setCustomerBusyId] = useState(null);
  const [historyDraft, setHistoryDraft] = useState(emptyHistoryFilters);
  const [historyPagination, setHistoryPagination] = useState(null);
  const [advancedHistory, setAdvancedHistory] = useState(false);
  const [historyOptions, setHistoryOptions] = useState({ suppliers: [], customers: [], locations: [] });
  const [historyOptionsLoading, setHistoryOptionsLoading] = useState(false);
  const [historyOptionsError, setHistoryOptionsError] = useState("");
  const [loadingPageId, setLoadingPageId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [transactionError, setTransactionError] = useState("");
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const initialLoadStarted = useRef(false);
  const transactionsRef = useRef(null);
  const historyOptionsLoaded = useRef(false);
  const overviewDetailRequest = useRef(0);
  const overviewListRequest = useRef(0);
  const historyListRequest = useRef(0);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setTanks([await fuelTanksApi.get(tankId)]); }
    catch (cause) { setError(`Rezervari: ${cause.message}`); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    if (initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    Promise.resolve().then(load);
  }, [load]);

  const fetchHistory = async (filters, page, scroll = false) => {
    const request = ++historyListRequest.current;
    setLoadingPageId(tankId); setTransactionError("");
    try {
      if (overviewType === "UNMAPPED") {
        const response = await fuelTransactionsApi.listUnmapped(historyParams(filters, page));
        if (request !== historyListRequest.current) return;
        setTransactions((current) => ({ ...current, [tankId]: { items: response.items } }));
        setHistoryPagination(response.pagination);
        setHistoryFilters(filters);
        setTransactionPage(page);
        if (scroll) requestAnimationFrame(() => transactionsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
        return;
      }
      const response = await fuelTransactionsApi.list(historyParams({ ...filters, transaction_type: "INCOMING" }, page));
      if (request !== historyListRequest.current) return;
      setTransactions((current) => ({ ...current, [tankId]: { items: response.items } }));
      setHistoryPagination(response.pagination);
      setHistoryFilters(filters);
      setTransactionPage(page);
      if (scroll) requestAnimationFrame(() => transactionsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
    } catch (cause) { if (request === historyListRequest.current) { setTransactions((current) => ({ ...current, [tankId]: { items: [] } })); setHistoryPagination(null); setTransactionError(`Transaksionet: ${cause.message}`); } }
    finally { if (request === historyListRequest.current) setLoadingPageId(null); }
  };
  const fetchOverview = useCallback(async (type, filters, page) => {
    const request = ++overviewListRequest.current;
    setOverviewLoading(true); setOverviewError("");
    try {
      const sharedFilters = Object.fromEntries(Object.entries(filters).filter(([key]) => key !== "transaction_type" && key !== "piusi_driver_id"));
      let result;
      let displayPage = page;
      if (type === "EXTERNAL_CUSTOMER" && customerPaymentFilter) {
        delete sharedFilters.is_settled;
        const statusFilters = { ...sharedFilters, source_type: type, ...(customerPaymentFilter === "paid" ? { is_settled: true } : customerPaymentFilter === "unpaid" ? { is_settled: false } : {}) };
        if (customerPaymentFilter === "paid") {
          result = await fuelLedgerApi.list({ ...statusFilters, page, page_size: pageSize });
        } else {
          const first = await fuelLedgerApi.list({ ...statusFilters, page: 1, page_size: 200 });
          const rows = [...first.items];
          for (let start = 2; start <= first.pagination.total_pages; start += 5) {
            const pages = await Promise.all(Array.from({ length: Math.min(5, first.pagination.total_pages - start + 1) }, (_, index) => fuelLedgerApi.list({ ...statusFilters, page: start + index, page_size: 200 })));
            if (request !== overviewListRequest.current) return;
            pages.forEach((response) => rows.push(...response.items));
          }
          const matching = rows.filter((row) => customerPaymentFilter === "no_price" ? row.unit_price == null : !row.is_settled);
          const total_pages = Math.ceil(matching.length / pageSize);
          displayPage = Math.min(page, Math.max(1, total_pages));
          result = { ...first, items: matching.slice((displayPage - 1) * pageSize, displayPage * pageSize), pagination: { page: displayPage, page_size: pageSize, total: matching.length, total_pages } };
        }
      } else result = await fuelLedgerApi.list({ ...sharedFilters, source_type: type, page, page_size: pageSize });
      if (request !== overviewListRequest.current) return;
      setOverview(result); setOverviewPage(displayPage);
      const externalRows = result.items.filter((row) => row.source_type === "EXTERNAL_REFUELLING");
      if (externalRows.length) {
        const details = await Promise.allSettled(externalRows.map((row) => fuelExternalRefuellingsApi.get(row.source_id)));
        if (request !== overviewListRequest.current) return;
        setInlineColorDetails((current) => ({ ...current, ...Object.fromEntries(details.flatMap((item, index) => item.status === "fulfilled" ? [[externalRows[index].source_id, item.value]] : [])) }));
      }
    } catch (cause) { if (request === overviewListRequest.current) { setOverview(null); setOverviewError(cause.message); } }
    finally { if (request === overviewListRequest.current) setOverviewLoading(false); }
  }, [customerPaymentFilter]);
  const openOverviewDetail = async (row) => {
    const request = ++overviewDetailRequest.current;
    setOverviewSelected(row); setOverviewDetail(null); setInlineExternalEdit(null); setCustomerDetailEdit(null); setOverviewDetailError(""); setInlineError(""); setOverviewDetailLoading(true);
    try {
      const detail = row.source_type === "EXTERNAL_REFUELLING" ? await fuelExternalRefuellingsApi.get(row.source_id) : await fuelTransactionsApi.get(row.source_id);
      if (request === overviewDetailRequest.current) {
        setOverviewDetail(detail);
        if (row.source_type === "EXTERNAL_CUSTOMER") {
          setCustomerDetailEdit({ unit_price: detail.external_detail?.unit_price == null ? "" : String(detail.external_detail.unit_price), is_settled: Boolean(detail.external_detail?.is_settled), comment: detail.external_detail?.comment || "" });
        }
        if (row.source_type === "EXTERNAL_REFUELLING") {
          setInlineColorDetails((current) => ({ ...current, [row.source_id]: detail }));
          setInlineExternalEdit(externalEditValues(detail));
          if (!inlineExternalOptions) {
            fuelExternalRefuellingsApi.list({ page_size: 1 }).then((result) => {
              if (request === overviewDetailRequest.current) setInlineExternalOptions(result.options);
            }).catch((cause) => {
              if (request === overviewDetailRequest.current) setInlineError(`Opsionet nuk u ngarkuan. ${cause.message}`);
            });
          }
        }
      }
    } catch (cause) { if (request === overviewDetailRequest.current) setOverviewDetailError(cause.message); }
    finally { if (request === overviewDetailRequest.current) setOverviewDetailLoading(false); }
  };
  const closeOverviewDetail = () => { if (inlineBusyId || customerBusyId != null) return; overviewDetailRequest.current += 1; setOverviewSelected(null); setInlineExternalEdit(null); setCustomerDetailEdit(null); setInlineError(""); };
  const saveCustomerDetail = async (event) => {
    event.preventDefault();
    const form = customerDetailEdit;
    const price = form.unit_price.trim() === "" ? null : Number(form.unit_price);
    if (price != null && (!Number.isFinite(price) || price <= 0)) { setInlineError("Çmimi për litër duhet të jetë më i madh se zero."); return; }
    if (overviewDetail?.external_detail?.unit_price != null && price == null) { setInlineError("Vendos një çmim të vlefshëm për litër."); return; }
    setCustomerBusyId(overviewSelected.source_id); setInlineError("");
    try {
      const body = { is_settled: form.is_settled, comment: form.comment.trim() || null };
      if (price != null) body.unit_price = price;
      await fuelExternalTransactionsApi.update(overviewSelected.source_id, body);
      overviewDetailRequest.current += 1;
      setOverviewSelected(null); setOverviewDetail(null); setCustomerDetailEdit(null);
      await fetchOverview(overviewType, historyFilters, overviewPage);
    } catch (cause) { setInlineError(`Furnizimi i klientit nuk u ruajt. ${cause.message}`); }
    finally { setCustomerBusyId(null); }
  };
  const saveInlineExternalEdit = async (event) => {
    event.preventDefault();
    const form = inlineExternalEdit;
    const [busSource, busId] = form.bus ? form.bus.split(":") : [];
    const quantity = Number(form.quantity_liters);
    if (!Number.isFinite(quantity) || quantity <= 0) { setInlineError("Litrazha duhet të jetë më e madhe se zero."); return; }
    setInlineBusyId(`edit:${form.id}`); setInlineError("");
    try {
      const original = inlineColorDetails[form.id];
      const updated = await fuelExternalRefuellingsApi.update(form.id, { refuelling_date: form.refuelling_date, bus_source: busSource || null, bus_id: busId || null, quantity_liters: quantity, odometer_km: form.odometer_km === "" ? null : Number(form.odometer_km), driver_id: form.driver_id || null, location_id: form.location_id === "" ? null : Number(form.location_id), color: original?.color || null, card: form.card.trim() || null, comment: form.comment.trim() || null });
      setInlineColorDetails((current) => ({ ...current, [form.id]: updated }));
      overviewDetailRequest.current += 1;
      setOverviewSelected(null);
      setOverviewDetail(null);
      setInlineExternalEdit(null);
      await fetchOverview(overviewType, historyFilters, overviewPage);
    } catch (cause) { setInlineError(`Furnizimi nuk u ruajt. ${cause.message}`); }
    finally { setInlineBusyId(null); }
  };
  const toggleInlineColor = async (row) => {
    if (inlineColorId === row.source_id) { setInlineColorId(null); return; }
    setInlineColorId(row.source_id); setInlineError("");
    if (inlineColorDetails[row.source_id]) return;
    setInlineBusyId(`color:${row.source_id}`);
    try {
      const detail = await fuelExternalRefuellingsApi.get(row.source_id);
      setInlineColorDetails((current) => ({ ...current, [row.source_id]: detail }));
    } catch (cause) { setInlineError(`Ngjyra nuk u ngarkua. ${cause.message}`); }
    finally { setInlineBusyId(null); }
  };
  const setInlineColor = async (row, color) => {
    const detail = inlineColorDetails[row.source_id] || (overviewSelected?.source_id === row.source_id ? overviewDetail : null);
    if (!detail) return;
    setInlineBusyId(`color:${row.source_id}`); setInlineError("");
    try {
      const updated = await fuelExternalRefuellingsApi.update(row.source_id, { refuelling_date: detail.refuelling_date, bus_source: detail.bus?.source ?? null, bus_id: detail.bus?.id ?? null, quantity_liters: detail.quantity_liters, odometer_km: detail.odometer_km, driver_id: detail.driver?.id ?? null, location_id: detail.location?.id ?? null, color, card: detail.card, comment: detail.comment });
      setInlineColorDetails((current) => ({ ...current, [row.source_id]: updated }));
      if (overviewSelected?.source_id === row.source_id) setOverviewDetail(updated);
      setInlineColorId(null);
    } catch (cause) { setInlineError(`Ngjyra nuk u ruajt. ${cause.message}`); }
    finally { setInlineBusyId(null); }
  };
  useEffect(() => {
    if (overviewType === "INCOMING" || overviewType === "UNMAPPED") return;
    const timer = window.setTimeout(() => fetchOverview(overviewType, historyFilters, 1), 0);
    return () => window.clearTimeout(timer);
  }, [overviewType, historyFilters, fetchOverview]);
  const applyHistory = (filters) => {
    const next = filtersForType(filters, overviewType);
    setHistoryFilters(next);
    if (overviewType === "INCOMING" || overviewType === "UNMAPPED") fetchHistory(next, 1);
  };
  const changeOverviewType = (type) => {
    historyListRequest.current += 1;
    overviewListRequest.current += 1;
    setOverviewType(type);
    setCustomerPaymentFilter("");
    setHistoryFilters((current) => filtersForType(current, type));
    setHistoryDraft((current) => filtersForType(current, type));
  };
  useEffect(() => {
    if (overviewType !== "UNMAPPED" && overviewType !== "INCOMING") return;
    const timer = window.setTimeout(() => fetchHistory(historyFilters, 1), 0);
    return () => window.clearTimeout(timer);
  // The tab change is the trigger; fetchHistory uses the current filter state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewType]);
  useEffect(() => {
    const refresh = () => {
      fuelTanksApi.get(tankId).then((tank) => setTanks([tank])).catch((cause) => setError(`Rezervari: ${cause.message}`));
      if (overviewType === "INCOMING" || overviewType === "UNMAPPED") fetchHistory(historyFilters, transactionPage);
      else fetchOverview(overviewType, historyFilters, overviewPage);
    };
    window.addEventListener("bt:fuel-reconnected", refresh);
    return () => window.removeEventListener("bt:fuel-reconnected", refresh);
  });
  const loadHistoryOptions = async () => {
    if (historyOptionsLoaded.current || historyOptionsLoading) return;
    historyOptionsLoaded.current = true;
    setHistoryOptionsLoading(true); setHistoryOptionsError("");
    const responses = await Promise.allSettled([fuelSuppliersApi.list({ limit: 1000 }), fuelExternalCustomersApi.list(), fuelRefuellingLocationsApi.list()]);
    setHistoryOptions({ suppliers: responses[0].status === "fulfilled" ? responses[0].value : [], customers: responses[1].status === "fulfilled" ? responses[1].value : [], locations: responses[2].status === "fulfilled" ? responses[2].value : [] });
    if (responses.some((result) => result.status === "rejected")) { setHistoryOptionsError("Disa opsione nuk u ngarkuan."); historyOptionsLoaded.current = false; }
    setHistoryOptionsLoading(false);
  };
  const openAdvancedHistory = () => { setAdvancedHistory((current) => !current); if (!advancedHistory) loadHistoryOptions(); };
  const loadExternalCreateOptions = async () => {
    setExternalCreateLoading(true); setExternalCreateError("");
    try { setInlineExternalOptions((await fuelExternalRefuellingsApi.list({ page_size: 1 })).options); }
    catch (cause) { setExternalCreateError(`Opsionet nuk u ngarkuan. ${cause.message}`); }
    finally { setExternalCreateLoading(false); }
  };
  const openExternalCreate = () => {
    setExternalCreate({ refuelling_date: localDateTime().slice(0, 10), bus: "", quantity_liters: "", odometer_km: "", driver_id: "", location_id: "", card: "", comment: "" });
    setExternalCreateError("");
    if (!inlineExternalOptions) loadExternalCreateOptions();
  };
  const saveExternalCreate = async (event) => {
    event.preventDefault();
    const form = externalCreate;
    const quantity = Number(form.quantity_liters);
    if (!Number.isFinite(quantity) || quantity <= 0) { setExternalCreateError("Litrazha duhet të jetë më e madhe se zero."); return; }
    const [busSource, busId] = form.bus ? form.bus.split(":") : [];
    setExternalCreateBusy(true); setExternalCreateError("");
    try {
      await fuelExternalRefuellingsApi.create({ refuelling_date: form.refuelling_date, bus_source: busSource || null, bus_id: busId || null, quantity_liters: quantity, odometer_km: form.odometer_km === "" ? null : Number(form.odometer_km), driver_id: form.driver_id || null, location_id: form.location_id === "" ? null : Number(form.location_id), card: form.card.trim() || null, comment: form.comment.trim() || null });
      setExternalCreate(null);
      setOverviewType("EXTERNAL_REFUELLING");
      setHistoryDraft(emptyHistoryFilters);
      setHistoryFilters({ ...emptyHistoryFilters });
    } catch (cause) { setExternalCreateError(`Furnizimi nuk u regjistrua. ${cause.message}`); }
    finally { setExternalCreateBusy(false); }
  };
  const externalCreateButton = () => <button type="button" className="bt-btn-secondary bt-fuel-external-create-button" onClick={openExternalCreate}><Plus size={15} /> Regjistro furnizim nga jashtë</button>;
  const externalCreatePicker = (key, label, choices) => <div className="bt-external-dropdown" key={key}><span>{label}</span><CharterReferencePicker label={label} value={externalCreate[key]} selectedLabel={choices.find((item) => String(item.id) === String(externalCreate[key]))?.label || ""} placeholder={`Kërko ${label.toLocaleLowerCase("sq-AL")}`} searchOptions={(query) => choices.filter((item) => item.label.toLocaleLowerCase("sq-AL").includes(query.toLocaleLowerCase("sq-AL")))} onSelect={(option) => setExternalCreate((current) => ({ ...current, [key]: option ? String(option.id) : "" }))} /></div>;
  const historyInput = (key, label, type = "text", props = {}) => <label key={key}>{label}{type === "date" ? <DateInput value={historyDraft[key]} onChange={(value) => setHistoryDraft({ ...historyDraft, [key]: value })} /> : <input type={type} value={historyDraft[key]} onChange={(event) => setHistoryDraft({ ...historyDraft, [key]: event.target.value })} {...props} />}</label>;
  const historyFilterActions = () => <div className="bt-external-filter-actions"><button type="submit" className="bt-btn-primary"><Search size={16} /> Kërko</button><button type="button" className="bt-btn-secondary" onClick={() => { setHistoryDraft(emptyHistoryFilters); applyHistory(emptyHistoryFilters); }}><X size={15} /> Pastro filtrat</button></div>;
  const historyPicker = (key, label, choices) => <div className="bt-external-dropdown" key={key}><span>{label}</span><CharterReferencePicker label={label} value={historyDraft[key]} selectedLabel={choices.find((item) => String(item.id) === String(historyDraft[key]))?.label || ""} placeholder={`Kërko ${label.toLocaleLowerCase("sq-AL")}`} searchOptions={(query) => choices.filter((item) => item.label.toLocaleLowerCase("sq-AL").includes(query.toLocaleLowerCase("sq-AL")))} onSelect={(option) => setHistoryDraft({ ...historyDraft, [key]: option ? String(option.id) : key === "sort_order" ? "desc" : "" })} /></div>;
  const externalRowFacts = (row) => row.source_type === "EXTERNAL_REFUELLING" ? <div className="bt-fuel-external-row-facts">
    <span><small>Shoferi</small><strong>{inlineColorDetails[row.source_id]?.driver?.name || row.driver_name || "—"}</strong></span>
    <span><small>Lokacioni</small><strong>{inlineColorDetails[row.source_id]?.location?.name || row.location_name || "—"}</strong></span>
    <span><small>Kartela</small><strong>{inlineColorDetails[row.source_id]?.card || row.card || "—"}</strong></span>
    {(inlineColorDetails[row.source_id]?.comment || row.comment) && <span className="bt-fuel-external-row-comment"><small>Koment</small><strong>{inlineColorDetails[row.source_id]?.comment || row.comment}</strong></span>}
  </div> : null;
  const saveCustomerPrice = async (row, value) => {
    setCustomerPriceEdit(null);
    if (!value.trim()) return;
    const price = Number(value);
    if (!Number.isFinite(price) || price <= 0) { setInlineError("Çmimi për litër duhet të jetë më i madh se zero."); return; }
    setCustomerBusyId(row.source_id); setInlineError("");
    try {
      await fuelExternalTransactionsApi.update(row.source_id, { unit_price: price });
      await fetchOverview(overviewType, historyFilters, overviewPage);
    } catch (cause) { setInlineError(`Çmimi nuk u ruajt. ${cause.message}`); }
    finally { setCustomerBusyId(null); }
  };
  const toggleCustomerPayment = async (row) => {
    if (customerBusyId != null) return;
    setCustomerBusyId(row.source_id); setInlineError("");
    try {
      await fuelExternalTransactionsApi.update(row.source_id, { is_settled: !row.is_settled });
      await fetchOverview(overviewType, historyFilters, overviewPage);
    } catch (cause) { setInlineError(`Statusi i pagesës nuk u ruajt. ${cause.message}`); }
    finally { setCustomerBusyId(null); }
  };
  const customerOverviewRow = (row) => {
    const hasPrice = row.unit_price != null;
    const editingPrice = customerPriceEdit?.id === row.source_id;
    const saving = customerBusyId === row.source_id;
    return <li className="is-external bt-fuel-customer-overview-row" key={`${row.source_type}:${row.source_id}`}>
      <span className="bt-fuel-transaction-icon"><ArrowUpRight size={20} /></span>
      <div className="bt-fuel-transaction-main bt-fuel-customer-overview-main">
        <strong>Dalje nga rezervari</strong>
        <time dateTime={row.transaction_date}>{formatDateTime(row.transaction_date)}</time>
        <span className="bt-fuel-transaction-origin">GARAZHA-TANKER</span>
      </div>
      <div className="bt-fuel-transaction-column bt-fuel-customer-overview-person">
        <small>Targa</small><span>{row.registration_number || "—"}</span>
        <small className="bt-fuel-customer-person-name">{row.external_customer_name || "—"}</small>
      </div>
      <div className="bt-fuel-transaction-column bt-fuel-customer-overview-km"><small>Kilometrazhi</small><span>{numberText(row.odometer_km)}</span></div>
      <b className="bt-fuel-customer-overview-quantity">−{liters(row.quantity_liters)}</b>
      <button type="button" className="bt-fuel-transaction-detail" onClick={() => openOverviewDetail(row)}>Detaje</button>
      <div className="bt-fuel-customer-overview-secondary">
        <div className="bt-fuel-customer-overview-price">
          <span>{editingPrice ? <input className="bt-fuel-customer-price-input" type="number" min="0.001" step="any" autoFocus aria-label="Çmimi për litër në MKD" value={customerPriceEdit.value} onChange={(event) => setCustomerPriceEdit({ id: row.source_id, value: event.target.value })} onBlur={(event) => saveCustomerPrice(row, event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } if (event.key === "Escape") { event.currentTarget.value = ""; event.currentTarget.blur(); } }} /> : <strong>{hasPrice ? `${numberText(row.unit_price)} MKD/L` : "—"}</strong>}<small>Çmimi/L</small></span>
          <span><strong>{mkd(row.total_amount)}</strong><small>Totali</small></span>
        </div>
        <div className="bt-fuel-customer-overview-actions">
          {!hasPrice && <button type="button" className="bt-fuel-customer-status is-missing" disabled={saving || customerBusyId != null} onClick={() => setCustomerPriceEdit({ id: row.source_id, value: "" })}>Pa Çmim</button>}
          <button type="button" className={`bt-fuel-customer-status ${row.is_settled ? "is-paid" : "is-unpaid"}`} disabled={saving || customerBusyId != null} onClick={() => toggleCustomerPayment(row)} title={row.is_settled ? "Kthe në pa paguar" : "Shëno si të paguar"}>{row.is_settled ? "Paguar" : "Pa Paguar"}</button>
        </div>
      </div>
      {(row.settled_at || row.comment) && <div className="bt-fuel-customer-overview-extra">
        {row.settled_at && <span><small>Paguar më</small><strong>{formatDateTime(row.settled_at)}</strong></span>}
        {row.comment && <span><small>Koment</small><strong>{row.comment}</strong></span>}
      </div>}
    </li>;
  };
  const externalColorMenu = (row) => {
    if (row.source_type !== "EXTERNAL_REFUELLING") return null;
    const detail = inlineColorDetails[row.source_id];
    const open = inlineColorId === row.source_id;
    const busy = inlineBusyId === `color:${row.source_id}`;
    return <div className="bt-external-row-menu"><button type="button" className="bt-external-row-menu-toggle" aria-label={`Ngjyros furnizimin e datës ${formatDateTime(row.transaction_date)}`} aria-expanded={open} disabled={busy} onClick={() => toggleInlineColor(row)}><MoreVertical size={18} /></button>{open && detail && <div className="bt-external-color-options" role="group" aria-label="Zgjidh ngjyrën">{[...Object.keys(externalColors), null].map((color) => <button key={color || "NONE"} type="button" className={`bt-external-color-choice bt-external-color-choice-${(color || "none").toLowerCase()}${detail.color === color ? " is-selected" : ""}`} aria-label={color ? externalColors[color] : "Pa ngjyrë"} aria-pressed={detail.color === color} title={color ? externalColors[color] : "Pa ngjyrë"} disabled={busy} onClick={() => setInlineColor(row, color)} />)}</div>}</div>;
  };

  const save = async (event) => {
    event.preventDefault();
    const capacity = Number(form.capacity_liters);
    const quantity = Number(form.current_quantity_liters);
    const threshold = Number(form.low_level_threshold_liters);
    if (!form.name.trim() || capacity <= 0 || quantity < 0 || threshold < 0 || quantity > capacity || threshold > capacity) {
      setError("Kontrollo emrin dhe sasitë: kapaciteti duhet të jetë pozitiv, ndërsa sasia dhe pragu duhet të jenë mes 0 dhe kapacitetit.");
      return;
    }
    setBusy(true);
    setError("");
    const body = { name: form.name.trim(), fuel_type: form.fuel_type, capacity_liters: capacity, current_quantity_liters: quantity, low_level_threshold_liters: threshold };
    if (editingId != null) body.low_fuel_alert_enabled = form.low_fuel_alert_enabled;
    try {
      if (editingId != null) await fuelTanksApi.update(editingId, body);
      else await fuelTanksApi.create(body);
      setForm(null);
      setEditingId(null);
      await load();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  const edit = (tank) => {
    setEditingId(tank.id);
    setForm({ name: tank.name, fuel_type: tank.fuel_type, capacity_liters: tank.capacity_liters, current_quantity_liters: tank.current_quantity_liters, low_level_threshold_liters: tank.low_level_threshold_liters, low_fuel_alert_enabled: tank.low_fuel_alert_enabled });
    setError("");
  };
  const closeForm = () => {
    if (busy) return;
    setForm(null);
    setEditingId(null);
    setError("");
  };
  const openIncoming = async (id) => {
    setIncoming({ tank_id: id, quantity_liters: "", transaction_date: localDateTime(), supplier_id: "", unit_price: "", total_amount: "", currency: "EUR", comment: "" });
    setError("");
    setSupplierLoading(true);
    try { setSuppliers(await fuelSuppliersApi.list({ limit: 1000 })); }
    catch (cause) { setError(cause.message); }
    finally { setSupplierLoading(false); }
  };
  const showTransaction = async (transaction) => {
    setTransactionError("");
    let detail;
    try {
      detail = await fuelTransactionsApi.get(transaction.id);
      setSelectedTransaction(detail);
    } catch (cause) { setTransactionError(`Detajet: ${cause.message}`); return; }
    const supplierId = detail.incoming_detail?.supplier_id;
    if (supplierId && !suppliers.some((supplier) => supplier.id === supplierId)) {
      try {
        const supplier = await fuelSuppliersApi.get(supplierId);
        setSuppliers((current) => current.some((item) => item.id === supplier.id) ? current : [...current, supplier]);
      } catch { /* The transaction details still remain available if a supplier was removed. */ }
    }
  };
  const addIncoming = async (event) => {
    event.preventDefault();
    const quantity = Number(incoming.quantity_liters);
    if (!Number.isFinite(quantity) || quantity <= 0) { setError("Sasia duhet të jetë më e madhe se zero."); return; }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(incoming.transaction_date) || Number.isNaN(new Date(incoming.transaction_date).getTime())) { setError("Zgjidh datën dhe orën e transaksionit."); return; }
    if (!incoming.supplier_id) { setError("Zgjidh furnitorin."); return; }
    for (const key of ["unit_price", "total_amount"]) {
      if (incoming[key] !== "" && (!Number.isFinite(Number(incoming[key])) || Number(incoming[key]) <= 0)) { setError("Çmimi dhe shuma totale duhet të jenë më të mëdha se zero."); return; }
    }
    setBusy(true);
    setError("");
    try {
      const created = await fuelTransactionsApi.createIncoming({ tank_id: incoming.tank_id, quantity_liters: quantity, transaction_date: new Date(incoming.transaction_date).toISOString(), supplier_id: Number(incoming.supplier_id), unit_price: incoming.unit_price === "" ? null : Number(incoming.unit_price), total_amount: incoming.total_amount === "" ? null : Number(incoming.total_amount), currency: incoming.unit_price || incoming.total_amount ? incoming.currency : null, comment: incoming.comment.trim() || null });
      setIncoming(null);
      await load();
      if (overviewType === "INCOMING" || overviewType === "UNMAPPED") await fetchHistory(historyFilters, 1);
      else await fetchOverview(overviewType, historyFilters, 1);
      setSelectedTransaction(created);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  return <div className="bt-page bt-ops-page bt-fuel-page">
    <header className="bt-page-header"><div><span className="bt-eyebrow">Bashkim Tours · Nafta</span><h1>Depozitat e naftës</h1><p>Gjendja dhe detajet e rezervarëve të karburantit.</p></div></header>
    {error && !form && !incoming && <p className="bt-inline-error" role="alert">{error}</p>}
    {loading && <p>Duke ngarkuar rezervarët…</p>}
    {!loading && !tanks.length && !error && <p>Nuk ka ende rezervarë.</p>}
    <div className="bt-fuel-cards">{tanks.map((tank) => {
      const capacity = Number(tank.capacity_liters);
      const quantity = Number(tank.current_quantity_liters);
      const threshold = Number(tank.low_level_threshold_liters);
      const critical = quantity <= threshold;
      const warning = !critical && quantity <= threshold + capacity * 0.2;
      const fill = capacity > 0 ? Math.min(100, Math.max(0, quantity / capacity * 100)) : 0;
      const levelClass = critical ? "is-critical" : warning ? "is-warning" : "";
      return <div className="bt-fuel-group" key={tank.id}><article className={`bt-fuel-card ${levelClass}`}>
        <div className="bt-fuel-card-head"><span className="bt-fuel-card-icon"><Fuel size={27} aria-hidden="true" /></span><div><h2>{tank.name}</h2><p>{fuelTypes[tank.fuel_type] || tank.fuel_type}</p></div><div className="bt-fuel-card-actions"><button type="button" className="bt-btn-primary" onClick={() => openIncoming(tank.id)}><Plus size={17} /> Shto hyrje</button><button type="button" className="bt-fuel-edit" aria-label={`Ndrysho rezervarin ${tank.name}`} title="Ndrysho" onClick={() => edit(tank)}><Pencil size={18} /></button></div></div>
        {tank.piusi_sync_failed && <p className="bt-inline-error" role="status">Sinkronizimi me PIUSI nuk u krye. Gjendja e shfaqur mund të mos jetë e përditësuar.</p>}
        <div className={`bt-fuel-card-quantity ${levelClass}`}><div className="bt-fuel-quantity-heading"><span>Sasia aktuale</span>{critical && <span className="bt-fuel-low">Nivel kritik</span>}{warning && <span className="bt-fuel-low">Afër nivelit të ulët</span>}</div><strong>{liters(tank.current_quantity_liters)}</strong><div className="bt-fuel-meter" role="meter" aria-label={`Mbushja e rezervarit ${tank.name}`} aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={quantity}><span style={{ width: `${fill}%` }} /></div><small>{Math.round(fill)}% e kapacitetit prej {liters(tank.capacity_liters)}</small></div>
      </article><div className="bt-fuel-overview-tabs" role="group" aria-label="Lloji i furnizimit">{overviewTypes.map(([type, label, color]) => <button key={type} type="button" className={`is-${color}${overviewType === type ? " active" : ""}`} aria-pressed={overviewType === type} onClick={() => changeOverviewType(type)}>{label}</button>)}</div><form className="bt-external-refuelling-filters bt-fuel-history-filters" onSubmit={(event) => { event.preventDefault(); applyHistory(historyDraft); }}><div className="bt-fuel-filters">{historyInput("search", "Kërko", "search", { placeholder: "Targa, furnitori, klienti…" })}{historyInput("date_from", "Nga data", "date")}{historyInput("date_to", "Deri më", "date")}{historyPicker("sort_order", "Renditja", [{ id: "desc", label: "Më të rejat" }, { id: "asc", label: "Më të vjetrat" }])}</div><div className="bt-fuel-ledger-filter-toolbar"><button type="button" className="bt-btn-secondary" aria-expanded={advancedHistory} onClick={openAdvancedHistory}>Filtra shtesë <ChevronDown size={16} /></button>{!advancedHistory && historyFilterActions()}</div>{advancedHistory && <div className="bt-fuel-ledger-advanced"><div className="bt-fuel-filters">{filterFieldsByType[overviewType].includes("registration_number") && historyInput("registration_number", "Targa")}{filterFieldsByType[overviewType].includes("piusi_driver_id") && historyInput("piusi_driver_id", "PIUSI ID", "number", { min: 1 })}{historyInput("min_liters", "Litra min.", "number", { min: 0, step: "any" })}{historyInput("max_liters", "Litra max.", "number", { min: 0, step: "any" })}{filterFieldsByType[overviewType].includes("min_odometer") && historyInput("min_odometer", "Km min.", "number", { min: 0, step: "any" })}{filterFieldsByType[overviewType].includes("max_odometer") && historyInput("max_odometer", "Km max.", "number", { min: 0, step: "any" })}{overviewType !== "EXTERNAL_CUSTOMER" && filterFieldsByType[overviewType].includes("is_settled") && historyPicker("is_settled", "Pagesa", [{ id: "true", label: "Paguar" }, { id: "false", label: "Pa paguar" }])}{filterFieldsByType[overviewType].includes("supplier_id") && historyPicker("supplier_id", "Furnitori", historyOptions.suppliers.map((item) => ({ id: item.id, label: item.name })))}{filterFieldsByType[overviewType].includes("external_customer_id") && historyPicker("external_customer_id", "Klienti i jashtëm", historyOptions.customers.map((item) => ({ id: item.id, label: [item.registration_number, item.first_name, item.last_name].filter(Boolean).join(" · ") })) )}{filterFieldsByType[overviewType].includes("location_id") && historyPicker("location_id", "Lokacioni", historyOptions.locations.map((item) => ({ id: item.id, label: item.name })))}</div>{historyOptionsLoading && <p role="status">Duke ngarkuar opsionet…</p>}{historyOptionsError && <p className="bt-inline-error" role="alert">{historyOptionsError} <button type="button" onClick={loadHistoryOptions}>Provo përsëri</button></p>}</div>}{advancedHistory && <div className="bt-fuel-advanced-filter-actions">{historyFilterActions()}</div>}</form>{overviewType === "EXTERNAL_CUSTOMER" && <div className="bt-fuel-customer-quick-filters" role="group" aria-label="Filtro furnizimet e klientëve sipas pagesës">{[["", "Të gjitha"], ["paid", "Paguar"], ["unpaid", "Pa Pagesë"], ["no_price", "Pa Çmim"]].map(([value, label]) => <button key={value} type="button" className={`is-${value || "all"}${customerPaymentFilter === value ? " active" : ""}`} aria-pressed={customerPaymentFilter === value} onClick={() => setCustomerPaymentFilter(value)}>{label}</button>)}</div>}{(overviewType === "INCOMING" || overviewType === "UNMAPPED") ? <section ref={transactionsRef} className="bt-fuel-transactions" aria-label={`Transaksionet e rezervarit ${tank.name}`} aria-busy={loadingPageId === tank.id}><div className="bt-fuel-transactions-head"><div><h3>Transaksionet</h3><p>{overviewType === "INCOMING" ? "Hyrjet e karburantit" : "Daljet pa mapping"}</p></div>{externalCreateButton()}</div>
        {transactionError && <p className="bt-inline-error" role="alert">{transactionError}</p>}
        {loadingPageId === tank.id && <p className="bt-fuel-page-loading" role="status"><LoaderCircle size={18} aria-hidden="true" /> Duke ngarkuar transaksionet…</p>}
        {!transactions[tank.id]?.items.length ? <p className="bt-fuel-transactions-empty">Nuk ka transaksione në këtë faqe.</p> : <ul className="bt-fuel-transaction-list">{transactions[tank.id].items.map((transaction) => { const mapping = transactionMapping(transaction); const isIncoming = mapping === "incoming"; const label = mapping === "vehicle" ? [transaction.vehicle.brand, transaction.vehicle.type].filter(Boolean).join(" · ") : mapping === "staff" ? transaction.staff_vehicle.owner_name : mapping === "external" ? [transaction.external_customer.first_name, transaction.external_customer.last_name].filter(Boolean).join(" ") : ""; return <li className={`is-${mapping}`} key={transaction.id}><span className="bt-fuel-transaction-icon">{isIncoming ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}</span><div className="bt-fuel-transaction-main"><strong>{isIncoming ? "Hyrje" : "Dalje"}{label ? ` · ${label}` : ""}{mapping === "staff" && <span className="bt-fuel-transaction-badge">Automjet i stafit</span>}{mapping === "external" && <span className="bt-fuel-transaction-badge">Klient i jashtëm</span>}{mapping === "unmapped" && <span className="bt-fuel-transaction-badge">Pa mapping</span>}</strong><time dateTime={transaction.transaction_date}>{formatDateTime(transaction.transaction_date)}</time>{transaction.piusi_detail && <span className="bt-fuel-transaction-origin">GARAZHA-TANKER</span>}</div><div className="bt-fuel-transaction-column bt-fuel-transaction-plate"><small>Targa</small><span>{transactionPlate(transaction) || "—"}</span></div><div className="bt-fuel-transaction-column bt-fuel-transaction-km"><small>Kilometrazhi</small><span>{transactionOdometer(transaction)}</span></div><b>{isIncoming ? "+" : "−"}{liters(transaction.quantity_liters)}</b><button type="button" className="bt-fuel-transaction-detail" onClick={() => showTransaction(transaction)}>Detaje</button></li>; })}</ul>}
        {historyPagination && historyPagination.total_pages > 1 && <div className="bt-fuel-transaction-pagination"><button type="button" className="bt-btn-secondary" disabled={loadingPageId != null || transactionPage <= 1} onClick={() => fetchHistory(historyFilters, transactionPage - 1, true)}>Mbrapa</button><span className={loadingPageId === tank.id ? "bt-fuel-pagination-loading" : ""}>{loadingPageId === tank.id && <LoaderCircle size={17} aria-hidden="true" />}{loadingPageId === tank.id ? "Duke ngarkuar…" : `Faqja ${historyPagination.page} nga ${historyPagination.total_pages} · ${historyPagination.total} transaksione`}</span><button type="button" className="bt-btn-secondary" disabled={loadingPageId != null || transactionPage >= historyPagination.total_pages} onClick={() => fetchHistory(historyFilters, transactionPage + 1, true)}>Tjetër</button></div>}
      </section> : <section className="bt-fuel-transactions" aria-label="Pasqyra e furnizimeve" aria-busy={overviewLoading}><div className="bt-fuel-transactions-head"><div><h3>Transaksionet</h3><p>Pasqyra e hyrjeve dhe furnizimeve</p></div>{externalCreateButton()}</div>{overviewError && <p className="bt-inline-error" role="alert">{overviewError}</p>}{inlineError && <p className="bt-inline-error" role="alert">{inlineError}</p>}{overviewLoading && <p className="bt-fuel-page-loading" role="status"><LoaderCircle size={18} /> Duke ngarkuar transaksionet…</p>}{overview && <><ul className="bt-fuel-transaction-list">{overview.items.map((row) => row.source_type === "EXTERNAL_CUSTOMER" ? customerOverviewRow(row) : <li className={`is-${row.source_type === "INCOMING" ? "incoming" : row.source_type === "EXTERNAL_CUSTOMER" ? "external" : row.source_type === "EXTERNAL_REFUELLING" ? "refuelling" : row.source_type === "STAFF_VEHICLE" ? "staff" : "vehicle"}${row.source_type === "EXTERNAL_REFUELLING" && inlineColorDetails[row.source_id]?.color ? ` bt-fuel-refuelling-accent-${inlineColorDetails[row.source_id].color.toLowerCase()}` : ""}`} key={`${row.source_type}:${row.source_id}`}><span className="bt-fuel-transaction-icon">{row.source_type === "INCOMING" ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}</span><div className="bt-fuel-transaction-main"><strong>{row.source_type === "INCOMING" ? "Nafta hyrëse" : row.source_type === "EXTERNAL_REFUELLING" ? "Furnizim nga Jashte" : row.source_type === "EXTERNAL_CUSTOMER" ? "Furnizim klienti" : row.source_type === "STAFF_VEHICLE" ? "Dalje" : "Dalje nga rezervari"}{row.source_type === "EXTERNAL_REFUELLING" && <span className="bt-fuel-external-color-frame" aria-label={inlineColorDetails[row.source_id]?.color ? `Ngjyra: ${externalColors[inlineColorDetails[row.source_id].color]}` : "Pa ngjyrë"}><i className={`bt-external-color-choice-${(inlineColorDetails[row.source_id]?.color || "none").toLowerCase()}`} /></span>}{row.source_type === "EXTERNAL_CUSTOMER" && <span className="bt-fuel-transaction-badge">Klient i jashtëm</span>}{row.source_type === "STAFF_VEHICLE" && <span className="bt-fuel-transaction-badge is-staff">Automjet i stafit</span>}</strong><time>{formatDateTime(row.transaction_date)}</time>{["BT_OUTGOING", "STAFF_VEHICLE", "EXTERNAL_CUSTOMER"].includes(row.source_type) && <span className="bt-fuel-transaction-origin">GARAZHA-TANKER</span>}</div><div className="bt-fuel-transaction-column"><small>Targa</small><span>{row.registration_number || "—"}</span></div><div className="bt-fuel-transaction-column">{row.source_type === "EXTERNAL_REFUELLING" ? <><small>Kilometrazha</small><span>{numberText(inlineColorDetails[row.source_id]?.odometer_km ?? row.odometer_km)}</span></> : <><small>Kilometrazhi</small><span>{numberText(row.odometer_km)}</span></>}</div><b>{row.source_type === "INCOMING" ? "+" : row.source_type === "EXTERNAL_REFUELLING" ? "" : "−"}{liters(row.quantity_liters)}</b><div className="bt-fuel-transaction-row-actions"><button type="button" className="bt-fuel-transaction-detail" onClick={() => openOverviewDetail(row)}>Detaje</button>{externalColorMenu(row)}</div>{externalRowFacts(row)}</li>)}</ul>{!overview.items.length && <p className="bt-fuel-transactions-empty">Nuk ka transaksione për këta filtra.</p>}{overview.pagination?.total_pages > 1 && <div className="bt-fuel-transaction-pagination"><button type="button" className="bt-btn-secondary" disabled={overviewLoading || overviewPage <= 1} onClick={() => fetchOverview(overviewType, historyFilters, overviewPage - 1)}>Mbrapa</button><span>Faqja {overviewPage} nga {overview.pagination.total_pages}</span><button type="button" className="bt-btn-secondary" disabled={overviewLoading || overviewPage >= overview.pagination.total_pages} onClick={() => fetchOverview(overviewType, historyFilters, overviewPage + 1)}>Tjetër</button></div>}</>}</section>}</div>;
    })}</div>
    {form && <Modal title={editingId == null ? "Shto depozitë" : "Përditëso depozitën"} className="bt-fuel-modal" onClose={closeForm}><form className="bt-fuel-form" onSubmit={save}>{error && <p className="bt-inline-error" role="alert">{error}</p>}<div className="bt-fuel-fields">
      <label>Emri<input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>Lloji i karburantit<select value={form.fuel_type} onChange={(event) => setForm({ ...form, fuel_type: event.target.value })}>{Object.entries(fuelTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {[["capacity_liters", "Kapaciteti (L)"], ["current_quantity_liters", "Sasia aktuale (L)"], ["low_level_threshold_liters", "Njofto kur sasia bie në (L)"]].map(([key, label]) => <label key={key}>{label}<input type="number" required min={key === "capacity_liters" ? "0.001" : "0"} step="any" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />{key === "low_level_threshold_liters" && <small>Paralajmërimi shfaqet kur sasia aktuale arrin ose bie nën këtë vlerë.</small>}</label>)}
      {editingId != null && <label className="bt-fuel-alert-enabled"><input type="checkbox" checked={form.low_fuel_alert_enabled} onChange={(event) => setForm({ ...form, low_fuel_alert_enabled: event.target.checked })} /> Aktivizo njoftimin kur nafta bie nën nivelin e caktuar</label>}
    </div><div className="bt-fuel-actions"><button type="submit" className="bt-btn-primary" disabled={busy}>{busy ? "Duke ruajtur…" : "Ruaj"}</button><button type="button" className="bt-btn-secondary" disabled={busy} onClick={closeForm}>Anulo</button></div></form></Modal>}
    {incoming && <Modal title="Shto hyrje karburanti" className="bt-fuel-incoming-modal" onClose={() => { if (!busy) { setIncoming(null); setError(""); } }}>
      <form className="bt-fuel-form" onSubmit={addIncoming}>
        {error && <p className="bt-inline-error" role="alert">{error}</p>}
        <fieldset className="bt-fuel-incoming-group"><legend>Furnizimi</legend><div className="bt-fuel-fields">
          <div className="bt-fuel-supplier-field"><span>Furnitori</span><CharterReferencePicker label="Furnitori" placeholder={supplierLoading ? "Duke ngarkuar furnitorët…" : "Kërko furnitorin"} disabled={supplierLoading} required value={incoming.supplier_id} selectedLabel={suppliers.find((supplier) => String(supplier.id) === incoming.supplier_id)?.name} searchOptions={(query) => suppliers.filter((supplier) => supplier.name.toLocaleLowerCase("sq-AL").includes(query.toLocaleLowerCase("sq-AL"))).map((supplier) => ({ id: supplier.id, label: supplier.name, meta: supplier.phone || "" }))} onSelect={(supplier) => setIncoming({ ...incoming, supplier_id: supplier ? String(supplier.id) : "" })} /></div>
          <label>Sasia hyrëse<input type="number" inputMode="decimal" required min="0.001" step="any" value={incoming.quantity_liters} onChange={(event) => { const quantity_liters = event.target.value; setIncoming({ ...incoming, quantity_liters, total_amount: calculatedTotal(quantity_liters, incoming.unit_price) }); }} /></label>
        </div></fieldset>
        <fieldset className="bt-fuel-incoming-group"><legend>Pagesa dhe data</legend><div className="bt-fuel-fields">
          <div className="bt-fuel-currency-field"><span>Valuta</span><div role="group" aria-label="Valuta" className="bt-fuel-currency-options">{["EUR", "MKD"].map((currency) => <button key={currency} type="button" className={incoming.currency === currency ? "active" : ""} aria-pressed={incoming.currency === currency} onClick={() => setIncoming({ ...incoming, currency })}>{currency}</button>)}</div></div>
          <label>Çmimi për litër<input type="number" min="0.001" step="any" value={incoming.unit_price} onChange={(event) => { const unit_price = event.target.value; setIncoming({ ...incoming, unit_price, total_amount: calculatedTotal(incoming.quantity_liters, unit_price) }); }} /></label>
          <label>Shuma totale<input type="number" min="0.001" step="any" value={incoming.total_amount} placeholder="Llogaritet ose shkruhet manualisht" onChange={(event) => setIncoming({ ...incoming, total_amount: event.target.value })} /></label>
          <CharterDateTimeField label="Data dhe ora (DD/MM/YYYY)" value={incoming.transaction_date} onChange={(value) => setIncoming({ ...incoming, transaction_date: value })} />
          <label className="bt-fuel-comment-field">Koment<textarea value={incoming.comment} onChange={(event) => setIncoming({ ...incoming, comment: event.target.value })} rows={3} /></label>
        </div></fieldset>
        {!supplierLoading && !suppliers.length && <p className="bt-inline-error">Nuk ka furnitorë. Shto një furnitor te skeda “Furnitorët” përpara regjistrimit të hyrjes.</p>}
        <div className="bt-fuel-actions"><button type="submit" className="bt-btn-primary" disabled={busy || supplierLoading || !suppliers.length}>{busy ? "Duke ruajtur…" : "Ruaj hyrjen"}</button><button type="button" className="bt-btn-secondary" disabled={busy} onClick={() => { setIncoming(null); setError(""); }}>Anulo</button></div>
      </form>
    </Modal>}
    {externalCreate && <Modal title="Regjistro furnizim nga jashtë" className="bt-fuel-transaction-modal bt-fuel-external-create-modal" onClose={() => { if (!externalCreateBusy) setExternalCreate(null); }}>
      <form className="bt-fuel-external-modal-form" onSubmit={saveExternalCreate}>
        {externalCreateError && <p className="bt-inline-error bt-fuel-external-create-error" role="alert">{externalCreateError} {!inlineExternalOptions && <button type="button" onClick={loadExternalCreateOptions}>Provo përsëri</button>}</p>}
        {externalCreateLoading && <p className="bt-fuel-external-create-error" role="status">Duke ngarkuar autobusët, shoferët dhe lokacionet…</p>}
        <label>Data<DateInput required value={externalCreate.refuelling_date} onChange={(value) => setExternalCreate({ ...externalCreate, refuelling_date: value })} /></label>
        {externalCreatePicker("bus", "Autobusi / Targa", (inlineExternalOptions?.buses || []).map((bus) => ({ id: `${bus.source}:${bus.id}`, label: bus.registration_number, meta: bus.source === "BUSEXT" ? "BusExt" : "Autobusi" })))}
        <label>Litrazha (L)<input type="number" required min="0.001" step="any" value={externalCreate.quantity_liters} onChange={(event) => setExternalCreate({ ...externalCreate, quantity_liters: event.target.value })} /></label>
        <label>Kilometrazha<input type="number" min="0" step="any" value={externalCreate.odometer_km} onChange={(event) => setExternalCreate({ ...externalCreate, odometer_km: event.target.value })} /></label>
        {externalCreatePicker("driver_id", "Shoferi", (inlineExternalOptions?.drivers || []).map((driver) => ({ id: driver.id, label: driver.name })))}
        {externalCreatePicker("location_id", "Lokacioni", (inlineExternalOptions?.locations || []).map((location) => ({ id: location.id, label: location.name })))}
        <label>Kartela<input value={externalCreate.card} onChange={(event) => setExternalCreate({ ...externalCreate, card: event.target.value })} /></label>
        <label className="bt-fuel-external-modal-comment">Koment<textarea rows={3} value={externalCreate.comment} onChange={(event) => setExternalCreate({ ...externalCreate, comment: event.target.value })} /></label>
        <div className="bt-fuel-actions"><button type="button" className="bt-btn-secondary" disabled={externalCreateBusy} onClick={() => setExternalCreate(null)}>Anulo</button><button type="submit" className="bt-btn-primary" disabled={externalCreateBusy || externalCreateLoading}>{externalCreateBusy ? "Duke ruajtur…" : "Regjistro"}</button></div>
      </form>
    </Modal>}
    {overviewSelected && <Modal title={overviewSelected.source_type === "EXTERNAL_REFUELLING" ? "Detajet e furnizimit" : "Detajet e transaksionit"} className={`bt-fuel-transaction-modal${overviewSelected.source_type === "EXTERNAL_REFUELLING" ? ` bt-fuel-external-modal${overviewDetail?.color ? ` bt-external-row-${overviewDetail.color.toLowerCase()}` : ""}` : ""}`} onClose={closeOverviewDetail}>
      {overviewDetailError && <p className="bt-inline-error" role="alert">Nuk u ngarkuan të gjitha detajet: {overviewDetailError}</p>}
      {inlineError && <p className="bt-inline-error" role="alert">{inlineError}</p>}
      {overviewDetailLoading && <p role="status">Duke ngarkuar detajet…</p>}
      {overviewSelected.source_type === "EXTERNAL_REFUELLING" && overviewDetail && <div className="bt-fuel-external-modal-colors" role="group" aria-label="Ngjyra e furnizimit">{[...Object.keys(externalColors), null].map((color) => <button key={color || "NONE"} type="button" className={`bt-external-color-choice bt-external-color-choice-${(color || "none").toLowerCase()}${overviewDetail.color === color ? " is-selected" : ""}`} aria-label={color ? externalColors[color] : "Pa ngjyrë"} aria-pressed={overviewDetail.color === color} title={color ? externalColors[color] : "Pa ngjyrë"} disabled={inlineBusyId != null} onClick={() => setInlineColor(overviewSelected, color)} />)}</div>}

      {overviewSelected.source_type !== "EXTERNAL_REFUELLING" && overviewSelected.source_type !== "EXTERNAL_CUSTOMER" && <dl className="bt-fuel-transaction-details">{overviewDetails(overviewSelected, overviewDetail).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{detailValue(value)}</dd></div>)}</dl>}
      {overviewSelected.source_type === "EXTERNAL_CUSTOMER" && customerDetailEdit && <form className="bt-fuel-customer-detail-form" onSubmit={saveCustomerDetail}>
        <dl className="bt-fuel-transaction-details">
          <div><dt>Klienti</dt><dd>{overviewDetail?.external_customer ? externalCustomerLabel(overviewDetail.external_customer) : overviewSelected.external_customer_name || "—"}</dd></div>
          <div><dt>Data</dt><dd>{formatDateTime(overviewDetail?.transaction_date || overviewSelected.transaction_date)}</dd></div>
          <div><dt>Sasia</dt><dd>{liters(overviewDetail?.quantity_liters ?? overviewSelected.quantity_liters)}</dd></div>
          <div><dt>Totali</dt><dd>{customerDetailEdit.unit_price ? mkd(Number(customerDetailEdit.unit_price) * Number(overviewDetail?.quantity_liters ?? overviewSelected.quantity_liters)) : "—"}</dd></div>
        </dl>
        <label>Çmimi për litër (MKD/L)<input type="number" min="0.001" step="any" value={customerDetailEdit.unit_price} onChange={(event) => setCustomerDetailEdit({ ...customerDetailEdit, unit_price: event.target.value })} /></label>
        <label>Statusi i pagesës<select value={customerDetailEdit.is_settled ? "paid" : "unpaid"} onChange={(event) => setCustomerDetailEdit({ ...customerDetailEdit, is_settled: event.target.value === "paid" })}><option value="unpaid">Pa Paguar</option><option value="paid">Paguar</option></select></label>
        <label className="bt-fuel-customer-detail-comment">Koment<textarea rows={3} value={customerDetailEdit.comment} onChange={(event) => setCustomerDetailEdit({ ...customerDetailEdit, comment: event.target.value })} /></label>
        <div className="bt-fuel-actions"><button type="button" className="bt-btn-secondary" disabled={customerBusyId != null} onClick={closeOverviewDetail}>Anulo</button><button type="submit" className="bt-btn-primary" disabled={customerBusyId != null}>{customerBusyId != null ? "Duke ruajtur…" : "Ruaj ndryshimet"}</button></div>
      </form>}
      {inlineExternalEdit && <form className="bt-fuel-external-modal-form" onSubmit={saveInlineExternalEdit}>
        <label>Data<DateInput required value={inlineExternalEdit.refuelling_date} onChange={(value) => setInlineExternalEdit({ ...inlineExternalEdit, refuelling_date: value })} /></label>
        <label>Autobusi / Targa<select value={inlineExternalEdit.bus} onChange={(event) => setInlineExternalEdit({ ...inlineExternalEdit, bus: event.target.value })}><option value="">—</option>{inlineExternalEdit.bus && !inlineExternalOptions?.buses.some((bus) => `${bus.source}:${bus.id}` === inlineExternalEdit.bus) && <option value={inlineExternalEdit.bus}>{overviewDetail?.bus?.registration_number || inlineExternalEdit.bus}</option>}{inlineExternalOptions?.buses.map((bus) => <option key={`${bus.source}:${bus.id}`} value={`${bus.source}:${bus.id}`}>{bus.registration_number}</option>)}</select></label>
        <label>Litrazha (L)<input type="number" required min="0.001" step="any" value={inlineExternalEdit.quantity_liters} onChange={(event) => setInlineExternalEdit({ ...inlineExternalEdit, quantity_liters: event.target.value })} /></label>
        <label>Kilometrazha<input type="number" min="0" step="any" value={inlineExternalEdit.odometer_km} onChange={(event) => setInlineExternalEdit({ ...inlineExternalEdit, odometer_km: event.target.value })} /></label>
        <label>Shoferi<select value={inlineExternalEdit.driver_id} onChange={(event) => setInlineExternalEdit({ ...inlineExternalEdit, driver_id: event.target.value })}><option value="">—</option>{inlineExternalEdit.driver_id && !inlineExternalOptions?.drivers.some((driver) => String(driver.id) === inlineExternalEdit.driver_id) && <option value={inlineExternalEdit.driver_id}>{overviewDetail?.driver?.name || inlineExternalEdit.driver_id}</option>}{inlineExternalOptions?.drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label>
        <label>Lokacioni<select value={inlineExternalEdit.location_id} onChange={(event) => setInlineExternalEdit({ ...inlineExternalEdit, location_id: event.target.value })}><option value="">—</option>{inlineExternalEdit.location_id && !inlineExternalOptions?.locations.some((location) => String(location.id) === inlineExternalEdit.location_id) && <option value={inlineExternalEdit.location_id}>{overviewDetail?.location?.name || inlineExternalEdit.location_id}</option>}{inlineExternalOptions?.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <label>Kartela<input value={inlineExternalEdit.card} onChange={(event) => setInlineExternalEdit({ ...inlineExternalEdit, card: event.target.value })} /></label>
        <label className="bt-fuel-external-modal-comment">Koment<textarea rows={3} value={inlineExternalEdit.comment} onChange={(event) => setInlineExternalEdit({ ...inlineExternalEdit, comment: event.target.value })} /></label>
        <div className="bt-fuel-actions"><button type="button" className="bt-btn-secondary" disabled={inlineBusyId != null} onClick={closeOverviewDetail}>Anulo</button><button type="submit" className="bt-btn-primary" disabled={inlineBusyId != null}>{inlineBusyId ? "Duke ruajtur…" : "Ruaj"}</button></div>
      </form>}
    </Modal>}
    {selectedTransaction && <Modal title={`Detajet e ${selectedTransaction.transaction_type === "INCOMING" ? "hyrjes" : "daljes"}`} className="bt-fuel-transaction-modal" onClose={() => setSelectedTransaction(null)}><dl className="bt-fuel-transaction-details"><div><dt>Sasia</dt><dd>{liters(selectedTransaction.quantity_liters)}</dd></div><div><dt>Data dhe ora</dt><dd>{formatDateTime(selectedTransaction.transaction_date)}</dd></div>{selectedTransaction.vehicle && <><div><dt>Automjeti</dt><dd>{vehicleLabel(selectedTransaction.vehicle)}</dd></div><div><dt>Viti</dt><dd>{detailValue(selectedTransaction.vehicle.year)}</dd></div><div><dt>Vendet</dt><dd>{detailValue(selectedTransaction.vehicle.seats)}</dd></div></>}{selectedTransaction.staff_vehicle && <><div><dt>Lidhja</dt><dd>Automjet i stafit</dd></div><div><dt>Targa</dt><dd>{selectedTransaction.staff_vehicle.registration_number}</dd></div><div><dt>Pronari</dt><dd>{selectedTransaction.staff_vehicle.owner_name}</dd></div></>}{selectedTransaction.external_customer && <><div><dt>Lidhja</dt><dd>Klient i jashtëm</dd></div><div><dt>Klienti</dt><dd>{externalCustomerLabel(selectedTransaction.external_customer)}</dd></div><div><dt>Telefoni</dt><dd>{detailValue(selectedTransaction.external_customer.phone_number)}</dd></div></>}{transactionMapping(selectedTransaction) === "unmapped" && <div><dt>Lidhja</dt><dd>Pa mapping</dd></div>}{selectedTransaction.incoming_detail && <><div><dt>Furnitori</dt><dd>{suppliers.find((supplier) => supplier.id === selectedTransaction.incoming_detail.supplier_id)?.name || `#${selectedTransaction.incoming_detail.supplier_id}`}</dd></div><div><dt>Çmimi për litër</dt><dd>{money(selectedTransaction.incoming_detail.unit_price, selectedTransaction.incoming_detail.currency)}</dd></div><div><dt>Shuma totale</dt><dd>{money(selectedTransaction.incoming_detail.total_amount, selectedTransaction.incoming_detail.currency)}</dd></div><div><dt>Valuta</dt><dd>{selectedTransaction.incoming_detail.currency || "—"}</dd></div>{selectedTransaction.incoming_detail.comment && <div className="bt-fuel-comment-detail"><dt>Komenti</dt><dd>{selectedTransaction.incoming_detail.comment}</dd></div>}</>}{selectedTransaction.piusi_detail && <>{[["Targa në Piusi", "registration_number"], ["Kilometrazhi", "odometer"], ["Njësia e kilometrazhit", "odometer_unit"], ["Autorizimi", "auth"], ["Lloji i furnizimit", "dispense_type"], ["Anomalia", "anomaly"], ["Statusi", "status"], ["ID e transaksionit Piusi", "piusi_transaction_id"], ["ID progresive Piusi", "piusi_progressive_id"], ["ID e dispenserit", "piusi_dispenser_id"], ["ID e pompës", "piusi_pump_id"], ["ID e shoferit Piusi", "piusi_driver_id"]].map(([label, key]) => <div key={key}><dt>{label}</dt><dd>{detailValue(selectedTransaction.piusi_detail[key])}</dd></div>)}</>}</dl>{selectedTransaction.transaction_type === "INCOMING" && !selectedTransaction.incoming_detail && <p className="bt-fuel-detail-note">Të dhënat shtesë të kësaj hyrjeje nuk janë të disponueshme.</p>}</Modal>}
  </div>;
}
