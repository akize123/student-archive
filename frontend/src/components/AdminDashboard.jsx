import React, { useEffect, useMemo, useState } from 'react'
import { createAdminUser, getAdminDashboard, getAdminPrivileges, updateAdminUser } from '../api'
import { CheckIcon, XIcon } from './Icons'

const roleOptions = [
  { value: 'ADMIN', label: 'System Administrator' },
  { value: 'REGISTRAR', label: 'Registrar' },
  { value: 'EXAMINATION_OFFICER', label: 'Examination Officer' },
  { value: 'HOD', label: 'Head of Department' }
]

const roleDepartments = {
  ADMIN: 'ICT Office',
  REGISTRAR: 'Registrar Office',
  EXAMINATION_OFFICER: 'Examination Office',
  HOD: 'Department Office'
}

const defaultPrivilegesByRole = {
  ADMIN: [
    'USER_MANAGEMENT',
    'ROLE_MANAGEMENT',
    'PRIVILEGE_ASSIGNMENT',
    'ARCHIVE_ACCESS',
    'DOCUMENT_UPLOAD',
    'DOCUMENT_APPROVAL',
    'SYSTEM_MAINTENANCE'
  ],
  REGISTRAR: ['ARCHIVE_ACCESS', 'DOCUMENT_UPLOAD'],
  EXAMINATION_OFFICER: ['ARCHIVE_ACCESS', 'DOCUMENT_UPLOAD'],
  HOD: ['ARCHIVE_ACCESS', 'DOCUMENT_APPROVAL']
}

function buildUserForm(overrides = {}) {
  const role = overrides.role || 'REGISTRAR'
  return {
    username: '',
    password: '',
    fullName: '',
    active: true,
    role,
    department: overrides.department ?? roleDepartments[role] ?? '',
    privileges: overrides.privileges ?? defaultPrivilegesByRole[role] ?? [],
    ...overrides
  }
}

const emptyUserForm = buildUserForm()

function formatDateTime(value) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

