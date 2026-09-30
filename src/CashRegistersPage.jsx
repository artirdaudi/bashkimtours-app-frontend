import { useCallback, useEffect, useState } from "react";
import { confirmAction } from "./confirmAction";
import { Pencil, Plus, RefreshCw, Trash2, Wallet } from "lucide-react";
import { cashRegistersApi, usersApi } from "./api";
import { Modal } from "./PortalPages";

const amount = (value) => new Intl.NumberFormat("sq-AL", { style: "currency", currency: "EUR" }).format(Number(value));

export default function CashRegistersPage() {
  const [registers, setRegisters] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [userRegister, setUserRegister] = useState(null);
  const [form, setForm] = useState(null);
  const [userToAssign, setUserToAssign] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [registerList, userList] = await Promise.all([cashRegistersApi.list(), usersApi.list()]);
      setRegisters(registerList);
      setUsers(userList);
      setUserRegister((current) => current ? registerList.find((item) => item.id === current.id) || null : null);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const request = window.setTimeout(load, 0);
    return () => window.clearTimeout(request);
  }, [load]);

  function openForm(register = null) {
    setError("");
    setForm({ id: register?.id || null, name: register?.name || "", balance: "0.00", is_active: register?.is_active ?? true });
  }

  async function saveRegister(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (form.id) await cashRegistersApi.update(form.id, { name: form.name.trim(), is_active: form.is_active });
      else await cashRegistersApi.create({ name: form.name.trim(), balance: form.balance });
      setForm(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeRegister(register) {
    if (busy || !await confirmAction(`Të fshihet arka ${register.name}?`)) return;
    setBusy(true);
    setError("");
    try {
      await cashRegistersApi.remove(register.id);
      setUserRegister(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function assignUser(user, cashRegisterId) {
    if (busy || !userRegister) return;
    setBusy(true);
    setError("");
    try {
      await usersApi.update(user.id, { maarif_cash_register_id: cashRegisterId });
      setUserToAssign("");
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const assignedUsers = users.filter((user) => user.maarif_cash_register_id === userRegister?.id);
  const availableUsers = users.filter((user) => user.maarif_cash_register_id !== userRegister?.id);

  return <div className="bt-page bt-ops-page bt-accounts-roles-page">
    <header className="bt-page-header">
      <div><span className="bt-eyebrow">Settings</span><h1>Arkat</h1><p>Menaxhimi i arkave dhe përdoruesve të tyre.</p></div>
      <button type="button" className="bt-btn-primary" onClick={() => openForm()}><Plus size={18} /> Shto arkë</button>
    </header>
    <div className="bt-accounts-tabs" role="tablist" aria-label="Lloji i arkave"><button type="button" role="tab" aria-selected="true" className="active">Maarif</button></div>
    <section className="bt-accounts-section" role="tabpanel">
      <h2><Wallet size={21} /> Arkat e Maarif</h2>
      {error && !userRegister && !form && <p className="bt-inline-error" role="alert">{error}</p>}
      {loading && <p className="bt-accounts-state" role="status"><RefreshCw className="bt-spin" /> Duke ngarkuar…</p>}
      {!loading && !error && !registers.length && <p className="bt-accounts-state">Nuk ka arka të regjistruara.</p>}
      {!!registers.length && <div className="bt-accounts-table-wrap"><table className="bt-accounts-table bt-mobile-registers-table">
        <thead><tr><th>Arka</th><th>Gjendja</th><th>Statusi</th><th>Përdoruesit</th><th>Veprimet</th></tr></thead>
        <tbody>{registers.map((register) => <tr key={register.id}>
          <td><strong>{register.name}</strong></td>
          <td>{amount(register.balance)}</td>
          <td><span className={`bt-role-status ${register.is_active ? "active" : ""}`}>{register.is_active ? "Aktive" : "Joaktive"}</span></td>
          <td>{users.filter((user) => user.maarif_cash_register_id === register.id).map((user) => user.username).join(", ") || "—"}</td>
          <td><div className="bt-role-actions">
            <button type="button" className="bt-btn-secondary" onClick={() => { setError(""); setUserToAssign(""); setUserRegister(register); }}>Shto përdorues</button>
            <button type="button" className="bt-btn-secondary" onClick={() => openForm(register)}><Pencil size={16} /> Ndrysho</button>
            <button type="button" className="bt-btn-danger" disabled={busy} onClick={() => removeRegister(register)}><Trash2 size={16} /> Fshi</button>
          </div></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
    {form && <Modal title={form.id ? "Ndrysho arkën" : "Shto arkë"} onClose={() => { if (!busy) setForm(null); }}><form className="bt-role-form" onSubmit={saveRegister}>
      <label>Emri<input required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      {!form.id && <label>Gjendja fillestare<input type="number" min="0" step="0.01" required value={form.balance} onChange={(event) => setForm({ ...form, balance: event.target.value })} /></label>}
      {form.id && <label className="bt-role-checkbox"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Arkë aktive</label>}
      {error && <p className="bt-inline-error" role="alert">{error}</p>}
      <div className="bt-modal-actions"><button type="submit" className="bt-btn-primary" disabled={busy}>{busy ? "Duke ruajtur…" : "Ruaj arkën"}</button></div>
    </form></Modal>}
    {userRegister && <Modal title={`Përdoruesit · ${userRegister.name}`} onClose={() => { if (!busy) setUserRegister(null); }}><div className="bt-cash-register-detail">
      {error && <p className="bt-inline-error" role="alert">{error}</p>}
      <h3>Përdoruesit e caktuar</h3>
      {!assignedUsers.length && <p>Asnjë përdorues i caktuar.</p>}
      {!!assignedUsers.length && <div className="bt-cash-assigned-users">{assignedUsers.map((user) => <div key={user.id}><strong>{user.username}</strong><button type="button" className="bt-btn-secondary bt-btn-small" disabled={busy} onClick={() => assignUser(user, null)}>Hiq</button></div>)}</div>}
      <form className="bt-cash-assign-form" onSubmit={(event) => { event.preventDefault(); const user = availableUsers.find((item) => String(item.id) === userToAssign); if (user) assignUser(user, userRegister.id); }}>
        <label htmlFor="bt-cash-user-select">Cakto përdorues</label>
        <div><select id="bt-cash-user-select" value={userToAssign} onChange={(event) => setUserToAssign(event.target.value)} disabled={busy || !userRegister.is_active}><option value="">Zgjidh përdoruesin…</option>{availableUsers.map((user) => <option key={user.id} value={user.id}>{user.username}{user.maarif_cash_register_id ? ` · ${user.maarif_cash_register_name || "Arkë tjetër"}` : ""}</option>)}</select><button type="submit" className="bt-btn-primary" disabled={busy || !userRegister.is_active || !userToAssign}>Cakto</button></div>
      </form>
    </div></Modal>}
  </div>;
}
