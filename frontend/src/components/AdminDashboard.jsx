import React, { useEffect, useMemo, useState } from 'react'
import {
  createAdminUser,
  getAdminActivity,
  getAdminArchiveTemplate,
  getAdminDashboard,
  getAdminOffices,
  getAdminPrivileges,
  getStudentEnrollment,
  updateAdminUser
} from '../api'
import {
  CATEGORY_LABELS,
  OFFICE_META,
  activityScopeTabs,
  filterArchiveTreeForOffice,
  officeMembersForRole,
  roleLabel
} from '../adminOfficeUtils'
import { academicDepartmentOptions, facultyForAcademicDepartment, facultyOptions, studentFacultyOptions } from '../academicDepartments'
import { CheckIcon, XIcon } from './Icons'

const roleOptions = [
  { value: 'ADMIN', label: 'System Administrator' },
  { value: 'REGISTRAR', label: 'Registrar' },
  { value: 'FINANCE', label: 'Finance Office' },
  { value: 'EXAMINATION_OFFICER', label: 'Examination Officer' },
  { value: 'HOD', label: 'Head of Department' },
  { value: 'DEAN_OF_FACULTY', label: 'Dean of Faculty' },
  { value: 'LIBRARIAN', label: 'Librarian' },
  { value: 'STUDENT', label: 'Student' }
]

const roleChoiceHints = {
  REGISTRAR: 'Student intake and registration archive',
  FINANCE: 'Finance years and payment records',
  EXAMINATION_OFFICER: 'Exam papers and marks archive',
  HOD: 'One faculty and one academic department',
  DEAN_OF_FACULTY: 'All departments in one faculty',
  LIBRARIAN: 'Final year project review',
  STUDENT: 'Personal archive for a student ID'
}

