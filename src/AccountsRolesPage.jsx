import { useCallback, useEffect, useState } from "react";
import { confirmAction } from "./confirmAction";
import { Pencil, Plus, RefreshCw, Search, ShieldCheck, UserCircle } from "lucide-react";
import { authApi, cashRegistersApi, rolesApi, usersApi } from "./api";
import { Modal } from "./PortalPages";
import { cashRegisterTypeLabel } from "./cashRegisterLabels";

const emptyRole = { name: "", description: "", is_active: true };
const emptyUser = { username: "", password: "", role_id: "", comment: "", is_active: true };

export default function AccountsRolesPage() {
  const [tab, setTab] = useState("accounts");
  const [search, setSearch] = useState("");
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [registers, setRegisters] = useState([]);
  const [assignmentUser, setAssignmentUser] = useState(null);
  const [assignmentRegisterId, setAssignmentRegisterId] = useState("");
  const [newUserRegisterId, setNewUserRegisterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleEdit, setRoleEdit] = useState(null);
  const [roleForm, setRoleForm] = useState(emptyRole);
  const [userEdit, setUserEdit] = useState(null);
  const [userForm, setUserForm] = useState(emptyUser);
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [current, userList, roleList, registerList] = await Promise.all([
        authApi.me(), usersApi.list(), rolesApi.list(), cashRegistersApi.list(),
      ]);
      setMe(current);
      setUsers(userList);
      setRoles(roleList);
      setRegisters(registerList);
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

  function openRole(role = null) {
    setError("");
    setRoleEdit(role || {});
    setRoleForm(role ? { name: role.name, description: role.description || "", is_active: role.is_active } : emptyRole);
  }

  function openUser(user = null) {
    setError("");
    setUserEdit(user || {});
    setNewUserRegisterId("");
    setUserForm(user ? {
      username: user.username,
      password: "",
      role_id: user.role?.id ? String(user.role.id) : "",
      comment: user.comment || "",
      is_active: user.is_active,
    } : emptyUser);
  }

  async function saveRole(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const body = { name: roleForm.name.trim(), description: roleForm.description.trim(), is_active: roleForm.is_active };
      if (roleEdit.id) await rolesApi.update(roleEdit.id, body);
      else await rolesApi.create(body);
      setRoleEdit(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveUser(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (userEdit.id) {
        await usersApi.update(userEdit.id, {
          username: userForm.username.trim(),
          comment: userForm.comment.trim(),
          is_active: userForm.is_active,
        });
        const roleId = Number(userForm.role_id);
        if (roleId && roleId !== userEdit.role?.id) await usersApi.assignRole(userEdit.id, roleId);
      } else {
        const created = await usersApi.create({
          username: userForm.username.trim(), password: userForm.password,
          role_id: userForm.role_id ? Number(userForm.role_id) : null,
          comment: userForm.comment.trim(), is_active: userForm.is_active,
        });
        if (newUserRegisterId) {
          try {
            await usersApi.createCashRegisterAssignment(created.id, { cash_register_id: Number(newUserRegisterId) });
          } catch (assignmentError) {
            setUserEdit(null);
            await load();
            throw new Error(`Llogaria ${created.username} u krijua, por caktimi i arkës dështoi: ${assignmentError.message}`, { cause: assignmentError });
          }
        }
      }
      setUserEdit(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshAssignments(userId) {
    const assignments = await usersApi.cashRegisterAssignments(userId);
    setUsers((current) => current.map((user) => user.id === userId ? { ...user, cash_register_assignments: assignments } : user));
    setAssignmentUser((current) => current?.id === userId ? { ...current, cash_register_assignments: assignments } : current);
  }

  async function addAssignment(event) {
    event.preventDefault();
    if (busy || !assignmentUser || !assignmentRegisterId) return;
    setBusy(true);
    setError("");
    try {
      await usersApi.createCashRegisterAssignment(assignmentUser.id, { cash_register_id: Number(assignmentRegisterId) });
      setAssignmentRegisterId("");
      await refreshAssignments(assignmentUser.id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeAssignment(assignment) {
    if (busy || !assignmentUser) return;
    setBusy(true);
    setError("");
    try {
      await usersApi.deleteCashRegisterAssignment(assignmentUser.id, assignment.id);
      await refreshAssignments(assignmentUser.id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleUser(user) {
    if (actionId || (user.is_active && !await confirmAction(`Të çaktivizohet llogaria ${user.username}?`))) return;
    setActionId(`user-${user.id}`);
    setError("");
    try {
      await usersApi.update(user.id, { is_active: !user.is_active });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setActionId("");
    }
  }

  async function deactivateRole(role) {
    if (busy || actionId || !await confirmAction(`Të çaktivizohet roli ${role.name}?`)) return;
    setActionId(`role-${role.id}`);
    setError("");
    try {
      await rolesApi.deactivate(role.id);
      setRoleEdit(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setActionId("");
    }
  }

  const term = search.trim().toLocaleLowerCase("sq");
  const shownUsers = users.filter((user) =>
    [user.username, user.role?.name, user.comment]
      .some((value) => String(value || "").toLocaleLowerCase("sq").includes(term)),
  );
  const shownRoles = roles.filter((role) =>
    [role.name, role.description]
      .some((value) => String(value || "").toLocaleLowerCase("sq").includes(term)),
  );

  return <div className="bt-page bt-ops-page bt-accounts-roles-page">
    <header className="bt-page-header">
      <div><span className="bt-eyebrow">Settings</span><h1>Llogaritë dhe rolet</h1><p>Menaxhimi i përdoruesve dhe roleve të sistemit.</p></div>
      <button type="button" className="bt-btn-primary" onClick={() => tab === "roles" ? openRole() : openUser()}><Plus size={18} /> {tab === "roles" ? "Shto rol" : "Shto llogari"}</button>
    </header>

    <div className="bt-accounts-tabs" role="tablist" aria-label="Llogaritë dhe rolet">
      <button type="button" role="tab" aria-selected={tab === "accounts"} className={tab === "accounts" ? "active" : ""} onClick={() => { setTab("accounts"); setSearch(""); }}>Llogaritë</button>
      <button type="button" role="tab" aria-selected={tab === "roles"} className={tab === "roles" ? "active" : ""} onClick={() => { setTab("roles"); setSearch(""); }}>Rolet</button>
    </div>
    <label className="bt-accounts-search">
      <Search size={19} aria-hidden="true" />
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === "accounts" ? "Kërko përdorues, rol ose koment…" : "Kërko rol ose përshkrim…"} aria-label={tab === "accounts" ? "Kërko llogaritë" : "Kërko rolet"} />
    </label>
    {error && !userEdit && !roleEdit && <p className="bt-inline-error" role="alert">{error}</p>}
    {loading && <p className="bt-accounts-state" role="status"><RefreshCw className="bt-spin" /> Duke ngarkuar…</p>}

    {tab === "accounts" && <section className="bt-accounts-section" role="tabpanel">
      <h2><UserCircle size={21} /> Llogaritë</h2>
      {!loading && !shownUsers.length && <p className="bt-accounts-state">{search ? "Nuk u gjet asnjë llogari." : "Nuk ka llogari të regjistruara."}</p>}
      {!!shownUsers.length && <div className="bt-accounts-table-wrap"><table className="bt-accounts-table bt-mobile-users-table">
        <thead><tr><th>Përdoruesi</th><th>Roli</th><th>Statusi</th><th>Koment</th><th>Arkat</th><th>Veprimet</th></tr></thead>
        <tbody>{shownUsers.map((user) => <tr key={user.id}>
          <td><strong>{user.username}</strong></td>
          <td>{user.role?.name || "Pa rol"}</td>
          <td><span className={`bt-role-status ${user.is_active ? "active" : ""}`}>{user.is_active ? "Aktive" : "Joaktive"}</span></td>
          <td>{user.comment || "—"}</td>
          <td>{user.cash_register_assignments?.map((assignment) => `${cashRegisterTypeLabel(assignment.register_type)}: ${assignment.cash_register_name}`).join(", ") || "—"}</td>
          <td><div className="bt-role-actions">
            <button type="button" className="bt-btn-secondary" onClick={() => { setError(""); setAssignmentUser(user); setAssignmentRegisterId(""); }}>Arkat</button>
            <button type="button" className="bt-btn-secondary" onClick={() => openUser(user)}><Pencil size={16} /> Ndrysho</button>
            <button type="button" className={user.is_active ? "bt-btn-danger" : "bt-btn-secondary"} disabled={actionId === `user-${user.id}` || (user.is_active && user.id === me?.id)} onClick={() => toggleUser(user)}>
              {actionId === `user-${user.id}` && <RefreshCw size={16} className="bt-spin" />}{user.is_active ? "Çaktivizo" : "Aktivizo"}
            </button>
          </div></td>
        </tr>)}</tbody>
      </table></div>}
    </section>}

    {tab === "roles" && <section className="bt-accounts-section" role="tabpanel">
      <h2><ShieldCheck size={21} /> Rolet</h2>
      {!loading && !shownRoles.length && <p className="bt-accounts-state">{search ? "Nuk u gjet asnjë rol." : "Nuk ka role të regjistruara."}</p>}
      {!!shownRoles.length && <div className="bt-accounts-table-wrap"><table className="bt-accounts-table bt-roles-table">
        <thead><tr><th>Roli</th><th>Përshkrimi</th><th>Statusi</th><th>Veprimet</th></tr></thead>
        <tbody>{shownRoles.map((role) => <tr key={role.id}>
          <td><strong>{role.name}</strong></td><td>{role.description || "—"}</td>
          <td><span className={`bt-role-status ${role.is_active ? "active" : ""}`}>{role.is_active ? "Aktiv" : "Joaktiv"}</span></td>
          <td><div className="bt-role-actions">
            <button type="button" className="bt-btn-secondary" onClick={() => openRole(role)}><Pencil size={16} /> Ndrysho</button>
          </div></td>
        </tr>)}</tbody>
      </table></div>}
    </section>}

    {userEdit && <Modal title={userEdit.id ? "Ndrysho llogarinë" : "Shto llogari"} onClose={() => { if (!busy) setUserEdit(null); }}><form className="bt-role-form" onSubmit={saveUser}>
      <label>Emri i përdoruesit<input value={userForm.username} maxLength={100} required onChange={(event) => setUserForm({ ...userForm, username: event.target.value })} /></label>
      {!userEdit.id && <label>Fjalëkalimi fillestar<input type="password" value={userForm.password} minLength={8} required autoComplete="new-password" onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} /></label>}
      <label>Roli<select value={userForm.role_id} onChange={(event) => setUserForm({ ...userForm, role_id: event.target.value })}>
        <option value="" disabled={Boolean(userEdit.id && userEdit.role)}>Pa rol</option>
        {roles.filter((role) => role.is_active || role.id === userEdit.role?.id).map((role) => <option value={role.id} key={role.id}>{role.name}{role.is_active ? "" : " (joaktiv)"}</option>)}
      </select></label>
      {!userEdit.id && <label>Arka (opsionale)<select value={newUserRegisterId} onChange={(event) => setNewUserRegisterId(event.target.value)}><option value="">Pa arkë</option>{registers.filter((register) => register.is_active).map((register) => <option value={register.id} key={register.id}>{cashRegisterTypeLabel(register.register_type)} · {register.name}</option>)}</select></label>}
      <label>Koment<textarea value={userForm.comment} rows={3} onChange={(event) => setUserForm({ ...userForm, comment: event.target.value })} /></label>
      <label className="bt-role-checkbox"><input type="checkbox" checked={userForm.is_active} disabled={userEdit.id === me?.id && userForm.is_active} onChange={(event) => setUserForm({ ...userForm, is_active: event.target.checked })} /> Llogari aktive</label>
      {error && <p className="bt-inline-error" role="alert">{error}</p>}
      <div className="bt-modal-actions"><button type="submit" className="bt-btn-primary" disabled={busy}>{busy ? "Duke ruajtur…" : "Ruaj llogarinë"}</button></div>
    </form></Modal>}

    {assignmentUser && <Modal title={`Arkat · ${assignmentUser.username}`} onClose={() => { if (!busy) setAssignmentUser(null); }}><div className="bt-cash-register-detail">
      {error && <p className="bt-inline-error" role="alert">{error}</p>}
      <h3>Arkat e caktuara</h3>
      {!assignmentUser.cash_register_assignments?.length && <p>Asnjë arkë e caktuar.</p>}
      {(assignmentUser.cash_register_assignments || []).map((assignment) => <div className="bt-cash-assigned-users" key={assignment.id}><div><strong>{cashRegisterTypeLabel(assignment.register_type)} · {assignment.cash_register_name}</strong><button type="button" className="bt-btn-secondary bt-btn-small" disabled={busy} onClick={() => removeAssignment(assignment)}>Hiq</button></div></div>)}
      <form className="bt-cash-assign-form" onSubmit={addAssignment}><label htmlFor="bt-account-register-select">Cakto arkë</label><div><select id="bt-account-register-select" value={assignmentRegisterId} onChange={(event) => setAssignmentRegisterId(event.target.value)} disabled={busy}><option value="">Zgjidh arkën…</option>{registers.filter((register) => register.is_active && !(assignmentUser.cash_register_assignments || []).some((assignment) => assignment.register_type === register.register_type)).map((register) => <option key={register.id} value={register.id}>{cashRegisterTypeLabel(register.register_type)} · {register.name}</option>)}</select><button type="submit" className="bt-btn-primary" disabled={busy || !assignmentRegisterId}>{busy ? "Duke ruajtur…" : "Cakto"}</button></div></form>
    </div></Modal>}

    {roleEdit && <Modal title={roleEdit.id ? "Ndrysho rolin" : "Shto rol"} onClose={() => { if (!busy) setRoleEdit(null); }}><form className="bt-role-form" onSubmit={saveRole}>
      <label>Emri i rolit<input value={roleForm.name} maxLength={50} required onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })} /></label>
      <label>Përshkrimi<textarea value={roleForm.description} rows={3} onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })} /></label>
      <label className="bt-role-checkbox"><input type="checkbox" checked={roleForm.is_active} onChange={(event) => setRoleForm({ ...roleForm, is_active: event.target.checked })} /> Aktiv</label>
      {error && <p className="bt-inline-error" role="alert">{error}</p>}
      <div className="bt-modal-actions">
        {roleEdit.id && roleEdit.is_active && <button type="button" className="bt-btn-danger" disabled={busy || actionId === `role-${roleEdit.id}`} onClick={() => deactivateRole(roleEdit)}>
          {actionId === `role-${roleEdit.id}` && <RefreshCw size={16} className="bt-spin" />}Çaktivizo
        </button>}
        <button type="submit" className="bt-btn-primary" disabled={busy || Boolean(actionId)}>{busy ? "Duke ruajtur…" : "Ruaj rolin"}</button>
      </div>
    </form></Modal>}
  </div>;
}
