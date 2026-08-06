import { facultyForAcademicDepartment } from './academicDepartments'

export const OFFICE_META = {
  REGISTRAR: {
    label: 'Registrar',
    department: 'Registrar Office',
    summary: 'Registration, reintegration, and application archive work.',
    categories: ['REGISTRATION_FORM', 'REINTEGRATION_FORM', 'APPLICATION_DOCUMENTS'],
    folderPrefixes: ['AUCA', 'FAC', 'AY', 'SEM', 'REG', 'SREG', 'SRIN', 'SAPP', 'FLD', 'STD', 'SOFF']
  },
  FINANCE: {
    label: 'Finance Office',
    department: 'Finance Office',
    summary: 'Independent finance archive branch under each department (Finance academic years and semesters).',
    categories: ['REGISTRATION_FORM', 'REINTEGRATION_FORM', 'APPLICATION_DOCUMENTS'],
    folderPrefixes: ['AUCA', 'FAC', 'AY', 'SEM', 'FIN', 'SREG', 'SRIN', 'SAPP', 'FLD', 'STD', 'SOFF']
  },
  EXAMINATION_OFFICER: {
    label: 'Examination Office',
    department: 'Examination Office',
    summary: 'Exam papers and marks using the same archive structure as other offices, with examination-only records.',
    categories: ['EXAMINATION_DOCUMENTS'],
    folderPrefixes: ['AUCA', 'FAC', 'AY', 'SEM', 'SEXM', 'FLD', 'STD', 'SOFF']
  },
  HOD: {
    label: 'Head of Department',
    department: 'Department Office',
    summary: 'Department approvals and application submissions within the assigned academic department.',
    categories: ['APPLICATION_DOCUMENTS'],
    folderPrefixes: ['AUCA', 'FAC', 'AY', 'SEM', 'SAPP', 'FLD', 'STD', 'STU', 'SOFF', 'SMY', 'SARC']
  },
  DEAN_OF_FACULTY: {
    label: 'Dean of Faculty',
    department: 'Faculty Office',
    summary: 'Faculty-wide access to registration, application, examination, and approved project records within the assigned faculty.',
    categories: ['REGISTRATION_FORM', 'REINTEGRATION_FORM', 'APPLICATION_DOCUMENTS', 'EXAMINATION_DOCUMENTS', 'FINAL_YEAR_PROJECT'],
    folderPrefixes: [
      'AUCA', 'FAC', 'AY', 'SEM', 'FLD', 'STD', 'STU',
      'SREG', 'SRIN', 'SAPP', 'SEXM', 'SFYP', 'SOFF', 'SMY', 'SARC'
    ]
  },
  STUDENT: {
    label: 'Student',
    department: 'Student Workspace',
    summary: 'Personal workspace linked to a registered student ID: Official Documents, Final Year Project, and Archive Project.',
    categories: ['REGISTRATION_FORM', 'REINTEGRATION_FORM', 'APPLICATION_DOCUMENTS', 'FINAL_YEAR_PROJECT'],
    folderPrefixes: ['AUCA', 'FAC', 'AY', 'SEM', 'STD', 'STU', 'SFYP', 'SREG', 'SRIN', 'SAPP', 'MY', 'FLD', 'SOFF', 'SMY', 'SARC']
  },
  LIBRARIAN: {
    label: 'Librarian',
    department: 'University Library',
    summary: 'Final year project review and archive approval.',
    categories: ['FINAL_YEAR_PROJECT'],
    folderPrefixes: [
      'AUCA', 'FAC', 'AY', 'SEM',
      'FLD', 'STD', 'STU', 'SFYP', 'SMY', 'SOFF', 'SARC', 'LIB', 'FYP', 'ACC', 'REJ'
    ]
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
  { value: 'REGISTRAR', label: 'Registrar' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'EXAMINATION_OFFICER', label: 'Examination' },
  { value: 'HOD', label: 'HOD' },
  { value: 'DEAN_OF_FACULTY', label: 'Dean of Faculty' },
  { value: 'LIBRARIAN', label: 'Librarian' },
  { value: 'STUDENT', label: 'Student' }
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

const OFFICE_STRUCTURE_SUFFIXES = {
  FINANCE: 'FIN',
  EXAMINATION_OFFICER: 'EXAM',
  LIBRARIAN: 'LIB',
  HOD: 'HOD'
}

function officeStructureSuffix(role) {
  if (role === 'REGISTRAR' || role === 'DEAN_OF_FACULTY') {
    return null
  }
  return OFFICE_STRUCTURE_SUFFIXES[role] || null
}

function academicYearBelongsToOffice(code, role) {
  const upper = String(code || '').toUpperCase()
  if (!/-AY-\d{8}(-[A-Z]+)?$/.test(upper)) {
    return true
  }
  const suffix = officeStructureSuffix(role)
  if (!suffix) {
    return /-AY-\d{8}$/.test(upper)
  }
  return upper.endsWith(`-${suffix}`)
}

function semesterBelongsToOffice(code, role) {
  const upper = String(code || '').toUpperCase()
  if (!upper.includes('-SEM-') || upper.includes('-STU-')) {
    return true
  }
  const suffix = officeStructureSuffix(role)
  if (!suffix) {
    return !/-AY-\d{8}-(FIN|EXAM|LIB|HOD)-SEM-/.test(upper)
  }
  return upper.includes(`-${suffix}-SEM-`)
}

function folderMatchesOffice(node, prefixes, role) {
  const code = String(node?.code || '').toUpperCase()
  if (!code) {
    return true
  }
  if (!academicYearBelongsToOffice(code, role)) {
    return false
  }
  if (!semesterBelongsToOffice(code, role)) {
    return false
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

function isFacultyFolderNode(node) {
  const code = String(node?.code || '').toUpperCase()
  return /^FAC-[A-Z0-9]+$/.test(code)
}

function isDepartmentFolderNode(node) {
  const code = String(node?.code || '').toUpperCase()
  return /^FAC-[A-Z0-9]+-DEPT-[A-Z0-9]+$/.test(code)
}

function normalizeNameSet(values) {
  const names = Array.isArray(values) ? values : [values]
  return new Set(
    names.map((name) => String(name || '').trim().toLowerCase()).filter(Boolean)
  )
}

/**
 * Dean of Faculty: keep only the assigned faculty folder(s) and descendants.
 * Other faculties (e.g. Business Administration) are removed from the tree.
 * Accepts one faculty name or a list (admin preview of multiple dean accounts).
 */
export function filterArchiveTreeForDeanFaculty(nodes, facultyName) {
  const assigned = normalizeNameSet(facultyName)
  if (!assigned.size) {
    return []
  }

  function walk(list) {
    return (list || []).reduce((acc, node) => {
      if (isFacultyFolderNode(node)) {
        if (assigned.has(String(node.name || '').trim().toLowerCase())) {
          acc.push({ ...node, children: node.children || [] })
        }
        return acc
      }
      const children = walk(node.children || [])
      if (children.length) {
        acc.push({ ...node, children })
      }
      return acc
    }, [])
  }

  return walk(nodes)
}

/** HOD: keep only the owning faculty and assigned academic department folder(s). */
export function filterArchiveTreeForHodDepartment(nodes, departmentName, facultyName = null) {
  const assignedDepartments = normalizeNameSet(departmentName)
  if (!assignedDepartments.size) {
    return []
  }
  const assignedFaculties = normalizeNameSet(facultyName)

  function walk(list) {
    return (list || []).reduce((acc, node) => {
      if (isFacultyFolderNode(node)) {
        if (assignedFaculties.size
          && !assignedFaculties.has(String(node.name || '').trim().toLowerCase())) {
          return acc
        }
        const children = walk(node.children || [])
        if (children.length) {
          acc.push({ ...node, children })
        }
        return acc
      }
      if (isDepartmentFolderNode(node)) {
        if (assignedDepartments.has(String(node.name || '').trim().toLowerCase())) {
          acc.push({ ...node, children: node.children || [] })
        }
        return acc
      }
      const children = walk(node.children || [])
      if (children.length) {
        acc.push({ ...node, children })
      }
      return acc
    }, [])
  }

  return walk(nodes)
}

/** Faculty assignments from Dean office members (department stores assigned faculty). */
export function resolveDeanFacultiesFromOffice(office) {
  if (!office || office.role !== 'DEAN_OF_FACULTY') {
    return null
  }
  const faculties = [...new Set(
    (office.members || [])
      .map((member) => String(member.department || '').trim())
      .filter((department) => department && !/^faculty office$/i.test(department))
  )]
  return faculties.length ? faculties : null
}

/** Academic departments from HOD office members. */
export function resolveHodDepartmentsFromOffice(office) {
  if (!office || office.role !== 'HOD') {
    return null
  }
  const departments = [...new Set(
    (office.members || [])
      .map((member) => String(member.department || '').trim())
      .filter((department) => department && !/^department office$/i.test(department))
  )]
  return departments.length ? departments : null
}

/**
 * Preferred HOD department for Admin tree preview (same scoped form as a live HOD login).
 * Prefers Software Engineering when present.
 */
export function resolvePreferredHodPreviewDepartment(office, preferredDepartment = null) {
  const departments = resolveHodDepartmentsFromOffice(office) || []
  if (!departments.length) {
    return null
  }
  const preferred = String(preferredDepartment || '').trim()
  if (preferred && departments.some((entry) => entry.toLowerCase() === preferred.toLowerCase())) {
    return departments.find((entry) => entry.toLowerCase() === preferred.toLowerCase()) || preferred
  }
  const softwareEngineering = departments.find((entry) => (
    entry.toLowerCase() === 'software engineering'
  ))
  return softwareEngineering || departments[0]
}

/** Demo / member student number used for Student office preview. */
export function resolveStudentNumberFromOffice(office) {
  if (!office || office.role !== 'STUDENT') {
    return null
  }
  for (const member of office.members || []) {
    const fromField = String(member.studentNumber || '').trim()
    if (fromField) {
      return fromField.toUpperCase()
    }
    const username = String(member.username || '').trim()
    if (/^\d/i.test(username)) {
      return username.toUpperCase()
    }
  }
  return null
}

/**
 * Extract a student's personal workspace roots from the full archive tree
 * (Official Documents, Final Year Project, Archive Project).
 */
export function extractStudentWorkspacePreview(nodes, studentNumber) {
  const needle = String(studentNumber || '').trim().toUpperCase()
  if (!needle) {
    return []
  }

  function isWorkspaceRoot(node) {
    const code = String(node?.code || '').toUpperCase()
    const name = String(node?.name || '').trim().toLowerCase()
    return code.endsWith('-SOFF')
      || code.endsWith('-SMY')
      || code.endsWith('-SARC')
      || name === 'official documents'
      || name === 'final year project'
      || name === 'archive project'
  }

  function findStudentFolder(list) {
    for (const node of list || []) {
      const code = String(node.code || '').toUpperCase()
      const name = String(node.name || '').trim().toUpperCase()
      if (code.includes(`-STU-${needle}`) || name === needle) {
        const workspace = (node.children || []).filter(isWorkspaceRoot)
        if (workspace.length) {
          return workspace
        }
      }
      const nested = findStudentFolder(node.children || [])
      if (nested.length) {
        return nested
      }
    }
    return []
  }

  return findStudentFolder(nodes)
}

export function filterArchiveTreeForOffice(nodes, role, viewerFaculty = null, viewerDepartment = null) {
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
      const keep = folderMatchesOffice(node, prefixes, role) || children.length
      if (keep) {
        acc.push({ ...node, children })
      }
      return acc
    }, [])
  }

  let tree = walk(nodes)
  if (role === 'DEAN_OF_FACULTY' && viewerFaculty) {
    tree = filterArchiveTreeForDeanFaculty(tree, viewerFaculty)
  }
  if (role === 'HOD' && viewerDepartment) {
    const departments = Array.isArray(viewerDepartment) ? viewerDepartment : [viewerDepartment]
    const faculties = [...new Set(
      departments.map((department) => facultyForAcademicDepartment(department)).filter(Boolean)
    )]
    tree = filterArchiveTreeForHodDepartment(tree, viewerDepartment, faculties)
  }
  return tree
}

const UPDATED_ARCHIVE_FORM = 'Year → Semester → Student → Document type'

export function adminOfficeTreeScopeNote(role, { faculties = null, departments = null, studentNumber = null } = {}) {
  switch (role) {
    case 'REGISTRAR':
      return `Registrar archive branch — ${UPDATED_ARCHIVE_FORM}.`
    case 'FINANCE':
      return `Finance-only years and semesters — ${UPDATED_ARCHIVE_FORM}.`
    case 'EXAMINATION_OFFICER':
      return `Examination-only years and semesters — ${UPDATED_ARCHIVE_FORM}.`
    case 'HOD': {
      if (!departments?.length) {
        return `HOD archive: Faculty → Department → ${UPDATED_ARCHIVE_FORM}.`
      }
      const department = departments[0]
      const faculty = facultyForAcademicDepartment(department)
      return faculty
        ? `Same view as that HOD: ${faculty} → ${department} → ${UPDATED_ARCHIVE_FORM}.`
        : `Scoped to ${department} — Faculty → Department → ${UPDATED_ARCHIVE_FORM}.`
    }
    case 'DEAN_OF_FACULTY':
      return faculties?.length
        ? `Scoped to ${faculties.join(', ')} — ${UPDATED_ARCHIVE_FORM}.`
        : `Dean faculty archive — ${UPDATED_ARCHIVE_FORM}.`
    case 'LIBRARIAN':
      return `Library years and semesters for final year projects — ${UPDATED_ARCHIVE_FORM}.`
    case 'STUDENT':
      return studentNumber
        ? `Student workspace for ${studentNumber}: Official Documents, Final Year Project, Archive Project.`
        : 'Student personal workspace: Official Documents, Final Year Project, and Archive Project.'
    default:
      return `Preview of folders this office can browse — ${UPDATED_ARCHIVE_FORM}.`
  }
}

export const STANDARD_OFFICE_ROLES = [
  'REGISTRAR',
  'FINANCE',
  'EXAMINATION_OFFICER',
  'HOD',
  'DEAN_OF_FACULTY',
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
      ? apiOffice.members.map((member) => {
          const matchedUser = roleUsers.find((user) => (
            (user.id != null && user.id === member.id)
            || (user.username && user.username === member.username)
          ))
          return {
            ...member,
            department: member.department || matchedUser?.department || '',
            studentNumber: member.studentNumber || matchedUser?.studentNumber || ''
          }
        })
      : roleUsers.map((user) => ({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          department: user.department || '',
          studentNumber: user.studentNumber || '',
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

export function officeMembersForRole(offices, role, department) {
  const office = (offices || []).find((entry) => entry.role === role)
  const members = office?.members || []
  if (role === 'HOD' && department) {
    return members.filter((member) => String(member.department || '').trim().toLowerCase() === String(department).trim().toLowerCase())
  }
  if (role === 'DEAN_OF_FACULTY' && department) {
    return members.filter((member) => String(member.department || '').trim().toLowerCase() === String(department).trim().toLowerCase())
  }
  return members
}
