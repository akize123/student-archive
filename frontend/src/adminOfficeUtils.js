export const OFFICE_META = {
  REGISTRAR: {
    label: 'Registrar',
    department: 'Registrar Office',
    summary: 'Registration, reintegration, and application archive work.',
    categories: ['REGISTRATION_FORM', 'REINTEGRATION_FORM', 'APPLICATION_DOCUMENTS'],
    folderPrefixes: ['AUCA', 'FAC', 'AY', 'SEM', 'REG', 'SREG', 'SRIN', 'SAPP', 'FLD', 'STD']
  },
  EXAMINATION_OFFICER: {
    label: 'Examination Office',
    department: 'Examination Office',
    summary: 'Exam papers, marks, and course-level archive work.',
    categories: ['EXAMINATION_DOCUMENTS'],
    folderPrefixes: ['AUCA', 'FAC', 'AY', 'SEM', 'SEXM', 'FLD', 'STD']
  },
  HOD: {
    label: 'Head of Department',
    department: 'Department Office',
    summary: 'Department approvals and application submissions.',
    categories: ['APPLICATION_DOCUMENTS'],
    folderPrefixes: ['AUCA', 'FAC', 'AY', 'SEM', 'SAPP', 'FLD', 'STD']
  },
  STUDENT: {
    label: 'Student',
    department: 'Student Workspace',
    summary: 'Student project uploads and personal archive files.',
    categories: ['FINAL_YEAR_PROJECT'],
    folderPrefixes: ['AUCA', 'FAC', 'AY', 'SEM', 'STD', 'STU', 'SFYP', 'SREG', 'SRIN', 'SAPP', 'MY', 'FLD']
  },
  LIBRARIAN: {
    label: 'Librarian',
    department: 'University Library',
    summary: 'Final year project review and archive approval.',
    categories: ['FINAL_YEAR_PROJECT'],
    folderPrefixes: ['AUCA', 'FAC', 'AY', 'SEM', 'STD', 'SFYP', 'FLD']
  }
}

export const CATEGORY_LABELS = {
  REGISTRATION_FORM: 'Registration Forms',
  REINTEGRATION_FORM: 'Reintegration Forms',
  APPLICATION_DOCUMENTS: 'Application Documents',
  EXAMINATION_DOCUMENTS: 'Exams',
  FINAL_YEAR_PROJECT: 'Final Year Project'
}

export const activityScopeTabs = [
  { value: 'ALL', label: 'All activity' },
  { value: 'REGISTRAR', label: 'Registrar' },
  { value: 'EXAMINATION_OFFICER', label: 'Examination' },
  { value: 'HOD', label: 'HOD' },
  { value: 'LIBRARIAN', label: 'Librarian' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'ADMIN', label: 'Admin' }
]

export function roleLabel(role) {
  return OFFICE_META[role]?.label
    || String(role || '')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
}

function officeFolderPrefixes(role) {
  return OFFICE_META[role]?.folderPrefixes || ['AUCA', 'FAC', 'AY', 'SEM', 'FLD', 'STD']
}

function isStudentDocumentFolder(node) {
  const code = String(node?.code || '').toUpperCase()
  const name = String(node?.name || '').toLowerCase()
  return code.includes('-STU-')
    || code.includes('-SFYP')
    || code.endsWith('SFYP')
    || code.includes('-MY-')
    || code.includes('-SREG')
    || code.includes('-SRIN')
    || code.includes('-SAPP')
    || name.includes('final year project')
    || name.includes('fyp')
    || name.includes('student')
}

function isStructureFolderForStudentPath(node) {
  const code = String(node?.code || '').toUpperCase()
  return code === 'AUCA'
    || /^FAC-[A-Z0-9]+$/.test(code)
    || /^FAC-[A-Z0-9]+-DEPT-[A-Z0-9]+$/.test(code)
    || code.includes('-AY-')
    || code.includes('-SEM-')
    || /^AY-/.test(code)
    || /^SEM-/.test(code)
}

function folderMatchesOffice(node, prefixes) {
  const code = String(node?.code || '').toUpperCase()
  if (!code) {
    return true
  }
  return prefixes.some((prefix) => {
    const token = String(prefix || '').toUpperCase()
    if (!token) {
      return false
    }
    return code === token
      || code.startsWith(`${token}-`)
      || code.includes(`-${token}-`)
      || code.endsWith(`-${token}`)
  })
}

export function filterArchiveTreeForOffice(nodes, role) {
  if (role === 'STUDENT') {
    function walkStudent(list) {
      return (list || []).reduce((acc, node) => {
        const children = walkStudent(node.children || [])
        const keep = isStudentDocumentFolder(node)
          || isStructureFolderForStudentPath(node)
          || children.length
        if (keep) {
          acc.push({ ...node, children })
        }
        return acc
      }, [])
    }
    return walkStudent(nodes)
  }

  const prefixes = officeFolderPrefixes(role)

  function walk(list) {
    return (list || []).reduce((acc, node) => {
      const children = walk(node.children || [])
      const keep = folderMatchesOffice(node, prefixes) || children.length
      if (keep) {
        acc.push({ ...node, children })
      }
      return acc
    }, [])
  }

  return walk(nodes)
}

export const STANDARD_OFFICE_ROLES = [
  'REGISTRAR',
  'EXAMINATION_OFFICER',
  'HOD',
  'LIBRARIAN',
  'STUDENT'
]

export function buildAdminOffices(users = [], usersByRole = {}, officeApiData = []) {
  const apiByRole = new Map((officeApiData || []).map((office) => [office.role, office]))
  const roles = new Set(STANDARD_OFFICE_ROLES)
  Object.keys(usersByRole || {}).forEach((role) => {
    if (role && role !== 'ADMIN') {
      roles.add(role)
    }
  })
  ;(users || []).forEach((user) => {
    if (user?.role && user.role !== 'ADMIN') {
      roles.add(user.role)
    }
  })
  ;(officeApiData || []).forEach((office) => {
    if (office?.role && office.role !== 'ADMIN') {
      roles.add(office.role)
    }
  })

  const preferred = STANDARD_OFFICE_ROLES
  const ordered = [
    ...preferred.filter((role) => roles.has(role)),
    ...[...roles].filter((role) => !preferred.includes(role)).sort()
  ]

  return ordered.map((role) => {
    const meta = OFFICE_META[role]
    const apiOffice = apiByRole.get(role)
    const roleUsers = (users || []).filter((user) => user.role === role)
    const count = Number(
      apiOffice?.userCount
      || usersByRole?.[role]
      || roleUsers.length
      || 0
    )
    const members = apiOffice?.members?.length
      ? apiOffice.members
      : roleUsers.map((user) => ({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          active: user.active,
          recentActivityCount: 0
        }))
    return {
      role,
      label: apiOffice?.label || meta?.label || roleLabel(role),
      department: apiOffice?.department || meta?.department || roleLabel(role),
      summary: apiOffice?.summary || meta?.summary || `Live archive activity for ${roleLabel(role)}.`,
      categories: apiOffice?.categories || meta?.categories || [],
      userCount: count,
      recentActivityCount: apiOffice?.recentActivityCount || 0,
      members
    }
  })
}

export function officeMembersForRole(offices, role) {
  const office = (offices || []).find((entry) => entry.role === role)
  return office?.members || []
}