export default function AdminDashboard({ onNotify }) {
  const [data, setData] = useState(null)
  const [privilegeCatalog, setPrivilegeCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [modalMode, setModalMode] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState(emptyUserForm)

  async function loadDashboard() {
    setLoading(true)
    try {
      const [dashboard, privileges] = await Promise.all([
        getAdminDashboard(),
        getAdminPrivileges()
      ])
      setData(dashboard)
      setPrivilegeCatalog(privileges)
    } catch (err) {
      onNotify?.(err.message || 'Unable to load admin dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const roleBreakdown = useMemo(() => {
    const entries = Object.entries(data?.usersByRole || {})
    return entries.length ? entries : []
  }, [data])

  function openCreateModal() {
    setEditingUser(null)
    setForm(buildUserForm())
    setModalMode('create')
  }

  function handleRoleChange(role) {
    setForm((current) => ({
      ...current,
      role,
      department: roleDepartments[role] || current.department,
      privileges: defaultPrivilegesByRole[role] || []
    }))
  }

  function validateForm() {
    if (modalMode === 'create' && !form.username.trim()) {
      return 'Please enter a username.'
    }
    if (!form.fullName.trim()) {
      return 'Please enter the user full name.'
    }
    if (!form.department.trim()) {
      return 'Please enter a department.'
    }
    if (modalMode === 'create' && form.password.length < 6) {
      return 'Password must be at least 6 characters.'
    }
    if (modalMode === 'edit' && form.password.trim() && form.password.trim().length < 6) {
      return 'New password must be at least 6 characters.'
    }
    return ''
  }

  function openEditModal(user) {
    setEditingUser(user)
    setForm({
      username: user.username,
      password: '',
      fullName: user.fullName,
      role: user.role,
      department: user.department,
      active: user.active,
      privileges: user.privileges || []
    })
    setModalMode('edit')
  }

  function closeModal() {
    if (busy) return
    setModalMode(null)
    setEditingUser(null)
    setForm(emptyUserForm)
  }

  function togglePrivilege(code) {
    setForm((current) => {
      const privileges = new Set(current.privileges || [])
      if (privileges.has(code)) {
        privileges.delete(code)
      } else {
        privileges.add(code)
      }
      return { ...current, privileges: [...privileges] }
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const validationError = validateForm()
    if (validationError) {
      onNotify?.(validationError)
      return
    }

    setBusy(true)
    try {
      if (modalMode === 'create') {
        await createAdminUser({
          username: form.username.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          role: form.role,
          department: form.department.trim(),
          active: form.active,
          privileges: form.privileges
        })
        onNotify?.('User account created successfully.')
      } else if (editingUser) {
        await updateAdminUser(editingUser.id, {
          fullName: form.fullName.trim(),
          role: form.role,
          department: form.department.trim(),
          active: form.active,
          privileges: form.privileges,
          password: form.password.trim() || null
        })
        onNotify?.('User account updated successfully.')
      }
      closeModal()
      await loadDashboard()
    } catch (err) {
      onNotify?.(err.message || 'Unable to save user account.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <section className="admin-page">
        <p className="admin-loading">Loading users…</p>
      </section>
    )
  }

  return (
    <section className="admin-page">
      <header className="admin-top">
        <div className="admin-top-copy">
          <h1>Users</h1>
          <p>Manage accounts, roles, and access.</p>
        </div>
        <button type="button" className="primary-btn admin-btn-sm" onClick={openCreateModal}>
          New user
        </button>
      </header>

      <div className="admin-overview">
        <dl className="admin-metrics">
          <div className="admin-metric">
            <dt>Total</dt>
            <dd>{data?.totalUsers ?? 0}</dd>
          </div>
          <div className="admin-metric">
            <dt>Active</dt>
            <dd>{data?.activeUsers ?? 0}</dd>
          </div>
          <div className="admin-metric">
            <dt>Inactive</dt>
            <dd>{data?.inactiveUsers ?? 0}</dd>
          </div>
          <div className="admin-metric">
            <dt>Roles</dt>
            <dd>{roleBreakdown.length}</dd>
          </div>
        </dl>

        {roleBreakdown.length ? (
          <div className="admin-role-row">
            {roleBreakdown.map(([role, count]) => (
              <span key={role} className="admin-role-tag">
                {role.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                <em>{count}</em>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="admin-card">
        <div className="table-shell admin-table-shell">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Department</th>
                <th>Privileges</th>
                <th>Status</th>
                <th>Last login</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data?.users || []).map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="admin-user-cell">
                      <strong>{user.fullName}</strong>
                      <span>{user.username}</span>
                    </div>
                  </td>
                  <td>{user.roleLabel}</td>
                  <td>{user.department}</td>
                  <td>
                    <div className="admin-privilege-tags">
                      {(user.privileges || []).slice(0, 2).map((privilege) => (
                        <span key={privilege} className="admin-tag">{privilege.replaceAll('_', ' ').toLowerCase()}</span>
                      ))}
                      {(user.privileges || []).length > 2 ? (
                        <span className="admin-tag admin-tag-more">+{user.privileges.length - 2}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <span className={`admin-status ${user.active ? 'is-active' : 'is-inactive'}`}>
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="admin-muted-cell">{formatDateTime(user.lastLoginAt)}</td>
                  <td>
                    <button type="button" className="admin-row-action" onClick={() => openEditModal(user)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalMode ? (
        <div className="modal-backdrop" onClick={closeModal} role="presentation">
          <div className="modal admin-user-modal" onClick={(event) => event.stopPropagation()} role="presentation">
            <div className="modal-head admin-modal-head">
              <div>
                <h2>{modalMode === 'create' ? 'New user' : form.fullName}</h2>
                <p>{modalMode === 'create' ? 'Add a system account' : 'Update account details'}</p>
              </div>
              <button type="button" className="ghost-icon" onClick={closeModal}>
                <XIcon className="icon" />
              </button>
            </div>

            <form className="admin-user-form" onSubmit={handleSubmit}>
              {modalMode === 'create' ? (
                <label>
                  <span>Username</span>
                  <input
                    value={form.username}
                    onChange={(event) => setForm({ ...form, username: event.target.value })}
                    placeholder="e.g. jane.doe"
                    required
                  />
                </label>
              ) : null}

              <label>
                <span>Full name</span>
                <input
                  value={form.fullName}
                  onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                  required
                />
              </label>

              <label>
                <span>Role</span>
                <select value={form.role} onChange={(event) => handleRoleChange(event.target.value)}>
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Department</span>
                <input
                  value={form.department}
                  onChange={(event) => setForm({ ...form, department: event.target.value })}
                  required
                />
              </label>

              <label>
                <span>{modalMode === 'create' ? 'Password' : 'New password (optional)'}</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  required={modalMode === 'create'}
                  minLength={6}
                  placeholder={modalMode === 'edit' ? 'Leave blank to keep current password' : ''}
                />
              </label>

              <label className="admin-active-toggle">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                />
                <span>Account is active</span>
              </label>

              <div className="admin-privilege-picker">
                <span className="admin-field-label">Privileges</span>
                <p className="admin-privilege-note">
                  {form.role === 'ADMIN'
                    ? 'Administrators receive full system privileges automatically.'
                    : 'Select the actions this user is allowed to perform.'}
                </p>
                <div className="admin-privilege-grid">
                  {privilegeCatalog.map((privilege) => {
                    const checked = form.privileges.includes(privilege.code)
                    const disabled = form.role === 'ADMIN'
                    return (
                      <label key={privilege.code} className={`admin-privilege-option ${checked ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked || form.role === 'ADMIN'}
                          disabled={disabled}
                          onChange={() => togglePrivilege(privilege.code)}
                        />
                        <div>
                          <strong>{privilege.label}</strong>
                          <span>{privilege.description}</span>
                        </div>
                        {checked || form.role === 'ADMIN' ? <CheckIcon className="icon tiny" /> : null}
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="ghost-btn" onClick={closeModal} disabled={busy}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={busy}>
                  {busy ? 'Saving...' : modalMode === 'create' ? 'Create user' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}
