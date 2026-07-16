import React, { useEffect, useMemo, useState } from 'react'
import {
  createAdminUser,
  getAdminActivity,
  getAdminArchiveTemplate,
  getAdminDashboard,
  getAdminOffices,
  getAdminPrivileges,
  updateAdminUser
} from '../api'
import {
  CATEGORY_LABELS,
  OFFICE_META,
  activityScopeTabs,
  officeMembersForRole,
  roleLabel
} from '../adminOfficeUtils'
import { CheckIcon, XIcon } from './Icons'

const roleOptions = [
  { value: 'ADMIN', label: 'System Administrator' },
  { value: 'REGISTRAR', label: 'Registrar' },
  { value: 'EXAMINATION_OFFICER', label: 'Examination Officer' },
  { value: 'HOD', label: 'Head of Department' },
  { value: 'LIBRARIAN', label: 'Librarian' },
  { value: 'STUDENT', label: 'Student' }
]

const roleDepartments = {
  ADMIN: 'ICT Office',
  REGISTRAR: 'Registrar Office',
  EXAMINATION_OFFICER: 'Examination Office',
  HOD: 'Department Office',
  LIBRARIAN: 'University Library',
  STUDENT: 'Student Workspace'
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
  HOD: ['ARCHIVE_ACCESS', 'DOCUMENT_APPROVAL'],
  LIBRARIAN: ['ARCHIVE_ACCESS', 'DOCUMENT_APPROVAL'],
  STUDENT: ['ARCHIVE_ACCESS', 'DOCUMENT_UPLOAD']
}

function activityCategoryLabel(category) {
  const normalized = String(category || '').toUpperCase()
  if (normalized === 'UPLOAD') return 'Upload'
  if (normalized === 'APPROVAL') return 'Approval'
  if (normalized === 'ARCHIVE') return 'Archive'
  if (normalized === 'SHARE') return 'Share'
  if (normalized === 'SYNC') return 'Sync'
  return normalized || 'Action'
}

const STUDENT_ID_HINT = 'YYYY + semester (1-3) + dept code + sequence (example: 20251SENG041)'