const roleDepartments = {
  ADMIN: 'ICT Office',
  REGISTRAR: 'Registrar Office',
  FINANCE: 'Finance Office',
  EXAMINATION_OFFICER: 'Examination Office',
  HOD: 'Department Office',
  DEAN_OF_FACULTY: 'Faculty Office',
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
  FINANCE: ['ARCHIVE_ACCESS', 'DOCUMENT_UPLOAD'],
  EXAMINATION_OFFICER: ['ARCHIVE_ACCESS', 'DOCUMENT_UPLOAD'],
  HOD: ['ARCHIVE_ACCESS', 'DOCUMENT_APPROVAL'],
  DEAN_OF_FACULTY: ['ARCHIVE_ACCESS', 'DOCUMENT_UPLOAD'],
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

function usesScopedDepartmentPicker(role) {
  return role === 'HOD' || role === 'DEAN_OF_FACULTY'
}

function departmentFieldLabel(role) {
  if (role === 'HOD') return 'Academic department'
  if (role === 'DEAN_OF_FACULTY') return 'Faculty'
  return 'Department'
}

const STUDENT_WORKSPACE_TEMPLATE = [
  { id: 'official', name: 'Official Documents', code: 'SOFF', children: [] },
  { id: 'projects', name: 'My Projects', code: 'SFYP', children: [] },
  { id: 'archive', name: 'Archive Project', code: 'SARC', children: [] }
]

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
    studentNumber: overrides.studentNumber ?? '',
    faculty: overrides.faculty ?? '',
    academicDepartment: overrides.academicDepartment ?? '',
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
  const [activePanel, setActivePanel] = useState('users')
  const [roleActivities, setRoleActivities] = useState([])
  const [activityTotal, setActivityTotal] = useState(0)
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [studentLinkPreview, setStudentLinkPreview] = useState(null)
  const [studentLinkError, setStudentLinkError] = useState('')
  const [studentLinkBusy, setStudentLinkBusy] = useState(false)
  const [studentPlacementLocked, setStudentPlacementLocked] = useState(false)
  const [allowAdminEditPlacement, setAllowAdminEditPlacement] = useState(false)

  const filteredArchiveTemplate = useMemo(
    () => (form.role === 'STUDENT'
      ? STUDENT_WORKSPACE_TEMPLATE
      : filterArchiveTreeForOffice(archiveTemplate, form.role)),
    [archiveTemplate, form.role]
  )

  const studentDepartmentOptions = useMemo(() => {
    const faculty = studentFacultyOptions.find((entry) => (
      String(entry.value || '').trim().toLowerCase() === String(form.faculty || '').trim().toLowerCase()
    ))
    return faculty?.departments || []
  }, [form.faculty])

  const officeMembers = useMemo(
    () => officeMembersForRole(
      offices,
      form.role,
      usesScopedDepartmentPicker(form.role) ? form.department : null
    ),
    [offices, form.role, form.department]
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
    resetStudentLookupState()
    setModalMode('create')
  }

  function handleRoleChange(role) {
    setForm((current) => ({
      ...current,
      role,
      department: usesScopedDepartmentPicker(role) ? '' : (roleDepartments[role] || current.department),
      privileges: defaultPrivilegesByRole[role] || [],
      studentNumber: role === 'STUDENT' ? current.studentNumber : '',
      faculty: role === 'STUDENT' ? current.faculty : '',
      academicDepartment: role === 'STUDENT' ? current.academicDepartment : ''
    }))
    setEnabledCategories(OFFICE_META[role]?.categories || [])
    if (role !== 'STUDENT') {
      setStudentLinkPreview(null)
      setStudentLinkError('')
      setStudentPlacementLocked(false)
      setAllowAdminEditPlacement(false)
    }
  }

  function resetStudentLookupState() {
    setStudentLinkPreview(null)
    setStudentLinkError('')
    setStudentPlacementLocked(false)
    setAllowAdminEditPlacement(false)
  }

  async function lookupStudentForAdmin(studentNumber) {
    const trimmed = String(studentNumber || '').trim()
    if (!trimmed) {
      resetStudentLookupState()
      setStudentLinkError('Please enter a student ID.')
      return null
    }
    setStudentLinkBusy(true)
    setStudentLinkError('')
    setAllowAdminEditPlacement(false)
    try {
      const enrollment = await getStudentEnrollment(trimmed)
      if (!enrollment.registered) {
        resetStudentLookupState()
        setStudentLinkError(`Student ${trimmed} is not registered in the archive. Ask the Registrar to create this student ID first.`)
        return null
      }
      const linkedAccount = (data?.users || []).find((user) => (
        user.role === 'STUDENT'
        && String(user.studentNumber || '').trim().toUpperCase()
          === String(enrollment.studentNumber || trimmed).trim().toUpperCase()
      ))
      const preview = {
        studentNumber: enrollment.studentNumber || trimmed,
        studentName: enrollment.studentName || trimmed,
        faculty: enrollment.faculty || '',
        department: enrollment.department || '',
        hasLoginAccount: Boolean(linkedAccount),
        loginUsername: linkedAccount?.username || '',
        loginActive: linkedAccount ? linkedAccount.active !== false : false,
        linkedUser: linkedAccount || null
      }
      if (preview.hasLoginAccount) {
        setStudentLinkPreview(preview)
        setStudentPlacementLocked(true)
        setStudentLinkError('')
        setForm((current) => ({
          ...current,
          studentNumber: preview.studentNumber,
          fullName: preview.studentName || current.fullName,
          faculty: preview.faculty || current.faculty,
          academicDepartment: preview.department || current.academicDepartment,
          department: roleDepartments.STUDENT
        }))
        return preview
      }
      const hasExistingPlacement = Boolean(preview.faculty && preview.department)
      setStudentLinkPreview(preview)
      setStudentPlacementLocked(hasExistingPlacement)
      setForm((current) => ({
        ...current,
        studentNumber: preview.studentNumber,
        fullName: preview.studentName || current.fullName,
        faculty: preview.faculty || current.faculty,
        academicDepartment: preview.department || current.academicDepartment,
        department: roleDepartments.STUDENT
      }))
      return preview
    } catch (err) {
      resetStudentLookupState()
      setStudentLinkError(err.message || 'Unable to look up this student ID.')
      return null
    } finally {
      setStudentLinkBusy(false)
    }
  }

  function validateForm(step = null) {
    if (modalMode === 'create' && step === 4 && !form.username.trim()) {
      return 'Please enter a username.'
    }
    if ((step === null || step >= 4) && !form.fullName.trim()) {
      return 'Please enter the user full name.'
    }
    if ((step === null || step === 2 || step >= 4) && !form.department.trim()) {
      return form.role === 'HOD'
        ? 'Please select an academic department.'
        : form.role === 'DEAN_OF_FACULTY'
          ? 'Please select a faculty.'
          : 'Please enter a department.'
    }
    if (form.role === 'STUDENT' && (step === null || step === 2 || step >= 4)) {
      if (!String(form.studentNumber || '').trim()) {
        return 'Please enter the student ID to link this account.'
      }
      if (modalMode === 'create' && !studentLinkPreview) {
        return studentLinkError || 'Look up the student ID and confirm the archive record before continuing.'
      }
      if (modalMode === 'create' && studentLinkPreview?.hasLoginAccount) {
        return studentLinkPreview.loginActive
          ? `This student already has login "${studentLinkPreview.loginUsername}". Use Fix login to reset the password instead of creating another account.`
          : `This student already has login "${studentLinkPreview.loginUsername}", but it is inactive — that is why they cannot sign in. Use Fix login to activate and set a password.`
      }
      if (!String(form.faculty || '').trim()) {
        return 'Please select the faculty this student belongs to.'
      }
      if (!String(form.academicDepartment || '').trim()) {
        return 'Please select the department this student belongs to.'
      }
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
      role: user.role,
      department: user.department,
      active: user.active,
      privileges: user.privileges || [],
      studentNumber: user.studentNumber || '',
      faculty: '',
      academicDepartment: ''
    })
    setStudentLinkPreview(user.role === 'STUDENT' && user.studentNumber
      ? {
          studentNumber: user.studentNumber,
          studentName: user.fullName,
          faculty: '',
          department: user.department
        }
      : null)
    setStudentLinkError('')
    setModalMode('edit')
  }

  function closeModal() {
    if (busy) return
    setModalMode(null)
    setEditingUser(null)
    setWizardStep(1)
    setForm(emptyUserForm)
    resetStudentLookupState()
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
          studentNumber: form.role === 'STUDENT' ? form.studentNumber.trim() : null,
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
    <section
      className={`admin-page admin-dashboard-page${activePanel === 'users' ? ' admin-dashboard-page--users' : ''}`}
      id="admin-activity-panel"
      data-panel={activePanel}
    >
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
              {(data?.users || []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-muted-cell">
                    No user accounts to show.
                  </td>
                </tr>
              ) : (
                (data?.users || []).map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="admin-user-cell">
                        <strong>{user.fullName}</strong>
                        <span>{user.username}{user.role === 'STUDENT' && user.studentNumber ? ` · ${user.studentNumber}` : ''}</span>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
      </div>

      {modalMode ? (
        <div className="modal-backdrop" onClick={closeModal} role="presentation">
          <div
            className={`modal admin-user-modal${
              modalMode === 'create' ? ` admin-user-modal-step${wizardStep}` : ''
            }`}
            onClick={(event) => event.stopPropagation()}
            role="presentation"
          >
            <div className="modal-head admin-modal-head">
              <div>
                <h2>{modalMode === 'create' ? 'New user' : form.fullName}</h2>
                <p>
                  {modalMode === 'create'
                    ? (wizardStep === 1
                      ? 'Step 1 of 4 · Choose the account role'
                      : wizardStep === 2
                        ? 'Step 2 of 4 · Assign office scope'
                        : wizardStep === 3
                          ? 'Step 3 of 4 · Archive placement'
                          : 'Step 4 of 4 · Account details')
                    : 'Update account details'}
                </p>
              </div>
              <button type="button" className="ghost-icon" onClick={closeModal} aria-label="Close">
                <XIcon className="icon" />
              </button>
            </div>

            {modalMode === 'create' ? (
              <div className="admin-wizard">
                <div className="admin-wizard-steps" aria-label="Setup steps">
                  {['Role', 'Office', 'Archive tree', 'Account'].map((label, index) => (
                    <span
                      key={label}
                      className={`admin-wizard-step ${wizardStep === index + 1 ? 'active' : wizardStep > index + 1 ? 'done' : ''}`}
                    >
                      <em>{index + 1}</em>
                      {label}
                    </span>
                  ))}
                </div>

                {wizardStep === 1 ? (
                  <div className="admin-wizard-panel admin-wizard-panel-role">
                    <div className="admin-wizard-lead">
                      <strong>Who is this account for?</strong>
                      <p>Choose a role. Office access and archive scope follow this selection.</p>
                    </div>
                    <label className="admin-role-combo">
                      <span>Role</span>
                      <div className="admin-role-combo-shell">
                        <select
                          value={form.role}
                          onChange={(event) => handleRoleChange(event.target.value)}
                          aria-label="Who is this account for?"
                        >
                          {roleOptions.filter((option) => option.value !== 'ADMIN').map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>
                    <div className="admin-role-combo-hint" aria-live="polite">
                      <em>{roleLabel(form.role)}</em>
                      <p>{roleChoiceHints[form.role] || OFFICE_META[form.role]?.summary || ''}</p>
                    </div>
                  </div>
                ) : null}

                {wizardStep === 2 ? (
                  <div className="admin-wizard-panel admin-wizard-panel-office">
                    <div className="admin-wizard-lead">
                      <strong>
                        {form.role === 'STUDENT'
                          ? 'Student ID and academic placement'
                          : form.role === 'HOD'
                            ? 'Assign academic department'
                            : form.role === 'DEAN_OF_FACULTY'
                              ? 'Assign faculty'
                              : `Confirm ${roleLabel(form.role)} office`}
                      </strong>
                      <p>
                        {form.role === 'STUDENT'
                          ? 'Look up an existing student. Their workspace loads automatically; Admin may unlock placement to change it.'
                          : form.role === 'HOD'
                            ? 'They only browse their faculty and this department.'
                            : form.role === 'DEAN_OF_FACULTY'
                              ? 'They browse every department under this faculty.'
                              : 'This office shares one dashboard and archive branch for the role.'}
                      </p>
                    </div>

                    <div className="admin-office-role-chip">
                      <span>Role</span>
                      <strong>{roleLabel(form.role)}</strong>
                    </div>

                    {form.role === 'STUDENT' ? (
                      <div className="admin-office-fields">
                        <label className="admin-office-field">
                          <span>Student ID</span>
                          <div className="admin-inline-field-row">
                            <input
                              value={form.studentNumber}
                              onChange={(event) => {
                                resetStudentLookupState()
                                setForm({
                                  ...form,
                                  studentNumber: event.target.value,
                                  faculty: '',
                                  academicDepartment: '',
                                  fullName: ''
                                })
                              }}
                              placeholder="e.g. 20251SEN001"
                              required
                            />
                            <button
                              type="button"
                              className="ghost-btn"
                              onClick={() => lookupStudentForAdmin(form.studentNumber)}
                              disabled={studentLinkBusy}
                            >
                              {studentLinkBusy ? 'Searching…' : 'Look up'}
                            </button>
                          </div>
                        </label>
                        {studentLinkError ? <p className="admin-field-error">{studentLinkError}</p> : null}

                        {studentLinkPreview?.hasLoginAccount ? (
                          <div className="admin-student-preview admin-student-existing admin-student-has-login">
                            <div>
                              <strong>{studentLinkPreview.studentName}</strong>
                              <span>{studentLinkPreview.studentNumber}</span>
                            </div>
                            <p>
                              Login already exists as <strong>{studentLinkPreview.loginUsername}</strong>
                              {studentLinkPreview.loginActive
                                ? '. A second account cannot be created for the same student ID.'
                                : ', but the account is inactive — that is why this student cannot sign in.'}
                            </p>
                            <p>
                              {studentLinkPreview.loginActive
                                ? 'If the password is unknown, open Fix login and set a new password.'
                                : 'Open Fix login to activate the account and set a password.'}
                            </p>
                            <div className="admin-placement-lock-bar">
                              <p>
                                Existing placement:
                                {' '}
                                {[studentLinkPreview.faculty, studentLinkPreview.department].filter(Boolean).join(' · ')
                                  || 'not set'}
                              </p>
                              <button
                                type="button"
                                className="primary-btn admin-placement-edit-btn"
                                onClick={() => {
                                  if (studentLinkPreview.linkedUser) {
                                    openEditModal({
                                      ...studentLinkPreview.linkedUser,
                                      active: true
                                    })
                                  }
                                }}
                              >
                                Fix login
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {studentLinkPreview && !studentLinkPreview.hasLoginAccount ? (
                          <>
                            <div className="admin-student-preview admin-student-existing">
                              <div>
                                <strong>{studentLinkPreview.studentName}</strong>
                                <span>{studentLinkPreview.studentNumber}</span>
                              </div>
                              <p>
                                Existing archive found
                                {studentLinkPreview.faculty || studentLinkPreview.department
                                  ? `: ${[studentLinkPreview.faculty, studentLinkPreview.department].filter(Boolean).join(' · ')}`
                                  : '. Set faculty and department below.'}
                              </p>
                              <div className="admin-student-workspace-preview">
                                <span>Student login workspace</span>
                                <ul>
                                  {STUDENT_WORKSPACE_TEMPLATE.map((folder) => (
                                    <li key={folder.id}>{folder.name}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            <div className="admin-placement-lock-bar">
                              <p>
                                {studentPlacementLocked && !allowAdminEditPlacement
                                  ? 'Placement is locked to the existing archive. Admin can unlock to change it.'
                                  : allowAdminEditPlacement
                                    ? 'Admin edit enabled. Changing faculty/department updates Registrar storage placement.'
                                    : 'Choose faculty and department for this student.'}
                              </p>
                              {studentPlacementLocked ? (
                                <button
                                  type="button"
                                  className="ghost-btn admin-placement-edit-btn"
                                  onClick={() => {
                                    if (allowAdminEditPlacement) {
                                      setAllowAdminEditPlacement(false)
                                      setForm((current) => ({
                                        ...current,
                                        faculty: studentLinkPreview.faculty || '',
                                        academicDepartment: studentLinkPreview.department || ''
                                      }))
                                    } else {
                                      setAllowAdminEditPlacement(true)
                                    }
                                  }}
                                >
                                  {allowAdminEditPlacement ? 'Keep existing placement' : 'Change placement'}
                                </button>
                              ) : null}
                            </div>

                            <label className="admin-office-field">
                              <span>Faculty</span>
                              <select
                                value={form.faculty}
                                onChange={(event) => setForm({
                                  ...form,
                                  faculty: event.target.value,
                                  academicDepartment: ''
                                })}
                                disabled={studentPlacementLocked && !allowAdminEditPlacement}
                                required
                              >
                                <option value="">Select faculty…</option>
                                {facultyOptions.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                            <label className="admin-office-field">
                              <span>Department</span>
                              <select
                                value={form.academicDepartment}
                                onChange={(event) => setForm({ ...form, academicDepartment: event.target.value })}
                                disabled={!form.faculty || (studentPlacementLocked && !allowAdminEditPlacement)}
                                required
                              >
                                <option value="">
                                  {form.faculty ? 'Select department…' : 'Choose faculty first'}
                                </option>
                                {studentDepartmentOptions.map((department) => (
                                  <option key={department} value={department}>{department}</option>
                                ))}
                              </select>
                            </label>
                          </>
                        ) : null}
                      </div>
                    ) : null}

                    {form.role === 'HOD' ? (
                      <div className="admin-office-fields">
                        <label className="admin-office-field">
                          <span>Academic department</span>
                          <select
                            value={form.department}
                            onChange={(event) => setForm({ ...form, department: event.target.value })}
                            required
                          >
                            <option value="">Select department…</option>
                            {academicDepartmentOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.faculty} · {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {form.department ? (
                          <div className="admin-office-assignment compact">
                            <strong>
                              {officeMembers.length
                                ? `Join HOD access · ${form.department}`
                                : `First HOD · ${form.department}`}
                            </strong>
                            <p>
                              {facultyForAcademicDepartment(form.department)
                                ? `${facultyForAcademicDepartment(form.department)} → ${form.department}`
                                : form.department}
                              {officeMembers.length
                                ? ` · ${officeMembers.length} existing account(s)`
                                : ''}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {form.role === 'DEAN_OF_FACULTY' ? (
                      <div className="admin-office-fields">
                        <label className="admin-office-field">
                          <span>Faculty</span>
                          <select
                            value={form.department}
                            onChange={(event) => setForm({ ...form, department: event.target.value })}
                            required
                          >
                            <option value="">Select faculty…</option>
                            {facultyOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                        {form.department ? (
                          <div className="admin-office-assignment compact">
                            <strong>
                              {officeMembers.length
                                ? `Join Dean access · ${form.department}`
                                : `First Dean · ${form.department}`}
                            </strong>
                            <p>
                              {officeMembers.length
                                ? `${officeMembers.length} existing Dean account(s) in this faculty.`
                                : 'Faculty-wide archive for this dean.'}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {form.role !== 'STUDENT' && form.role !== 'HOD' && form.role !== 'DEAN_OF_FACULTY' ? (
                      <div className="admin-office-fields">
                        <div className="admin-office-assignment compact">
                          <strong>
                            {officeMembers.length
                              ? `Join existing ${roleLabel(form.role)} office`
                              : `${roleLabel(form.role)} office`}
                          </strong>
                          <p>
                            {officeMembers.length
                              ? `Shared with ${officeMembers.length} member(s).`
                              : 'Uses this role’s shared archive branch.'}
                          </p>
                        </div>
                        <label className="admin-office-field">
                          <span>{departmentFieldLabel(form.role)}</span>
                          <input
                            value={form.department}
                            onChange={(event) => setForm({ ...form, department: event.target.value })}
                            required
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {wizardStep === 3 ? (
                  <div className="admin-wizard-panel admin-wizard-panel-tree">
                    <div className="admin-wizard-lead">
                      <strong>
                        {form.role === 'STUDENT'
                          ? 'Student archive workspace'
                          : `${roleLabel(form.role)} archive tree`}
                      </strong>
                      <p>
                        {form.role === 'STUDENT'
                          ? 'This is what the student sees after login. Faculty/department from step 2 only store them in the Registrar archive.'
                          : 'Preview of folders this role can browse (Year → Semester → Student → Document type).'}
                      </p>
                    </div>
                    <div className="admin-office-role-chip">
                      <span>Role</span>
                      <strong>{roleLabel(form.role)}</strong>
                      {form.role === 'STUDENT' && form.faculty ? (
                        <>
                          <span>Stored under</span>
                          <strong>
                            {[form.faculty, form.academicDepartment].filter(Boolean).join(' · ')}
                          </strong>
                        </>
                      ) : null}
                      {form.role === 'HOD' && form.department ? (
                        <>
                          <span>Dept</span>
                          <strong>{form.department}</strong>
                        </>
                      ) : null}
                      {form.role === 'DEAN_OF_FACULTY' && form.department ? (
                        <>
                          <span>Faculty</span>
                          <strong>{form.department}</strong>
                        </>
                      ) : null}
                    </div>
                    {templateLoading && form.role !== 'STUDENT' ? (
                      <p className="admin-muted-cell">Loading archive template…</p>
                    ) : (
                      <TemplateTree nodes={filteredArchiveTemplate} />
                    )}
                    {form.role !== 'STUDENT' && roleCategories.length ? (
                      <div className="admin-category-picker">
                        <span className="admin-field-label">Document categories</span>
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
                  <form className="admin-user-form admin-user-form-step4" onSubmit={handleSubmit}>
                    <div className="admin-wizard-lead">
                      <strong>Account details</strong>
                      <p>Finish with the login name and password for this {roleLabel(form.role).toLowerCase()}.</p>
                    </div>
                    <div className="admin-office-role-chip">
                      <span>Role</span>
                      <strong>{roleLabel(form.role)}</strong>
                      {form.role === 'STUDENT' && form.studentNumber ? (
                        <>
                          <span>ID</span>
                          <strong>{form.studentNumber}</strong>
                        </>
                      ) : null}
                    </div>
                    <label>
                      <span>Username</span>
                      <input
                        value={form.username}
                        onChange={(event) => setForm({ ...form, username: event.target.value })}
                        placeholder="e.g. jane.doe"
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
                <label>
                  <span>Role</span>
                  <select value={form.role} onChange={(event) => handleRoleChange(event.target.value)}>
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{departmentFieldLabel(form.role)}</span>
                  {form.role === 'HOD' ? (
                    <select
                      value={form.department}
                      onChange={(event) => setForm({ ...form, department: event.target.value })}
                      required
                    >
                      <option value="">Select department…</option>
                      {academicDepartmentOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : form.role === 'DEAN_OF_FACULTY' ? (
                    <select
                      value={form.department}
                      onChange={(event) => setForm({ ...form, department: event.target.value })}
                      required
                    >
                      <option value="">Select faculty…</option>
                      {facultyOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={form.department}
                      onChange={(event) => setForm({ ...form, department: event.target.value })}
                      required
                    />
                  )}
                </label>
                {form.role === 'STUDENT' ? (
                  <>
                    <label>
                      <span>Student ID</span>
                      <div className="admin-inline-field-row">
                        <input
                          value={form.studentNumber}
                          onChange={(event) => setForm({ ...form, studentNumber: event.target.value })}
                          placeholder="Registered student ID"
                          required
                        />
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => lookupStudentForAdmin(form.studentNumber)}
                          disabled={studentLinkBusy}
                        >
                          {studentLinkBusy ? 'Searching…' : 'Look up'}
                        </button>
                      </div>
                    </label>
                    {studentLinkError ? <p className="admin-field-error">{studentLinkError}</p> : null}
                    {studentLinkPreview ? (
                      <p className="admin-muted-cell">
                        Linked archive: {studentLinkPreview.studentName} · {[studentLinkPreview.faculty, studentLinkPreview.department].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                  </>
                ) : null}
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