function buildUserForm(overrides = {}) {
  const role = overrides.role || 'REGISTRAR'
  return {
    username: '',
    password: '',
    fullName: '',
    studentNumber: '',
    faculty: '',
    academicDepartment: '',
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

function TemplateTree({ nodes = [], depth = 0 }) {
  if (!nodes.length) {
    return <p className="admin-muted-cell">No archive structure available.</p>
  }
  return (
    <ul className="admin-template-tree" style={{ paddingLeft: depth ? '1rem' : 0 }}>
      {nodes.map((node) => (
        <li key={`${node.code}-${node.id}`}>
          <strong>{node.name}</strong>
          {node.children?.length ? <TemplateTree nodes={node.children} depth={depth + 1} /> : null}
        </li>
      ))}
    </ul>
  )
}

export default function AdminDashboard({ onNotify }) {
  const [data, setData] = useState(null)
  const [offices, setOffices] = useState([])
  const [privilegeCatalog, setPrivilegeCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [modalMode, setModalMode] = useState(null)
  const [wizardStep, setWizardStep] = useState(1)
  const [archiveTemplate, setArchiveTemplate] = useState([])
  const [templateLoading, setTemplateLoading] = useState(false)
  const [enabledCategories, setEnabledCategories] = useState([])
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState(emptyUserForm)
  const [activityScope, setActivityScope] = useState('REGISTRAR')
  const [activePanel, setActivePanel] = useState('activity')
  const [roleActivities, setRoleActivities] = useState([])
  const [activityTotal, setActivityTotal] = useState(0)
  const [activitiesLoading, setActivitiesLoading] = useState(false)

  const officeMembers = useMemo(
    () => officeMembersForRole(offices, form.role),
    [offices, form.role]
  )

  const roleCategories = useMemo(
    () => OFFICE_META[form.role]?.categories || [],
    [form.role]
  )

  async function loadRoleActivities(scope = activityScope) {
    setActivitiesLoading(true)
    try {
      const response = await getAdminActivity({
        scope,
        page: 0,
        size: 100
      })
      setRoleActivities(response?.items || [])
      setActivityTotal(response?.total || 0)
    } catch (err) {
      setRoleActivities([])
      setActivityTotal(0)
      onNotify?.(err.message || 'Unable to load role activity.')
    } finally {
      setActivitiesLoading(false)
    }
  }

  async function loadDashboard() {
    setLoading(true)
    try {
      const [dashboard, privileges, officeData] = await Promise.all([
        getAdminDashboard(),
        getAdminPrivileges(),
        getAdminOffices()
      ])
      setData(dashboard)
      setPrivilegeCatalog(privileges)
      setOffices(officeData || [])
    } catch (err) {
      onNotify?.(err.message || 'Unable to load admin dashboard.')
    } finally {
      setLoading(false)
    }
  }

  async function loadArchiveTemplate() {
    setTemplateLoading(true)
    try {
      const template = await getAdminArchiveTemplate()
      setArchiveTemplate(template || [])
    } catch (err) {
      setArchiveTemplate([])
      onNotify?.(err.message || 'Unable to load archive template.')
    } finally {
      setTemplateLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  useEffect(() => {
    if (!loading) {
      loadRoleActivities(activityScope)
    }
  }, [activityScope, loading])

  const roleBreakdown = useMemo(() => {
    const entries = Object.entries(data?.usersByRole || {})
    return entries.length ? entries : []
  }, [data])

  const usersByRole = useMemo(() => {
    const grouped = {}
    ;(data?.users || []).forEach((user) => {
      grouped[user.role] = (grouped[user.role] || 0) + 1
    })
    return grouped
  }, [data])

  function openCreateModal() {
    setEditingUser(null)
    setForm(buildUserForm())
    setWizardStep(1)
    setEnabledCategories(OFFICE_META.REGISTRAR?.categories || [])
    setModalMode('create')
  }

  function handleRoleChange(role) {
    setForm((current) => ({
      ...current,
      role,
      department: roleDepartments[role] || current.department,
      privileges: defaultPrivilegesByRole[role] || [],
      studentNumber: role === 'STUDENT' ? current.studentNumber : '',
      faculty: role === 'STUDENT' ? current.faculty : '',
      academicDepartment: role === 'STUDENT' ? current.academicDepartment : ''
    }))
    setEnabledCategories(OFFICE_META[role]?.categories || [])
  }

  function handleStudentNumberChange(studentNumber) {
    setForm((current) => {
      const normalizedUsername = studentNumber.trim().toLowerCase()
      const usernameMatchesStudentId = !current.username.trim()
        || current.username.trim().toLowerCase() === String(current.studentNumber || '').trim().toLowerCase()
      return {
        ...current,
        studentNumber,
        username: usernameMatchesStudentId ? normalizedUsername : current.username
      }
    })
  }

  function validateForm(step = null) {
    if (modalMode === 'create' && step === 4 && !form.username.trim()) {
      return 'Please enter a username.'
    }
    if (form.role === 'STUDENT' && (step === null || step >= 4) && !form.studentNumber.trim()) {
      return 'Please enter the student ID.'
    }
    if (modalMode === 'edit' && form.role === 'STUDENT' && !form.studentNumber.trim()) {
      return 'Please enter the student ID.'
    }
    if ((step === null || step >= 4) && !form.fullName.trim()) {
      return 'Please enter the user full name.'
    }
    if ((step === null || step >= 4) && !form.department.trim()) {
      return 'Please enter a department.'
    }
    if (modalMode === 'create' && (step === null || step >= 4) && form.password.length < 6) {
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
      studentNumber: user.studentNumber || '',
      faculty: '',
      academicDepartment: '',
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
    setWizardStep(1)
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

  function toggleCategory(category) {
    setEnabledCategories((current) => (
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category]
    ))
  }

  async function handleWizardNext() {
    const validationError = validateForm(wizardStep)
    if (validationError) {
      onNotify?.(validationError)
      return
    }
    if (wizardStep === 2) {
      await loadArchiveTemplate()
    }
    setWizardStep((current) => Math.min(current + 1, 4))
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
          privileges: form.privileges,
          studentNumber: form.role === 'STUDENT' ? form.studentNumber.trim() : null,
          faculty: form.role === 'STUDENT' ? form.faculty.trim() || null : null,
          academicDepartment: form.role === 'STUDENT' ? form.academicDepartment.trim() || null : null
        })
        onNotify?.('User account created successfully.')
      } else if (editingUser) {
        await updateAdminUser(editingUser.id, {
          fullName: form.fullName.trim(),
          role: form.role,
          department: form.department.trim(),
          active: form.active,
          privileges: form.privileges,
          password: form.password.trim() || null,
          studentNumber: form.role === 'STUDENT' ? form.studentNumber.trim() || null : null,
          faculty: form.role === 'STUDENT' ? form.faculty.trim() || null : null,
          academicDepartment: form.role === 'STUDENT' ? form.academicDepartment.trim() || null : null
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
    <section className="admin-page admin-dashboard-page" id="admin-activity-panel">
      <header className="admin-top">
        <div className="admin-top-copy">
          <h1>Users</h1>
        </div>
        <div className="admin-top-actions">
          <div className="admin-dashboard-tabs">
            <button
              type="button"
              className={`admin-dashboard-tab ${activePanel === 'activity' ? 'active' : ''}`}
              onClick={() => setActivePanel('activity')}
            >
              System activity
            </button>
            <button
              type="button"
              className={`admin-dashboard-tab ${activePanel === 'users' ? 'active' : ''}`}
              onClick={() => setActivePanel('users')}
            >
              All users
            </button>
          </div>
          <button type="button" className="primary-btn admin-btn-sm" onClick={openCreateModal}>
            New user
          </button>
        </div>
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

      <div className="admin-dashboard-panel">
      {activePanel === 'activity' ? (
      <div className="admin-card admin-activity-card admin-dashboard-activity-card">
        <div className="admin-activity-head">
          <div>
            <h2>System activity</h2>
            <p>All changes across offices and users ({activityTotal} total).</p>
          </div>
          <div className="admin-activity-filters">
            <div className="admin-activity-tabs">
              {activityScopeTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={`admin-activity-tab ${activityScope === tab.value ? 'active' : ''}`}
                  onClick={() => setActivityScope(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="table-shell admin-table-shell admin-dashboard-panel-scroll">
          <table className="admin-table admin-activity-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>User</th>
                <th>Role</th>
                <th>Type</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {activitiesLoading ? (
                <tr>
                  <td colSpan="5" className="admin-muted-cell">Loading activity...</td>
                </tr>
              ) : roleActivities.length ? (
                roleActivities.map((entry) => (
                  <tr key={entry.id}>
                    <td><strong>{entry.message}</strong></td>
                    <td>{entry.actorUsername || entry.actor}</td>
                    <td>{entry.sourceRole ? roleLabel(entry.sourceRole) : '—'}</td>
                    <td><span className="admin-tag">{activityCategoryLabel(entry.category)}</span></td>
                    <td className="admin-muted-cell">{formatDateTime(entry.createdAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="admin-muted-cell">No recent activity for this filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      ) : (
      <div className="admin-card admin-dashboard-users-card">
        <div className="admin-activity-head">
          <div>
            <h2>All users</h2>
            <p>{data?.totalUsers ?? 0} accounts across all offices.</p>
          </div>
        </div>
        <div className="table-shell admin-table-shell admin-dashboard-panel-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role / Office</th>
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
                  <td>
                    <div className="admin-user-cell">
                      <strong>{user.roleLabel}</strong>
                      <span>
                        {roleLabel(user.role)} office
                        {usersByRole[user.role] > 1 ? ` · shared with ${usersByRole[user.role] - 1} other(s)` : ''}
                      </span>
                    </div>
                  </td>
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
      )}
      </div>

      {modalMode ? (
        <div className="modal-backdrop" onClick={closeModal} role="presentation">
          <div className="modal admin-user-modal" onClick={(event) => event.stopPropagation()} role="presentation">
            <div className="modal-head admin-modal-head">
              <div>
                <h2>{modalMode === 'create' ? 'New user' : form.fullName}</h2>
                <p>
                  {modalMode === 'create'
                    ? `Step ${wizardStep} of 4 · Shared office setup`
                    : 'Update account details'}
                </p>
              </div>
              <button type="button" className="ghost-icon" onClick={closeModal}>
                <XIcon className="icon" />
              </button>
            </div>

            {modalMode === 'create' ? (
              <div className="admin-wizard">
                <div className="admin-wizard-steps">
                  {['Role', 'Office', 'Archive tree', 'Account'].map((label, index) => (
                    <span
                      key={label}
                      className={`admin-wizard-step ${wizardStep === index + 1 ? 'active' : wizardStep > index + 1 ? 'done' : ''}`}
                    >
                      {index + 1}. {label}
                    </span>
                  ))}
                </div>

                {wizardStep === 1 ? (
                  <div className="admin-wizard-panel">
                    <label>
                      <span>Role</span>
                      <select value={form.role} onChange={(event) => handleRoleChange(event.target.value)}>
                        {roleOptions.filter((option) => option.value !== 'ADMIN').map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}

                {wizardStep === 2 ? (
                  <div className="admin-wizard-panel">
                    <div className="admin-office-assignment">
                      {officeMembers.length ? (
                        <>
                          <strong>Join existing {roleLabel(form.role)} office</strong>
                          <p>This user will share the same dashboard and archive tree with {officeMembers.length} existing member(s).</p>
                          <ul className="admin-office-member-list">
                            {officeMembers.map((member) => (
                              <li key={member.id}>{member.fullName} · {member.username}</li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <>
                          <strong>Creates new {roleLabel(form.role)} office</strong>
                          <p>This is the first account for this role. They will use the shared global archive tree.</p>
                        </>
                      )}
                    </div>
                    <label>
                      <span>Department</span>
                      <input
                        value={form.department}
                        onChange={(event) => setForm({ ...form, department: event.target.value })}
                        required
                      />
                    </label>
                  </div>
                ) : null}

                {wizardStep === 3 ? (
                  <div className="admin-wizard-panel">
                    <p className="admin-template-lead">Default archive structure (Faculty → Department → Year → Semester):</p>
                    {templateLoading ? (
                      <p className="admin-muted-cell">Loading archive template…</p>
                    ) : (
                      <TemplateTree nodes={archiveTemplate} />
                    )}
                    {roleCategories.length ? (
                      <div className="admin-category-picker">
                        <span className="admin-field-label">Document categories for this office</span>
                        <div className="admin-privilege-grid">
                          {roleCategories.map((category) => (
                            <label key={category} className={`admin-privilege-option ${enabledCategories.includes(category) ? 'checked' : ''}`}>
                              <input
                                type="checkbox"
                                checked={enabledCategories.includes(category)}
                                onChange={() => toggleCategory(category)}
                              />
                              <div>
                                <strong>{CATEGORY_LABELS[category] || category}</strong>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {wizardStep === 4 ? (
                  <form className="admin-user-form" onSubmit={handleSubmit}>
                    {form.role === 'STUDENT' ? (
                      <>
                        <label>
                          <span>Student ID</span>
                          <input
                            value={form.studentNumber}
                            onChange={(event) => handleStudentNumberChange(event.target.value)}
                            placeholder="e.g. 20251SENG041"
                            required
                          />
                          <small className="admin-muted-cell admin-field-hint">{STUDENT_ID_HINT}</small>
                        </label>
                        <label>
                          <span>Faculty (optional for modern IDs)</span>
                          <input
                            value={form.faculty}
                            onChange={(event) => setForm({ ...form, faculty: event.target.value })}
                            placeholder="e.g. Faculty of Information Technology"
                          />
                        </label>
                        <label>
                          <span>Academic department (optional for modern IDs)</span>
                          <input
                            value={form.academicDepartment}
                            onChange={(event) => setForm({ ...form, academicDepartment: event.target.value })}
                            placeholder="e.g. Software Engineering"
                          />
                        </label>
                      </>
                    ) : null}
                    <label>
                      <span>Username</span>
                      <input
                        value={form.username}
                        onChange={(event) => setForm({ ...form, username: event.target.value })}
                        placeholder={form.role === 'STUDENT' ? 'Usually same as student ID' : 'e.g. jane.doe'}
                        required
                      />
                    </label>
                    <label>
                      <span>Full name</span>
                      <input
                        value={form.fullName}
                        onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                        required
                      />
                    </label>
                    <label>
                      <span>Password</span>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(event) => setForm({ ...form, password: event.target.value })}
                        required
                        minLength={6}
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
                    <div className="modal-actions">
                      <button type="button" className="ghost-btn" onClick={() => setWizardStep(3)} disabled={busy}>Back</button>
                      <button type="submit" className="primary-btn" disabled={busy}>
                        {busy ? 'Creating...' : 'Create user'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="modal-actions">
                    <button type="button" className="ghost-btn" onClick={closeModal} disabled={busy}>Cancel</button>
                    {wizardStep > 1 ? (
                      <button type="button" className="ghost-btn" onClick={() => setWizardStep((current) => current - 1)} disabled={busy}>
                        Back
                      </button>
                    ) : null}
                    <button type="button" className="primary-btn" onClick={handleWizardNext} disabled={busy}>
                      Next
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <form className="admin-user-form" onSubmit={handleSubmit}>
                <p className="admin-office-assignment-note">
                  Office: {roleLabel(form.role)}
                  {usersByRole[form.role] > 1 ? ` (shared with ${usersByRole[form.role] - 1} other user(s))` : ''}
                </p>
                <label>
                  <span>Full name</span>
                  <input
                    value={form.fullName}
                    onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                    required
                  />
                </label>
                {form.role === 'STUDENT' ? (
                  <>
                    <label>
                      <span>Student ID</span>
                      <input
                        value={form.studentNumber}
                        onChange={(event) => setForm({ ...form, studentNumber: event.target.value })}
                        placeholder="e.g. 20251SENG041"
                        required
                      />
                      <small className="admin-muted-cell admin-field-hint">{STUDENT_ID_HINT}</small>
                    </label>
                    <label>
                      <span>Faculty (optional for modern IDs)</span>
                      <input
                        value={form.faculty}
                        onChange={(event) => setForm({ ...form, faculty: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Academic department (optional for modern IDs)</span>
                      <input
                        value={form.academicDepartment}
                        onChange={(event) => setForm({ ...form, academicDepartment: event.target.value })}
                      />
                    </label>
                  </>
                ) : null}
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
                  <span>New password (optional)</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    minLength={6}
                    placeholder="Leave blank to keep current password"
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
                    {busy ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
