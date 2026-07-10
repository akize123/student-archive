import React, { useCallback, useEffect, useRef, useState, useDeferredValue } from 'react'
import { createSubfolder, decideApproval, deleteDocument, deleteFolder, downloadFolderZip, formatLoginError, getActivities, getAdminDashboard, getArchivedDocuments, getDashboard, getFolder, getStudentArchive, login, lookupStudent, moveFolder, copyFolder, openDocument, permanentlyDeleteDocument, renameFolder, restoreDocument, scanDocument, searchDocuments, shareFolder, submitUpload } from './api'
import AdminDashboard from './components/AdminDashboard'
import AdminOfficeView, { buildAdminOffices } from './components/AdminOfficeView'
import StudentDashboard from './components/StudentDashboard'
import BrandLogo from './components/BrandLogo'
import {
  ACADEMIC_YEARS,
  applyStudentIdDefaults,
  normalizeStudentId,
  semesterOptionsForAcademicYear,
  STUDENT_ID_FORMATS_HINT,
  validateStudentIdDepartmentMatch,
  validateStudentIdForNewEntry
} from './studentId'
import {
  ArrowRightIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DocumentIcon,
  DownloadIcon,
  FolderIcon,
  FilterIcon,
  FolderPlusIcon,
  GridIcon,
  ListIcon,
  RefreshIcon,
  SearchIcon,
  ShareIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
  HomeIcon,
  MailIcon,
  LockIcon,
  ChevronDownIcon
} from './components/Icons'

const demoDashboard = {
  userName: 'T. Mukamana',
  role: 'Registrar Office',
  department: 'Registrar',
  lastSignIn: '2 hours ago from Kigali',
  notifications: 3,
  recentlyUploaded: 128,
  pendingApprovals: 14,
  departmentFiles: 612,
  storageUsedBytes: 62.4 * 1024 * 1024 * 1024,
  storageLimitBytes: 100 * 1024 * 1024 * 1024,
  archiveTree: [
    {
      id: 11,
      name: 'Student Documents (STD)',
      code: 'STD',
      parentId: null,
      itemCount: 48,
      children: [
        { id: 12, name: 'Registration Forms', code: 'SREG', parentId: 11, itemCount: 14, children: [] },
        { id: 13, name: 'Reintegration Forms', code: 'SRIN', parentId: 11, itemCount: 9, children: [] },
        { id: 14, name: 'Application Documents', code: 'SAPP', parentId: 11, itemCount: 17, children: [] },
        { id: 15, name: 'Exams', code: 'SEXM', parentId: 11, itemCount: 8, children: [] }
      ]
    },
    {
      id: 1,
      name: 'Registrar Office (REG)',
      code: 'REG',
      parentId: null,
      itemCount: 1042,
      children: [
        { id: 2, name: 'Transcripts', code: 'TRN', parentId: 1, itemCount: 612, children: [] },
        { id: 3, name: 'Enrollment Records', code: 'ENR', parentId: 1, itemCount: 224, children: [] },
        { id: 4, name: 'Exam Registrations', code: 'EXM', parentId: 1, itemCount: 86, children: [] },
        { id: 5, name: 'Graduation Files', code: 'GRD', parentId: 1, itemCount: 120, children: [] }
      ]
    }
  ],
  recentFiles: [
    {
      id: 101,
      title: 'STUD-2026-001 Registration Form',
      ownerName: 'M. Uwimana',
      studentNumber: '20251SEN001',
      department: 'Computer Science',
      issueDate: '2026-01-12',
      modifiedAt: '2026-01-12T09:30:00',
      status: 'ARCHIVED',
      fileName: 'Registration Form',
      sizeBytes: 2440000,
      pageCount: 3,
      category: 'REGISTRATION_FORM',
      type: 'PDF',
      folderName: 'Registration Forms',
      starred: false
    },
    {
      id: 102,
      title: 'STUD-2026-014 Reintegration Form',
      ownerName: 'K. Twagirayezu',
      studentNumber: '20251IMA002',
      department: 'Software Engineering',
      issueDate: '2026-02-08',
      modifiedAt: '2026-02-08T14:10:00',
      status: 'APPROVED',
      fileName: 'Reintegration Form',
      sizeBytes: 1200000,
      pageCount: 2,
      category: 'REINTEGRATION_FORM',
      type: 'PDF',
      folderName: 'Reintegration Forms',
      starred: false
    },
    {
      id: 103,
      title: 'STUD-2026-021 Application Documents',
      ownerName: 'S. Ingabire',
      studentNumber: '20251NET003',
      department: 'Admissions',
      issueDate: '2026-03-03',
      modifiedAt: '2026-03-03T11:00:00',
      status: 'APPROVED',
      fileName: 'Application Documents',
      sizeBytes: 5800000,
      pageCount: 6,
      category: 'APPLICATION_DOCUMENTS',
      type: 'PDF',
      folderName: 'Application Documents',
      starred: false
    }
  ],
  awaitingApproval: [
    {
      id: 201,
      documentId: 101,
      documentTitle: 'HOD-IT_SE_THESIS_2025_SEM1_Defense-Slides_v03_20250402.pptx',
      requestedBy: 'S. Ingabire',
      requestedAt: '2025-06-25T10:00:00',
      dueAt: '2025-06-27T10:00:00',
      note: 'Needs approval before archiving',
      priority: 'High',
      status: 'PENDING'
    },
    {
      id: 202,
      documentId: 102,
      documentTitle: 'HOD-IT_SE_THESIS_2025_SEM1_Meeting-Minutes_v02_20250422.docx',
      requestedBy: 'K. Twagirayezu',
      requestedAt: '2025-06-25T10:00:00',
      dueAt: '2025-06-27T10:00:00',
      note: 'Ready for registration office review',
      priority: 'Medium',
      status: 'PENDING'
    }
  ],
  departmentActivity: [
    { id: 1, message: 'Uploaded thesis defense slides', actor: 'M. Uwimana', category: 'UPLOAD', createdAt: '2025-06-25T08:00:00' },
    { id: 2, message: 'Approved meeting minutes', actor: 'T. Mukamana', category: 'APPROVAL', createdAt: '2025-06-25T06:00:00' },
    { id: 3, message: 'Synced registrar archive tree', actor: 'System', category: 'SYNC', createdAt: '2025-06-25T04:00:00' }
  ]
}

const quickAccess = [
  { label: 'Recent', icon: ClockIcon, count: null, action: 'recent' },
  { label: 'Dashboard', icon: HomeIcon, count: null, action: 'dashboard' },
  { label: 'Archive', icon: TrashIcon, count: null, action: 'archive' }
]

const staffQuickAccess = [
  { label: 'Recent', icon: ClockIcon, count: null, action: 'recent' },
  { label: 'Dashboard', icon: HomeIcon, count: null, action: 'dashboard' },
  { label: 'Archive', icon: TrashIcon, count: null, action: 'archive' },
  { label: 'Browse Archive', icon: FolderIcon, count: null, action: 'browse' }
]

const adminQuickAccess = [
  { label: 'System Dashboard', icon: HomeIcon, count: null, action: 'dashboard' },
  { label: 'Archive', icon: TrashIcon, count: null, action: 'archive' },
  { label: 'Browse Archive', icon: FolderIcon, count: null, action: 'browse' }
]

const studentDocumentCategories = [
  {
    value: 'REGISTRATION_FORM',
    label: 'Registration Forms',
    folderCode: 'SREG',
    summary: 'Enrollment and registration paperwork'
  },
  {
    value: 'REINTEGRATION_FORM',
    label: 'Reintegration Forms',
    folderCode: 'SRIN',
    summary: 'Re-entry and reinstatement requests'
  },
  {
    value: 'APPLICATION_DOCUMENTS',
    label: 'Application Documents',
    folderCode: 'SAPP',
    summary: 'Admission and application files'
  },
  {
    value: 'EXAMINATION_DOCUMENTS',
    label: 'Exams',
    folderCode: 'SEXM',
    summary: 'Exam papers, marks, and grading records'
  },
  {
    value: 'FINAL_YEAR_PROJECT',
    label: 'Final Year Project',
    folderCode: 'SFYP',
    summary: 'Thesis, capstone, and graduation project files'
  }
]

const studentCategoryByValue = Object.fromEntries(studentDocumentCategories.map((item) => [item.value, item]))
const studentCategoryByFolderCode = Object.fromEntries(studentDocumentCategories.map((item) => [item.folderCode, item.value]))

const examPaperTypes = [
  {
    value: 'MID_SEM',
    label: 'Mid-Sem',
    folderName: 'Mid-Sem',
    maxMarks: 30,
    summary: 'Mid-semester paper'
  },
  {
    value: 'FINAL_EXAMS',
    label: 'Final Exams',
    folderName: 'Final Exams',
    maxMarks: 40,
    summary: 'Final assessment paper'
  }
]

const examPaperTypeByValue = Object.fromEntries(examPaperTypes.map((item) => [item.value, item]))

const studentFacultyOptions = [
  {
    value: 'Faculty of Business Administration',
    label: 'Faculty of Business Administration',
    departments: ['Accounting', 'Management', 'Finance', 'Information Management']
  },
  {
    value: 'Faculty of Information Technology',
    label: 'Faculty of Information Technology',
    departments: ['Networking & Communication Systems', 'Software Engineering', 'Information Management']
  },
  {
    value: 'Faculty of Education',
    label: 'Faculty of Education',
    departments: ['Educational Psychology', 'Languages (English / French)', 'Religious Studies', 'Business Accounting & Computer Science']
  },
  {
    value: 'Faculty of Health Sciences (Nursing & Midwifery)',
    label: 'Faculty of Health Sciences (Nursing & Midwifery)',
    departments: ['Nursing', 'Midwifery']
  },
  {
    value: 'Faculty of Theology',
    label: 'Faculty of Theology',
    departments: ['Theology (Pastoral Training)']
  }
]

const studentFacultyByValue = Object.fromEntries(studentFacultyOptions.map((item) => [item.value, item]))

const emptyDashboard = {
  userName: '',
  role: '',
  department: '',
  lastSignIn: '',
  notifications: 0,
  recentlyUploaded: 0,
  pendingApprovals: 0,
  departmentFiles: 0,
  storageUsedBytes: 0,
  storageLimitBytes: 1,
  archiveTree: [],
  recentFiles: [],
  awaitingApproval: [],
  departmentActivity: []
}

const AUTH_SESSION_KEY = 'auca-archive-session'

const shareDestinationsByRole = {
  REGISTRAR: [
    { value: 'EXAMINATION_OFFICER', label: 'Examination Officer' },
    { value: 'HOD', label: 'Head of Department' }
  ],
  EXAMINATION_OFFICER: [
    { value: 'REGISTRAR', label: 'Registrar' },
    { value: 'HOD', label: 'Head of Department' }
  ],
  HOD: [
    { value: 'REGISTRAR', label: 'Registrar' },
    { value: 'EXAMINATION_OFFICER', label: 'Examination Officer' }
  ],
  ADMIN: [
    { value: 'REGISTRAR', label: 'Registrar' },
    { value: 'EXAMINATION_OFFICER', label: 'Examination Officer' },
    { value: 'HOD', label: 'Head of Department' }
  ]
}

function getShareDestinations(role) {
  return shareDestinationsByRole[role] || []
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

function isWithinDays(value, days) {
  if (!value) {
    return true
  }
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) {
    return true
  }
  return Date.now() - timestamp <= days * 24 * 60 * 60 * 1000
}

function filterTreeNodes(nodes, query) {
  const trimmed = String(query || '').trim().toLowerCase()
  if (!trimmed) {
    return nodes
  }

  function walk(list) {
    return list.reduce((acc, node) => {
      const children = node.children?.length ? walk(node.children) : []
      const matches = String(node.name || '').toLowerCase().includes(trimmed)
      if (matches || children.length) {
        acc.push({ ...node, children })
      }
      return acc
    }, [])
  }

  return walk(nodes)
}

const roleDashboardConfig = {
  ADMIN: {
    roleLabel: 'System Administrator',
    dashboardTitle: 'System Maintenance Dashboard',
    department: 'ICT Office',
    welcomeCopy: 'Maintain users, roles, privileges, and monitor archive system health.',
    defaultCategory: '',
    visibleCategories: []
  },
  REGISTRAR: {
    roleLabel: 'Registrar',
    dashboardTitle: 'Registrar Dashboard',
    department: 'Registrar Office',
    welcomeCopy: 'Manage student records, archive intake, and approval routing.',
    defaultCategory: '',
    visibleCategories: ['REGISTRATION_FORM', 'REINTEGRATION_FORM', 'APPLICATION_DOCUMENTS']
  },
  EXAMINATION_OFFICER: {
    roleLabel: 'Examination Officer',
    dashboardTitle: 'Examination Dashboard',
    department: 'Examination Office',
    welcomeCopy: 'Manage exam papers, marks, and course-level archives.',
    defaultCategory: 'EXAMINATION_DOCUMENTS',
    visibleCategories: ['EXAMINATION_DOCUMENTS']
  },
  HOD: {
    roleLabel: 'HOD',
    dashboardTitle: 'HOD Dashboard',
    department: 'Department Office',
    welcomeCopy: 'Oversee department submissions and final approval decisions.',
    defaultCategory: 'APPLICATION_DOCUMENTS',
    visibleCategories: ['APPLICATION_DOCUMENTS']
  },
  LIBRARIAN: {
    roleLabel: 'Librarian',
    dashboardTitle: 'Library Dashboard',
    department: 'University Library',
    welcomeCopy: 'Review final year project submissions and approve them into the archive.',
    defaultCategory: 'FINAL_YEAR_PROJECT',
    visibleCategories: ['FINAL_YEAR_PROJECT']
  },
  STUDENT: {
    roleLabel: 'Student',
    dashboardTitle: 'Student Dashboard',
    department: 'Student Workspace',
    welcomeCopy: 'Access registrar documents and upload your final year project within your personal storage limit.',
    defaultCategory: 'FINAL_YEAR_PROJECT',
    visibleCategories: ['FINAL_YEAR_PROJECT']
  }
}

function loadStoredSession() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function findStudentPersonalFolderParent(nodes, studentNumber) {
  const marker = String(studentNumber || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  let studentRoot = null
  let projectFolder = null

  function walk(list) {
    for (const node of list || []) {
      const code = String(node.code || '').toUpperCase()
      const name = String(node.name || '')
      if (marker && code.includes(`-STU-${marker}`) && name === String(studentNumber)) {
        studentRoot = node
      }
      if (code.endsWith('-SFYP') || name === 'Final Year Project') {
        projectFolder = node
      }
      if (node.children?.length) {
        walk(node.children)
      }
    }
  }

  walk(nodes)
  return projectFolder || studentRoot
}

function canStudentCreateInFolder(folder, studentNumber) {
  if (!folder || !studentNumber) {
    return false
  }
  const code = String(folder.code || '').toUpperCase()
  const marker = String(studentNumber).replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (['-SREG', '-SRIN', '-SAPP', '-SEXM'].some((suffix) => code.endsWith(suffix))) {
    return false
  }
  return code.includes(`-STU-${marker}`) || code.endsWith('-SFYP') || code.includes('-MY-')
}

const NON_ADMIN_STAFF_ROLES = ['REGISTRAR', 'EXAMINATION_OFFICER', 'HOD', 'LIBRARIAN']

function isNonAdminStaffRole(userRole) {
  return NON_ADMIN_STAFF_ROLES.includes(userRole)
}

function isFacultyFolder(folder) {
  const code = String(folder?.code || '').toUpperCase()
  return /^FAC-[A-Z0-9]+$/.test(code)
}

function isDepartmentFolder(folder) {
  const code = String(folder?.code || '').toUpperCase()
  return /^FAC-[A-Z0-9]+-DEPT-[A-Z0-9]+$/.test(code)
}

function isProtectedArchiveStructureFolder(folder) {
  if (!folder) {
    return false
  }
  if (folder.parentId == null) {
    return true
  }
  return isFacultyFolder(folder) || isDepartmentFolder(folder)
}

function canStaffCreateArchiveSubfolder(parentFolder, userRole) {
  if (!parentFolder || parentFolder.parentId == null) {
    return false
  }
  if (isFacultyFolder(parentFolder)) {
    return false
  }
  if (userRole === 'ADMIN') {
    return true
  }
  if (isNonAdminStaffRole(userRole)) {
    return !isDepartmentFolder(parentFolder)
  }
  return true
}

function findFolderNode(nodes, folderId) {
  for (const node of nodes || []) {
    if (node.id === folderId) {
      return node
    }
    const nested = findFolderNode(node.children, folderId)
    if (nested) {
      return nested
    }
  }
  return null
}

function canManageFolder(folder, userRole, studentNumber) {
  if (!folder || folder.parentId == null) {
    return false
  }
  if (isProtectedArchiveStructureFolder(folder)) {
    return false
  }
  if (userRole === 'STUDENT') {
    const code = String(folder.code || '').toUpperCase()
    if (['-SREG', '-SRIN', '-SAPP', '-SEXM'].some((suffix) => code.endsWith(suffix))) {
      return false
    }
    return code.includes('-MY-')
  }
  return true
}

function canPasteIntoFolder(folder, userRole, studentNumber) {
  if (!folder || folder.id == null || folder.id < 1) {
    return false
  }
  if (userRole === 'STUDENT') {
    return canStudentCreateInFolder(folder, studentNumber)
  }
  return true
}

function flattenFolderNodes(nodes, trail = []) {
  const rows = []
  for (const node of nodes || []) {
    const path = [...trail, node.name].filter(Boolean).join(' / ')
    rows.push({ ...node, path })
    if (node.children?.length) {
      rows.push(...flattenFolderNodes(node.children, [...trail, node.name]))
    }
  }
  return rows
}

function collectDescendantFolderIds(nodes, folderId) {
  const blocked = new Set([folderId])
  let found = false

  function markSubtree(node) {
    blocked.add(node.id)
    for (const child of node.children || []) {
      markSubtree(child)
    }
  }

  function walk(nodeList) {
    for (const node of nodeList || []) {
      if (node.id === folderId) {
        found = true
        markSubtree(node)
        return
      }
      if (node.children?.length) {
        walk(node.children)
      }
    }
  }

  walk(nodes)
  return found ? blocked : new Set([folderId])
}

function findStudentFolderInTree(nodes, studentNumber) {
  const marker = String(studentNumber || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (!marker) {
    return null
  }
  let found = null
  function walk(nodeList) {
    for (const node of nodeList || []) {
      const code = String(node.code || '').toUpperCase()
      if (code.includes(`-STU-${marker}`) && String(node.name) === String(studentNumber)) {
        found = node
        return
      }
      if (node.children?.length) {
        walk(node.children)
      }
      if (found) {
        return
      }
    }
  }
  walk(nodes)
  return found
}

function resolveArchiveFolderId({ folderId, studentNumber, archiveTree }) {
  if (folderId) {
    return folderId
  }
  return findStudentFolderInTree(archiveTree, studentNumber)?.id || null
}

function findFolderPath(nodes, folderId, trail = []) {
  for (const node of nodes || []) {
    const nextTrail = [...trail, node.name]
    if (node.id === folderId) {
      return nextTrail
    }
    const nested = findFolderPath(node.children, folderId, nextTrail)
    if (nested) {
      return nested
    }
  }
  return null
}

function formatFolderLocation(nodes, folderId) {
  const path = findFolderPath(nodes, folderId)
  if (!path?.length) {
    return ''
  }
  return path.join(' / ')
}

function searchArchiveTreeMatches(nodes, query, trail = []) {
  const trimmed = String(query || '').trim().toLowerCase()
  if (!trimmed) {
    return []
  }
  const matches = []
  for (const node of nodes || []) {
    const nextTrail = [...trail, node.name]
    const name = String(node.name || '').toLowerCase()
    const code = String(node.code || '').toLowerCase()
    if (name.includes(trimmed) || code.includes(trimmed)) {
      matches.push({
        id: `folder-${node.id}`,
        kind: 'folder',
        title: node.name,
        fileName: node.code || 'Folder',
        folderId: node.id,
        folderName: node.name,
        location: nextTrail.join(' / '),
        department: nextTrail.find((segment, index) => index >= 1) || nextTrail[0] || '',
        studentNumber: '',
        ownerName: '',
        category: 'FOLDER',
        modifiedAt: null
      })
    }
    if (node.children?.length) {
      matches.push(...searchArchiveTreeMatches(node.children, query, nextTrail))
    }
  }
  return matches
}

function enrichResultsWithLocation(results, archiveTree) {
  return (results || []).map((row) => {
    if (row.location) {
      return row
    }
    const location = formatFolderLocation(archiveTree, row.folderId)
    return {
      ...row,
      kind: row.kind || 'document',
      location: location || [row.department, row.folderName].filter(Boolean).join(' / ')
    }
  })
}

const QUICK_ACCESS_OPEN_KEY = 'auca-quick-access-open'

function loadQuickAccessOpen() {
  if (typeof window === 'undefined') {
    return true
  }
  try {
    const raw = window.localStorage.getItem(QUICK_ACCESS_OPEN_KEY)
    if (raw == null) {
      return true
    }
    return raw !== 'false'
  } catch {
    return true
  }
}

function getRoleDashboardConfig(role) {
  return roleDashboardConfig[role] || roleDashboardConfig.REGISTRAR
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) {
    return 'AU'
  }
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(size >= 100 || index === 0 ? 0 : 1)} ${units[index]}`
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(new Date(value))
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function formatLongDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(value))
}

function todayInputValue() {
  const date = new Date()
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
}

function buildDefaultUploadForm() {
  return {
    studentNumber: '',
    studentName: '',
    faculty: '',
    department: '',
    uploadedBy: '',
    category: 'REGISTRATION_FORM',
    examType: 'MID_SEM',
    academicYear: '',
    semester: '',
    course: '',
    marks: '',
    examRoom: '',
    pageCount: 1,
    issueDate: todayInputValue(),
    description: '',
    tags: ''
  }
}

function getCategoryMeta(value) {
  return studentCategoryByValue[value] || { value, label: value || 'Uncategorized', summary: 'Student record' }
}

function getDepartmentOptions(faculty) {
  return studentFacultyByValue[faculty]?.departments || []
}

function getExamPaperTypeMeta(value) {
  return examPaperTypeByValue[value] || {
    value,
    label: value || 'Exam',
    folderName: value || 'Exam',
    maxMarks: 40,
    summary: 'Exam paper'
  }
}

function buildExamTitle(form, studentNumber) {
  const examType = getExamPaperTypeMeta(form.examType)
  return [
    examType.label,
    String(form.course || '').trim(),
    String(form.academicYear || '').trim(),
    String(form.semester || '').trim(),
    String(studentNumber || '').trim()
  ].filter(Boolean).join(' - ')
}

function buildDocumentMetaLine(document) {
  if (!document?.examType) {
    return ''
  }

  const examType = getExamPaperTypeMeta(document.examType)
  return [
    examType.label,
    document.course,
    document.academicYear,
    document.semester,
    document.marks != null ? `${document.marks}/${examType.maxMarks}` : null,
    document.examRoom
  ].filter(Boolean).join(' | ')
}

function matchesDocumentSearch(document, query, category) {
  const normalizedQuery = String(query || '').trim().toLowerCase()
  const matchesQuery = !normalizedQuery
    || [
      document.title,
      document.fileName,
      document.ownerName,
      document.studentNumber,
      document.department,
      document.tags,
      document.description,
      document.examType,
      document.academicYear,
      document.semester,
      document.course,
      document.examRoom,
      document.marks
    ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery))

  const matchesCategory = !category || document.category === category
  return matchesQuery && matchesCategory
}

function statusTone(status) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'APPROVED') return 'status approved'
  if (normalized === 'PENDING') return 'status pending'
  if (normalized === 'ARCHIVED') return 'status archived'
  if (normalized === 'REJECTED') return 'status rejected'
  return 'status'
}

function getVisibleDocumentCategories(role) {
  if (role === 'ADMIN') {
    return []
  }
  const allowed = roleDashboardConfig[role]?.visibleCategories || studentDocumentCategories.map((category) => category.value)
  return studentDocumentCategories.filter((category) => allowed.includes(category.value))
}

function folderContainsActive(node, activeFolderId) {
  if (!activeFolderId) {
    return false
  }
  if (node.id === activeFolderId) {
    return true
  }
  return node.children?.some((child) => folderContainsActive(child, activeFolderId)) || false
}

function isAncestorOfActive(node, activeFolderId) {
  if (!activeFolderId || node.id === activeFolderId) {
    return false
  }
  return node.children?.some((child) => folderContainsActive(child, activeFolderId)) || false
}

function collectDefaultExpandedIds(nodes, depth = 0, expanded = new Set()) {
  nodes.forEach((node) => {
    if (node.children?.length && depth < 2) {
      expanded.add(node.id)
      collectDefaultExpandedIds(node.children, depth + 1, expanded)
    }
  })
  return expanded
}

function collectExpandedPath(nodes, activeFolderId, expanded = new Set()) {
  nodes.forEach((node) => {
    if (folderContainsActive(node, activeFolderId)) {
      expanded.add(node.id)
      if (node.children?.length) {
        collectExpandedPath(node.children, activeFolderId, expanded)
      }
    }
  })
  return expanded
}

function SidebarTree({ nodes, activeFolderId, onOpenFolder, onDeleteFolder, onFolderContextMenu, expandedIds, onToggleExpand }) {
  return (
    <ul className="tree-list" role="tree">
      {nodes.map((node) => {
        const hasChildren = Boolean(node.children?.length)
        const isExpanded = expandedIds.has(node.id)
        const isSelected = node.id === activeFolderId
        const isAncestor = isAncestorOfActive(node, activeFolderId)
        const canDelete = node.parentId != null && !isProtectedArchiveStructureFolder(node)

        return (
          <li key={node.id} className="tree-item" role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}>
            <div
              className={`tree-item-row ${isSelected ? 'selected' : ''} ${isAncestor ? 'ancestor' : ''}`}
              onContextMenu={(event) => {
                event.preventDefault()
                onFolderContextMenu?.(event, node)
              }}
            >
              <button
                type="button"
                className={`tree-toggle ${hasChildren ? '' : 'tree-toggle-spacer'}`}
                onClick={hasChildren ? () => onToggleExpand(node.id) : undefined}
                tabIndex={hasChildren ? 0 : -1}
                aria-label={hasChildren ? (isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`) : undefined}
                aria-hidden={!hasChildren}
              >
                {hasChildren ? (
                  <ChevronRightIcon className={`icon tiny tree-chevron ${isExpanded ? 'expanded' : ''}`} />
                ) : null}
              </button>
              <button
                type="button"
                className="tree-label-btn"
                onClick={() => onOpenFolder?.(node.id)}
                title={`Open ${node.name}`}
              >
                <FolderIcon className="icon folder tree-folder" />
                <span className="tree-label">{node.name}</span>
              </button>
              <span className="tree-count">{node.itemCount ?? 0}</span>
              {canDelete ? (
                <button
                  type="button"
                  className="tree-delete-btn"
                  aria-label={`Delete ${node.name}`}
                  title="Delete folder"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDeleteFolder?.(node)
                  }}
                >
                  <TrashIcon className="icon tiny" />
                </button>
              ) : null}
            </div>
            {hasChildren && isExpanded ? (
              <div className="tree-children">
                <SidebarTree
                  nodes={node.children}
                  activeFolderId={activeFolderId}
                  onOpenFolder={onOpenFolder}
                  onDeleteFolder={onDeleteFolder}
                  onFolderContextMenu={onFolderContextMenu}
                  expandedIds={expandedIds}
                  onToggleExpand={onToggleExpand}
                />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function ArchiveTreePanel({
  nodes,
  activeFolderId,
  onOpenFolder,
  onDeleteFolder,
  onFolderContextMenu,
  onAddFolder,
  allowAddFolder = true,
  treeFilter,
  onTreeFilterChange,
  treeFilterOpen,
  onToggleTreeFilter
}) {
  const [expandedIds, setExpandedIds] = useState(() => collectDefaultExpandedIds(nodes))
  const visibleNodes = filterTreeNodes(nodes, treeFilter)

  useEffect(() => {
    if (treeFilter.trim()) {
      setExpandedIds(collectDefaultExpandedIds(filterTreeNodes(nodes, treeFilter), 0, new Set()))
    }
  }, [treeFilter, nodes])

  useEffect(() => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (activeFolderId) {
        collectExpandedPath(nodes, activeFolderId, next)
      } else if (!next.size) {
        collectDefaultExpandedIds(nodes, 0, next)
      }
      return next
    })
  }, [nodes, activeFolderId])

  const onToggleExpand = useCallback((folderId) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }, [])

  return (
    <div className="sidebar-section archive-tree">
      <div className="section-head archive-tree-head">
        <p className="eyebrow">Archive Tree</p>
        <div className="section-actions">
          {allowAddFolder ? (
          <button type="button" className="ghost-icon" aria-label="Add folder" onClick={onAddFolder}>
            <FolderPlusIcon className="icon" />
          </button>
          ) : null}
          <button
            type="button"
            className={`ghost-icon ${treeFilterOpen ? 'active' : ''}`}
            aria-label="Filter folders"
            aria-pressed={treeFilterOpen}
            onClick={onToggleTreeFilter}
          >
            <FilterIcon className="icon" />
          </button>
        </div>
      </div>
      {treeFilterOpen ? (
        <div className="archive-tree-filter">
          <input
            value={treeFilter}
            onChange={(event) => onTreeFilterChange?.(event.target.value)}
            placeholder="Filter folders..."
            aria-label="Filter folders"
          />
        </div>
      ) : null}
      <div className="archive-tree-scroll">
        <SidebarTree
          nodes={visibleNodes}
          activeFolderId={activeFolderId}
          onOpenFolder={onOpenFolder}
          onDeleteFolder={onDeleteFolder}
          onFolderContextMenu={onFolderContextMenu}
          expandedIds={expandedIds}
          onToggleExpand={onToggleExpand}
        />
      </div>
    </div>
  )
}

function getRouteFromHash() {
  if (typeof window === 'undefined') {
    return { view: 'dashboard', folderId: null }
  }

  const hash = window.location.hash || ''
  const folderMatch = hash.match(/^#\/folders\/(\d+)$/)
  if (folderMatch) {
    return {
      view: 'folder',
      folderId: Number(folderMatch[1])
    }
  }

  return { view: 'dashboard', folderId: null }
}

function navigateToHash(path) {
  if (typeof window === 'undefined') {
    return
  }
  window.location.hash = path
}

function ActivityDot({ category }) {
  const tone = String(category || '').toUpperCase()
  return <span className={`activity-dot ${tone.toLowerCase()}`} />
}

function LoginScreen({ form, onChange, onSubmit, busy, error }) {
  const [showPassword, setShowPassword] = useState(false)
  const [forgotNotice, setForgotNotice] = useState('')

  return (
    <div className="auth-landing auca-theme">
      <section className="auth-landing-left">
        <div className="auth-landing-content">
          <header className="auth-uni-brand">
            <img src="/auca-logo.jpg" alt="AUCA Logo" className="auth-uni-logo" />
            <div className="auth-uni-copy">
              <span>ADVENTIST UNIVERSITY</span>
              <span>OF CENTRAL AFRICA</span>
            </div>
          </header>

          <form className="auth-portal-form" onSubmit={onSubmit}>
            <h1>Login</h1>
            <p className="auth-portal-lead">Welcome! Please enter your details.</p>

            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="auth-username">
                Student ID / Teach Code
              </label>
              <div className="auth-input-shell">
                <input
                  id="auth-username"
                  value={form.username}
                  onChange={(event) => onChange({ ...form, username: event.target.value })}
                  placeholder="25883"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="auth-password">
                Password
              </label>
              <div className="auth-input-shell">
                <input
                  id="auth-password"
                  type="password"
                  value={form.password}
                  onChange={(event) => onChange({ ...form, password: event.target.value })}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="auth-options">
              <button
                type="button"
                className="auth-forgot-link"
                onClick={() => setForgotNotice('Please contact administration to reset your password.')}
              >
                Forgot password
              </button>
            </div>

            {error ? <div className="auth-error" role="alert">{error}</div> : null}
            {forgotNotice ? <div className="auth-forgot-note" role="status">{forgotNotice}</div> : null}

            <div className="auth-submit-container">
              <button className="auth-portal-btn" type="submit" disabled={busy}>
                {busy ? 'Signing In...' : 'Sign In'}
              </button>
            </div>


          </form>
        </div>
      </section>

      <section className="auth-landing-right" aria-hidden="true">
        <img src="/auca-campus.png" alt="" className="auth-campus-photo" />
      </section>
    </div>
  )
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  inputLabel,
  inputPlaceholder,
  inputValue,
  onInputChange,
  selectLabel,
  selectOptions,
  selectValue,
  onSelectChange,
  onConfirm,
  onCancel,
  busy
}) {
  if (!open) {
    return null
  }

  return (
    <div className="modal-backdrop confirm-backdrop" onClick={busy ? undefined : onCancel} role="presentation">
      <div
        className="modal confirm-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">Please confirm</p>
            <h2 id="confirm-dialog-title">{title}</h2>
          </div>
        </div>
        <p className="confirm-message">{message}</p>
        {inputLabel ? (
          <label className="confirm-input-label">
            <span>{inputLabel}</span>
            <input
              value={inputValue || ''}
              onChange={(event) => onInputChange?.(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !busy) {
                  event.preventDefault()
                  onConfirm?.(inputValue)
                }
              }}
              placeholder={inputPlaceholder}
              autoFocus
            />
          </label>
        ) : null}
        {selectLabel ? (
          <label className="confirm-input-label">
            <span>{selectLabel}</span>
            <select value={selectValue || ''} onChange={(event) => onSelectChange?.(event.target.value)} autoFocus={!inputLabel}>
              {(selectOptions || []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'danger-btn' : 'primary-btn'}
            onClick={() => onConfirm?.(inputLabel ? inputValue : selectLabel ? selectValue : undefined)}
            disabled={busy || (inputLabel ? !String(inputValue || '').trim() : false) || (selectLabel ? !String(selectValue || '').trim() : false)}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function FolderContextMenu({
  open,
  x,
  y,
  folder,
  clipboard,
  userRole,
  studentNumber,
  onRename,
  onCopy,
  onPaste,
  onMove,
  onClose
}) {
  if (!open || !folder) {
    return null
  }

  const manageable = canManageFolder(folder, userRole, studentNumber)
  const pasteTarget = canPasteIntoFolder(folder, userRole, studentNumber)
  const canPaste = Boolean(clipboard && pasteTarget && clipboard.folderId !== folder.id)
  const pasteLabel = clipboard?.mode === 'move'
    ? `Move "${clipboard.folderName}" here`
    : `Paste "${clipboard?.folderName}" here`

  if (!manageable && !canPaste) {
    return null
  }

  return (
    <div
      className="folder-context-menu"
      style={{ top: `${y}px`, left: `${x}px` }}
      role="menu"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {manageable ? (
        <>
          <button type="button" role="menuitem" onClick={() => { onRename?.(folder); onClose?.() }}>Rename</button>
          <button type="button" role="menuitem" onClick={() => { onCopy?.(folder); onClose?.() }}>Copy</button>
          <button type="button" role="menuitem" onClick={() => { onMove?.(folder); onClose?.() }}>Move</button>
        </>
      ) : null}
      {canPaste ? (
        <button type="button" role="menuitem" onClick={() => { onPaste?.(folder); onClose?.() }}>{pasteLabel}</button>
      ) : null}
    </div>
  )
}

function ExplorerStatusBadge({ status }) {
  const normalized = String(status || '').toUpperCase()
  const label = normalized || 'UNKNOWN'
  return <span className={`explorer-status ${normalized.toLowerCase()}`}>{label}</span>
}

function FolderView({
  folder,
  loading,
  error,
  userRole,
  studentNumber,
  onOpenFolder,
  onUpload,
  onRefresh,
  onFolderContextMenu,
  onGoBack,
  onGoForward,
  onGoUp,
  canGoBack,
  canGoForward,
  canGoUp,
  onOpenSearch,
  onNotify,
  onDataChange,
  onArchivedChange
}) {
  const [viewMode, setViewMode] = useState('grid')
  const [sortBy, setSortBy] = useState('modified')
  const [filterType, setFilterType] = useState('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedFolderIds, setSelectedFolderIds] = useState(() => new Set())
  const [selectedDocumentIds, setSelectedDocumentIds] = useState(() => new Set())
  const [confirmState, setConfirmState] = useState(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [openingDocumentId, setOpeningDocumentId] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareTargetRole, setShareTargetRole] = useState('')
  const [shareBusy, setShareBusy] = useState(false)
  const shareDestinations = getShareDestinations(userRole)
  const isStudent = userRole === 'STUDENT'
  const canCreateFolder = isStudent
    ? canStudentCreateInFolder(folder, studentNumber)
    : canStaffCreateArchiveSubfolder(folder, userRole)

  useEffect(() => {
    setSelectedFolderIds(new Set())
    setSelectedDocumentIds(new Set())
    setFilterOpen(false)
  }, [folder?.id])

  function closeConfirm() {
    if (confirmBusy) {
      return
    }
    setConfirmState(null)
    setNewFolderName('')
  }

  function openConfirm(config) {
    setConfirmState(config)
  }

  function toggleFolderSelection(folderId) {
    setSelectedFolderIds((current) => {
      const next = new Set(current)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  function toggleDocumentSelection(documentId) {
    setSelectedDocumentIds((current) => {
      const next = new Set(current)
      if (next.has(documentId)) {
        next.delete(documentId)
      } else {
        next.add(documentId)
      }
      return next
    })
  }

  async function handleOpenDocument(documentItem) {
    if (!documentItem?.id || openingDocumentId) {
      return
    }

    setOpeningDocumentId(documentItem.id)
    try {
      const result = await openDocument(documentItem.id)
      if (result?.mode === 'download') {
        onNotify?.(`Downloading ${result.filename}...`)
      }
    } catch (err) {
      onNotify?.(err.message || 'Unable to open document.')
    } finally {
      setOpeningDocumentId(null)
    }
  }

  function handleDocumentClick(event, documentItem) {
    if (event.ctrlKey || event.metaKey) {
      toggleDocumentSelection(documentItem.id)
      return
    }
    handleOpenDocument(documentItem)
  }

  function handleDocumentKeyDown(event, documentItem) {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleOpenDocument(documentItem)
    }
  }

  function getSelectedDocuments(allDocuments) {
    if (selectedDocumentIds.size) {
      return allDocuments.filter((document) => selectedDocumentIds.has(document.id))
    }
    return allDocuments
  }

  function getSelectedFolders(allChildren) {
    if (selectedFolderIds.size) {
      return allChildren.filter((child) => selectedFolderIds.has(child.id))
    }
    return []
  }

  async function runConfirmAction(action) {
    setConfirmBusy(true)
    try {
      await action()
      closeConfirm()
    } catch (err) {
      onNotify?.(err.message || 'Action failed.')
    } finally {
      setConfirmBusy(false)
    }
  }

  if (loading) {
    return (
      <section className="explorer-page explorer-page-loading">
        <div className="explorer-panel">
          <p className="eyebrow">Archive explorer</p>
          <h2>Loading folder...</h2>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="explorer-page explorer-page-error">
        <div className="banner warning">{error}</div>
      </section>
    )
  }

  if (!folder) {
    return (
      <section className="explorer-page explorer-page-empty">
        <div className="explorer-panel">
          <p className="eyebrow">Archive explorer</p>
          <h2>Select a folder</h2>
          <p>Use the archive tree on the left to browse folders.</p>
        </div>
      </section>
    )
  }

  const children = [...(folder.children || [])].sort((left, right) => {
    if (sortBy === 'name') {
      return String(left.name || '').localeCompare(String(right.name || ''))
    }
    return Number(right.itemCount || 0) - Number(left.itemCount || 0)
  })

  const documents = [...(folder.documents || [])].sort((left, right) => {
    if (sortBy === 'name') {
      return String(left.fileName || left.title || '').localeCompare(String(right.fileName || right.title || ''))
    }
    const leftTime = left.modifiedAt ? new Date(left.modifiedAt).getTime() : 0
    const rightTime = right.modifiedAt ? new Date(right.modifiedAt).getTime() : 0
    return rightTime - leftTime
  })

  const visibleChildren = filterType === 'documents' || filterType === 'approved' || filterType === 'pending'
    ? []
    : children
  const visibleDocuments = documents.filter((document) => {
    if (filterType === 'folders') {
      return false
    }
    if (filterType === 'approved') {
      return String(document.status || '').toUpperCase() === 'APPROVED'
    }
    if (filterType === 'pending') {
      return String(document.status || '').toUpperCase() === 'PENDING'
    }
    return true
  })

  const breadcrumbs = folder.breadcrumbs || []
  const isEmpty = !visibleChildren.length && !visibleDocuments.length
  const selectedDocuments = getSelectedDocuments(documents)
  const selectedFolders = getSelectedFolders(children)
  const selectionCount = selectedFolderIds.size + selectedDocumentIds.size
  const sortLabel = sortBy === 'name' ? 'Sort: Name' : 'Sort: Modified'

  function handleNewFolderClick() {
    setNewFolderName('')
    openConfirm({
      title: 'Create new folder',
      message: isStudent
        ? `Create a personal folder inside "${folder.name}" for your project files?`
        : `Create a subfolder inside "${folder.name}"?`,
      confirmLabel: 'Create folder',
      inputLabel: 'Folder name',
      inputPlaceholder: 'Enter folder name',
      onConfirm: async (folderName) => {
        const trimmedName = String(folderName || '').trim()
        if (!trimmedName) {
          throw new Error('Please enter a folder name.')
        }
        await createSubfolder(folder.id, trimmedName)
        onNotify?.(`Folder "${trimmedName}" created.`)
        await onDataChange?.()
      }
    })
  }

  function handleUploadClick() {
    openConfirm({
      title: 'Upload document',
      message: `Upload a new document to "${folder.name}"?`,
      confirmLabel: 'Continue to upload',
      onConfirm: async () => {
        onUpload?.()
      }
    })
  }

  function handleDownloadClick() {
    const targets = selectedDocuments
    if (!targets.length) {
      if (!documents.length) {
        onNotify?.('There are no documents to download in this folder.')
        return
      }
      openConfirm({
        title: 'Download folder',
        message: `Download all ${documents.length} document${documents.length === 1 ? '' : 's'} in "${folder.name}" as a ZIP file?`,
        confirmLabel: 'Download ZIP',
        onConfirm: async () => {
          await downloadFolderZip(folder.id)
          onNotify?.(`Downloaded ${documents.length} document${documents.length === 1 ? '' : 's'} as ZIP.`)
        }
      })
      return
    }

    openConfirm({
      title: 'Download selection',
      message: `Download ${targets.length} selected document${targets.length === 1 ? '' : 's'} as a ZIP file?`,
      confirmLabel: 'Download ZIP',
      onConfirm: async () => {
        await downloadFolderZip(folder.id, targets.map((document) => document.id))
        onNotify?.(`Downloaded ${targets.length} document${targets.length === 1 ? '' : 's'} as ZIP.`)
      }
    })
  }

  function handleShareClick() {
    if (!shareDestinations.length) {
      onNotify?.('No share destinations are available for your role.')
      return
    }
    setShareTargetRole(shareDestinations[0]?.value || '')
    setShareOpen(true)
  }

  async function handleShareConfirm() {
    if (!shareTargetRole) {
      onNotify?.('Choose a role to share with.')
      return
    }
    setShareBusy(true)
    try {
      const result = await shareFolder(folder.id, shareTargetRole)
      const shareUrl = typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}${result.shareUrl || `#/folders/${folder.id}`}`
        : result.shareUrl
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
      }
      setShareOpen(false)
      onNotify?.(result.message || `Shared with ${result.targetRoleLabel}. Link copied to clipboard.`)
      await onDataChange?.()
    } catch (err) {
      onNotify?.(err.message || 'Unable to share this folder.')
    } finally {
      setShareBusy(false)
    }
  }

  function handleDeleteClick() {
    if (!selectionCount) {
      onNotify?.('Select folders or documents to delete.')
      return
    }

    openConfirm({
      title: 'Move to archive',
      message: `Move ${selectedDocumentIds.size} document${selectedDocumentIds.size === 1 ? '' : 's'}${selectedFolderIds.size ? ` and ${selectedFolderIds.size} folder${selectedFolderIds.size === 1 ? '' : 's'}` : ''} to archive? Files stay stored until an administrator confirms permanent deletion.`,
      confirmLabel: 'Move to archive',
      tone: 'danger',
      onConfirm: async () => {
        for (const document of selectedDocuments.filter((item) => selectedDocumentIds.has(item.id))) {
          await deleteDocument(document.id)
        }
        for (const child of selectedFolders) {
          if (isProtectedArchiveStructureFolder(child)) {
            throw new Error('Faculty and department folders are part of the system structure and cannot be deleted.')
          }
          await deleteFolder(child.id)
        }
        setSelectedFolderIds(new Set())
        setSelectedDocumentIds(new Set())
        onNotify?.('Selected items moved to archive.')
        onArchivedChange?.()
        await onDataChange?.()
      }
    })
  }

  function handleFilterClick() {
    openConfirm({
      title: 'Filter folder view',
      message: 'Choose what to show in this folder. You can change the filter below after confirming.',
      confirmLabel: 'Show filters',
      onConfirm: async () => {
        setFilterOpen(true)
      }
    })
  }

  function handleSortClick() {
    const nextSort = sortBy === 'modified' ? 'name' : 'modified'
    openConfirm({
      title: 'Change sort order',
      message: nextSort === 'name'
        ? 'Sort items alphabetically by name?'
        : 'Sort items by last modified date?',
      confirmLabel: nextSort === 'name' ? 'Sort by name' : 'Sort by modified',
      onConfirm: async () => {
        setSortBy(nextSort)
        onNotify?.(nextSort === 'name' ? 'Sorted by name.' : 'Sorted by last modified.')
      }
    })
  }

  return (
    <section className="explorer-page">
      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={confirmState?.confirmLabel}
        tone={confirmState?.tone}
        inputLabel={confirmState?.inputLabel}
        inputPlaceholder={confirmState?.inputPlaceholder}
        inputValue={newFolderName}
        onInputChange={setNewFolderName}
        busy={confirmBusy}
        onCancel={closeConfirm}
        onConfirm={(submittedValue) => runConfirmAction(() => confirmState?.onConfirm?.(submittedValue))}
      />

      {shareOpen ? (
        <div className="modal-backdrop" onClick={shareBusy ? undefined : () => setShareOpen(false)} role="presentation">
          <div className="modal share-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Share folder</p>
                <h2>{folder.name}</h2>
              </div>
              <button type="button" className="ghost-icon" onClick={() => setShareOpen(false)} disabled={shareBusy}>
                <XIcon className="icon" />
              </button>
            </div>
            <p className="share-modal-lead">Choose who should receive access to this folder in their workspace.</p>
            <div className="share-role-options">
              {shareDestinations.map((destination) => (
                <label key={destination.value} className={`share-role-option ${shareTargetRole === destination.value ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="share-target-role"
                    value={destination.value}
                    checked={shareTargetRole === destination.value}
                    onChange={() => setShareTargetRole(destination.value)}
                  />
                  <span>{destination.label}</span>
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setShareOpen(false)} disabled={shareBusy}>Cancel</button>
              <button type="button" className="primary-btn" onClick={handleShareConfirm} disabled={shareBusy || !shareTargetRole}>
                {shareBusy ? 'Sharing...' : 'Share and copy link'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="explorer-address-bar">
        <div className="explorer-nav-controls">
          <button type="button" className="explorer-icon-btn" onClick={onGoBack} disabled={!canGoBack} aria-label="Back">
            <ChevronLeftIcon className="icon" />
          </button>
          <button type="button" className="explorer-icon-btn" onClick={onGoForward} disabled={!canGoForward} aria-label="Forward">
            <ChevronRightIcon className="icon" />
          </button>
          <button type="button" className="explorer-icon-btn" onClick={onGoUp} disabled={!canGoUp} aria-label="Up">
            <ArrowUpIcon className="icon" />
          </button>
          <button type="button" className="explorer-icon-btn" onClick={onRefresh} aria-label="Refresh">
            <RefreshIcon className="icon" />
          </button>
        </div>
        <div className="explorer-breadcrumbs">
          <span>Archive</span>
          <ChevronRightIcon className="icon tiny" />
          {breadcrumbs.length ? breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1
            return (
              <React.Fragment key={crumb.id}>
                {index > 0 ? <ChevronRightIcon className="icon tiny" /> : null}
                {isLast ? (
                  <strong>{crumb.name}</strong>
                ) : (
                  <button type="button" className="crumb-link" onClick={() => onOpenFolder?.(crumb.id)}>
                    {crumb.name}
                  </button>
                )}
              </React.Fragment>
            )
          }) : (
            <strong>{folder.name}</strong>
          )}
        </div>
      </div>

      <div className="explorer-toolbar">
        <div className="explorer-toolbar-actions">
          {canCreateFolder ? (
          <button type="button" className="ghost-btn explorer-tool-btn" onClick={handleNewFolderClick}>
            <FolderPlusIcon className="icon" />
            New folder
          </button>
          ) : null}
          <button type="button" className="primary-btn explorer-tool-btn" onClick={handleUploadClick}>
            <UploadIcon className="icon" />
            Upload
          </button>
          <button type="button" className="ghost-btn explorer-tool-btn" onClick={handleDownloadClick}>
            <DownloadIcon className="icon" />
            Download
          </button>
          {!isStudent ? (
          <button type="button" className="ghost-btn explorer-tool-btn" onClick={handleShareClick}>
            <ShareIcon className="icon" />
            Share
          </button>
          ) : null}
          {!isStudent ? (
          <button type="button" className="ghost-btn explorer-tool-btn" onClick={handleDeleteClick}>
            <TrashIcon className="icon" />
            Delete
          </button>
          ) : null}
          <button type="button" className="ghost-btn explorer-tool-btn" onClick={handleFilterClick}>
            <FilterIcon className="icon" />
            Filter
          </button>
          <button type="button" className="ghost-btn explorer-tool-btn" onClick={handleSortClick}>
            {sortLabel}
          </button>
        </div>
        <div className="explorer-view-toggle">
          <button type="button" className="explorer-icon-btn" onClick={onOpenSearch} aria-label="Search archive">
            <SearchIcon className="icon" />
          </button>
          <button
            type="button"
            className={`explorer-icon-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
          >
            <GridIcon className="icon" />
          </button>
          <button
            type="button"
            className={`explorer-icon-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            aria-label="List view"
          >
            <ListIcon className="icon" />
          </button>
        </div>
      </div>

      {filterOpen ? (
        <div className="explorer-filter-bar">
          {[
            { value: 'all', label: 'All items' },
            { value: 'folders', label: 'Folders only' },
            { value: 'documents', label: 'Documents only' },
            { value: 'approved', label: 'Approved' },
            { value: 'pending', label: 'Pending' }
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              className={`explorer-filter-chip ${filterType === option.value ? 'active' : ''}`}
              onClick={() => setFilterType(option.value)}
            >
              {option.label}
            </button>
          ))}
          <button type="button" className="explorer-filter-close" onClick={() => setFilterOpen(false)}>
            Close
          </button>
        </div>
      ) : null}

      {selectionCount ? (
        <p className="explorer-selection-note">{selectionCount} item{selectionCount === 1 ? '' : 's'} selected</p>
      ) : visibleDocuments.length ? (
        <p className="explorer-hint">
          Click a document to open it. Right-click folders to rename, copy, move, or paste. <kbd>Ctrl</kbd>+click to select items for download or delete.
        </p>
      ) : null}

      <div
        className={`explorer-content ${viewMode === 'list' ? 'list-view' : 'grid-view'}`}
        onContextMenu={(event) => {
          if (!onFolderContextMenu || !folder) {
            return
          }
          event.preventDefault()
          onFolderContextMenu(event, {
            id: folder.id,
            name: folder.name,
            code: folder.code,
            parentId: folder.parentId
          })
        }}
      >
        {visibleChildren.map((child) => (
          <button
            key={child.id}
            type="button"
            className={`explorer-item explorer-folder ${selectedFolderIds.has(child.id) ? 'selected' : ''}`}
            onClick={() => toggleFolderSelection(child.id)}
            onDoubleClick={() => onOpenFolder?.(child.id)}
            onContextMenu={(event) => {
              event.preventDefault()
              onFolderContextMenu?.(event, child)
            }}
          >
            <div className="explorer-item-icon folder">
              <FolderIcon className="icon" />
            </div>
            <div className="explorer-item-copy">
              <strong>{child.name}</strong>
              <span>{child.itemCount ?? 0} items</span>
            </div>
          </button>
        ))}

        {visibleDocuments.map((document) => (
          <div
            key={document.id}
            role="button"
            tabIndex={0}
            className={`explorer-item explorer-file ${selectedDocumentIds.has(document.id) ? 'selected' : ''} ${openingDocumentId === document.id ? 'opening' : ''}`}
            onClick={(event) => handleDocumentClick(event, document)}
            onKeyDown={(event) => handleDocumentKeyDown(event, document)}
            title="Click to open. Ctrl+click to select."
          >
            <ExplorerStatusBadge status={document.status} />
            <div className="explorer-item-icon file">
              <DocumentIcon className="icon" />
            </div>
            <div className="explorer-item-copy">
              <strong>{document.fileName || document.title}</strong>
              <span>{formatBytes(document.sizeBytes)}</span>
            </div>
          </div>
        ))}

        {isEmpty ? (
          <div className="explorer-empty">
            <FolderIcon className="icon folder" />
            <strong>{filterType === 'all' ? 'This folder is empty' : 'No items match this filter'}</strong>
            <span>Upload a document or create a subfolder to get started.</span>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function looksLikeStudentId(query) {
  const trimmed = String(query || '').trim()
  if (!trimmed || trimmed.length < 3) {
    return false
  }
  return /[\d]/.test(trimmed) && /^[\w./-]+$/.test(trimmed)
}

function GlobalSearchResults({ query, busy, results, studentProfile, onOpenDocument, onOpenFolder, onClear }) {
  if (!query) {
    return null
  }

  return (
    <section className="dash-panel global-search-panel">
      <div className="dash-panel-head">
        <div>
          <h2>Archive search</h2>
          <p>
            {busy
              ? 'Searching across departments...'
              : studentProfile
                ? `${studentProfile.documentCount} document${studentProfile.documentCount === 1 ? '' : 's'} for ${studentProfile.studentName || studentProfile.studentNumber}`
                : `${results?.length || 0} match${results?.length === 1 ? '' : 'es'} for "${query}" across the archive`}
          </p>
        </div>
        {onClear ? (
          <button type="button" className="ghost-btn" onClick={onClear}>
            Clear
          </button>
        ) : null}
      </div>
      <div className="table-shell dash-table-shell">
        <table className="dash-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Student</th>
              <th>Category</th>
              <th>Location</th>
              <th>Modified</th>
            </tr>
          </thead>
          <tbody>
            {busy ? (
              <tr>
                <td colSpan="5" className="empty-state">Searching...</td>
              </tr>
            ) : results?.length ? (
              results.map((fileRow) => (
                <tr
                  key={fileRow.id}
                  className="document-row"
                  onClick={() => {
                    if (fileRow.folderId) {
                      onOpenFolder?.(fileRow.folderId)
                    } else if (fileRow.kind !== 'folder') {
                      onOpenDocument?.(fileRow.id)
                    }
                  }}
                  title={fileRow.folderId ? 'Open archive location' : 'Open document'}
                >
                  <td>
                    <div className="file-cell">
                      {fileRow.kind === 'folder' ? (
                        <FolderIcon className="icon folder" />
                      ) : (
                        <DocumentIcon className="icon doc" />
                      )}
                      <div>
                        <strong>{fileRow.title}</strong>
                        <span>{fileRow.fileName}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {fileRow.studentNumber ? (
                      <>
                        <button
                          type="button"
                          className="lookup-link-btn"
                          onClick={(event) => {
                            event.stopPropagation()
                            if (studentProfile?.folderId) {
                              onOpenFolder?.(studentProfile.folderId)
                            } else if (fileRow.folderId) {
                              onOpenFolder?.(fileRow.folderId)
                            }
                          }}
                          title="Open archive location"
                        >
                          <strong>{fileRow.studentNumber}</strong>
                        </button>
                        <span className="muted-cell">{fileRow.ownerName || '-'}</span>
                      </>
                    ) : (
                      <span className="muted-cell">{fileRow.kind === 'folder' ? 'Folder' : (fileRow.ownerName || '-')}</span>
                    )}
                  </td>
                  <td>
                    <span className="document-chip">
                      {fileRow.kind === 'folder' ? 'Folder' : getCategoryMeta(fileRow.category).label}
                    </span>
                  </td>
                  <td>
                    <span className="search-location-path" title={fileRow.location || fileRow.department || ''}>
                      {fileRow.location || fileRow.department || '-'}
                    </span>
                  </td>
                  <td>{fileRow.kind === 'folder' ? '-' : formatDateTime(fileRow.modifiedAt || fileRow.issueDate)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="empty-state">No matching folders or documents found under departments.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function App() {
  const [session, setSession] = useState(loadStoredSession)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  })
  const [dashboard, setDashboard] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const mainSearchInputRef = useRef(null)
  const deferredQuery = useDeferredValue(searchQuery.trim())
  const [searchResults, setSearchResults] = useState(null)
  const [searchBusy, setSearchBusy] = useState(false)
  const [studentSearchProfile, setStudentSearchProfile] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [scanBusy, setScanBusy] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [scanError, setScanError] = useState('')
  const [dashboardView, setDashboardView] = useState('default')
  const [treeFilterOpen, setTreeFilterOpen] = useState(false)
  const [treeFilter, setTreeFilter] = useState('')
  const [quickAccessOpen, setQuickAccessOpen] = useState(loadQuickAccessOpen)
  const [adminOffices, setAdminOffices] = useState([])
  const [selectedAdminOffice, setSelectedAdminOffice] = useState(null)
  const [adminOfficesBusy, setAdminOfficesBusy] = useState(false)
  const [archiveItems, setArchiveItems] = useState([])
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [archiveRevision, setArchiveRevision] = useState(0)
  const [appConfirm, setAppConfirm] = useState(null)
  const [appConfirmBusy, setAppConfirmBusy] = useState(false)
  const [appConfirmInput, setAppConfirmInput] = useState('')
  const [appConfirmSelect, setAppConfirmSelect] = useState('')
  const [folderClipboard, setFolderClipboard] = useState(null)
  const [folderContextMenu, setFolderContextMenu] = useState(null)
  const [notice, setNotice] = useState('')
  const noticeTimerRef = useRef(null)

  const showNotice = useCallback((message) => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current)
      noticeTimerRef.current = null
    }
    if (!message) {
      setNotice('')
      return
    }
    setNotice(message)
    noticeTimerRef.current = setTimeout(() => {
      setNotice('')
      noticeTimerRef.current = null
    }, 2000)
  }, [])

  useEffect(() => () => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!folderContextMenu) {
      return undefined
    }
    const closeMenu = () => setFolderContextMenu(null)
    window.addEventListener('click', closeMenu)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [folderContextMenu])

  const [studentLookupQuery, setStudentLookupQuery] = useState('')
  const [studentLookupResult, setStudentLookupResult] = useState(null)
  const [studentLookupBusy, setStudentLookupBusy] = useState(false)
  const [studentLookupError, setStudentLookupError] = useState('')
  const [studentLookupInfo, setStudentLookupInfo] = useState('')
  const [studentEntryMode, setStudentEntryMode] = useState('idle')
  const [activities, setActivities] = useState([])
  const [activitiesBusy, setActivitiesBusy] = useState(false)
  const [route, setRoute] = useState(getRouteFromHash)
  const [folderDetail, setFolderDetail] = useState(null)
  const [folderLoading, setFolderLoading] = useState(false)
  const [folderError, setFolderError] = useState('')
  const folderNavRef = useRef({ stack: [], index: -1, skip: false })
  const [, setFolderNavTick] = useState(0)

  const [form, setForm] = useState(buildDefaultUploadForm)
  const [file, setFile] = useState(null)
  const roleConfig = getRoleDashboardConfig(session?.role)
  const visibleDocumentCategories = getVisibleDocumentCategories(session?.role)
  const documentTypeLocked = visibleDocumentCategories.length === 1

  useEffect(() => {
    if (!session) {
      setDashboard(null)
      setError('')
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    async function load() {
      try {
        const data = await getDashboard()
        if (!active) return
        setDashboard(data)
        setError('')
      } catch (err) {
        if (!active) return
        setDashboard(emptyDashboard)
        setError('Dashboard data is unavailable until the API and database are reachable.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [session])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const syncRoute = () => setRoute(getRouteFromHash())
    syncRoute()
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  useEffect(() => {
    if (!session) {
      setForm(buildDefaultUploadForm())
      setFile(null)
      setScanResult(null)
      setScanError('')
      setScanBusy(false)
      setModalOpen(false)
      setSelectedCategory('')
      setSearchQuery('')
      setSearchResults(null)
      setStudentLookupQuery('')
      setStudentLookupResult(null)
      setStudentLookupBusy(false)
      setStudentLookupError('')
      setStudentLookupInfo('')
      setStudentEntryMode('idle')
      showNotice('')
      return
    }

    const resolvedUploadedBy = session.fullName || ''
    setForm((current) => ({
      ...current,
      uploadedBy: current.uploadedBy || resolvedUploadedBy,
      category: roleConfig.defaultCategory || current.category,
      studentNumber: session.role === 'STUDENT' ? (session.studentNumber || current.studentNumber) : current.studentNumber,
      studentName: session.role === 'STUDENT' ? (session.fullName || current.studentName) : current.studentName,
      faculty: session.role === 'STUDENT' ? (current.faculty || studentLookupResult?.faculty || '') : current.faculty,
      department: session.role === 'STUDENT' ? (current.department || studentLookupResult?.department || '') : current.department
    }))
  }, [roleConfig.defaultCategory, session, studentLookupResult])

  useEffect(() => {
    if (!session || session.role !== 'STUDENT' || !session.studentNumber) {
      return undefined
    }

    let active = true
    getStudentArchive(session.studentNumber)
      .then((profile) => {
        if (!active) return
        setStudentLookupResult(profile)
        setForm((current) => ({
          ...current,
          studentNumber: profile.studentNumber,
          studentName: profile.studentName,
          faculty: profile.faculty || current.faculty,
          department: profile.department || current.department
        }))
      })
      .catch(() => {
        if (!active) return
        setStudentLookupError('Unable to load your student profile.')
      })

    return () => {
      active = false
    }
  }, [session])

  useEffect(() => {
    if (!file || !modalOpen) {
      return undefined
    }

    let active = true
    setScanBusy(true)
    setScanError('')
    setScanResult(null)

    const context = {
      studentNumber: normalizeStudentId(form.studentNumber),
      studentName: String(form.studentName || '').trim(),
      category: form.category,
      course: String(form.course || '').trim(),
      faculty: String(form.faculty || '').trim(),
      department: String(form.department || '').trim()
    }

    scanDocument(file, context)
      .then((result) => {
        if (!active) return
        setScanResult(result)
        if (result.pageCount) {
          setForm((current) => ({ ...current, pageCount: result.pageCount }))
        }
      })
      .catch((err) => {
        if (!active) return
        setScanResult(null)
        setScanError(err.message || 'Unable to scan this document.')
      })
      .finally(() => {
        if (active) setScanBusy(false)
      })

    return () => {
      active = false
    }
  }, [
    file,
    modalOpen,
    form.studentNumber,
    form.studentName,
    form.category,
    form.course,
    form.faculty,
    form.department
  ])

  useEffect(() => {
    if (route.view !== 'folder') {
      setSearchQuery('')
    }
  }, [route.view])

  useEffect(() => {
    if (!session || route.view !== 'folder' || !route.folderId) {
      setFolderDetail(null)
      setFolderError('')
      setFolderLoading(false)
      return
    }

    let active = true
    setFolderLoading(true)
    setFolderError('')
    setFolderDetail(null)

    async function loadFolder() {
      try {
        const data = await getFolder(route.folderId)
        if (!active) return
        setFolderDetail(data)
      } catch (err) {
        if (!active) return
        setFolderDetail(null)
        setFolderError(err.message || 'Folder not found.')
      } finally {
        if (active) setFolderLoading(false)
      }
    }

    loadFolder()
    return () => {
      active = false
    }
  }, [route.folderId, route.view, session])

  useEffect(() => {
    if (route.view !== 'folder' || !route.folderId) {
      if (route.view === 'dashboard') {
        folderNavRef.current = { stack: [], index: -1, skip: false }
      }
      return
    }

    const nav = folderNavRef.current
    if (nav.skip) {
      nav.skip = false
      return
    }

    let { stack, index } = nav
    stack = stack.slice(0, index + 1)
    if (stack[stack.length - 1] !== route.folderId) {
      stack = [...stack, route.folderId]
      index = stack.length - 1
      folderNavRef.current = { stack, index, skip: false }
      setFolderNavTick((value) => value + 1)
    }
  }, [route.folderId, route.view])

  useEffect(() => {
    if (!session) {
      return
    }

    setSelectedCategory(roleConfig.defaultCategory)
  }, [roleConfig.defaultCategory, session])

  useEffect(() => {
    if (!session || session.role === 'ADMIN') {
      setActivities([])
      setActivitiesBusy(false)
      return
    }

    let active = true
    async function loadActivities() {
      setActivitiesBusy(true)
      try {
        const topic = dashboardView === 'default' && selectedCategory ? selectedCategory : ''
        const data = await getActivities(null, topic || undefined)
        if (active) {
          setActivities(data)
        }
      } catch {
        if (active) {
          setActivities(dashboard?.departmentActivity || [])
        }
      } finally {
        if (active) {
          setActivitiesBusy(false)
        }
      }
    }

    if (dashboardView !== 'archive') {
      loadActivities()
    }
    return () => {
      active = false
    }
  }, [session, selectedCategory, dashboardView, dashboard])

  useEffect(() => {
    if (!session || session.role !== 'ADMIN') {
      setAdminOffices([])
      setSelectedAdminOffice(null)
      setAdminOfficesBusy(false)
      return
    }

    let active = true
    async function loadAdminOffices(silent = false) {
      if (!silent) {
        setAdminOfficesBusy(true)
      }
      try {
        const adminData = await getAdminDashboard()
        if (!active) {
          return
        }
        const offices = buildAdminOffices(adminData?.users || [], adminData?.usersByRole || {})
        setAdminOffices(offices)
        setSelectedAdminOffice((current) => {
          if (!current) {
            return null
          }
          return offices.some((office) => office.role === current) ? current : null
        })
      } catch {
        if (active && !silent) {
          setAdminOffices([])
        }
      } finally {
        if (active) {
          setAdminOfficesBusy(false)
        }
      }
    }

    loadAdminOffices(false)
    const timer = window.setInterval(() => {
      loadAdminOffices(true)
    }, 20000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [session])

  useEffect(() => {
    if (!session || dashboardView !== 'archive') {
      setArchiveItems([])
      setArchiveBusy(false)
      return
    }

    let active = true
    async function loadArchive() {
      setArchiveBusy(true)
      try {
        const items = await getArchivedDocuments()
        if (active) {
          setArchiveItems(items)
        }
      } catch {
        if (active) {
          setArchiveItems([])
        }
      } finally {
        if (active) {
          setArchiveBusy(false)
        }
      }
    }
    loadArchive()
    return () => {
      active = false
    }
  }, [session, dashboardView, archiveRevision])

  useEffect(() => {
    if (!session) {
      setSearchResults(null)
      setStudentSearchProfile(null)
      setSearchBusy(false)
      return
    }

    if (!deferredQuery) {
      setSearchResults(null)
      setStudentSearchProfile(null)
      setSearchBusy(false)
      return
    }

    let active = true
    async function loadSearch() {
      setSearchBusy(true)
      try {
        const archiveTree = dashboard?.archiveTree || []
        const folderMatches = searchArchiveTreeMatches(archiveTree, deferredQuery)

        if (looksLikeStudentId(deferredQuery)) {
          try {
            const archive = await lookupStudent(deferredQuery)
            if (active && archive.found) {
              setStudentSearchProfile({
                studentNumber: archive.studentNumber,
                studentName: archive.studentName,
                faculty: archive.faculty,
                department: archive.department,
                documentCount: archive.documentCount,
                folderId: archive.folderId
              })
              const docs = enrichResultsWithLocation(archive.documents || [], archiveTree)
              setSearchResults([...folderMatches, ...docs])
            } else if (active) {
              setStudentSearchProfile(null)
            }
            if (active && archive.found) {
              return
            }
          } catch {
            if (active) {
              setStudentSearchProfile(null)
            }
          }
        } else if (active) {
          setStudentSearchProfile(null)
        }

        const data = await searchDocuments(deferredQuery)
        if (active) {
          const docs = enrichResultsWithLocation(data, archiveTree)
          const seenFolderIds = new Set(docs.map((row) => row.folderId).filter(Boolean))
          const uniqueFolders = folderMatches.filter((row) => !seenFolderIds.has(row.folderId))
          setSearchResults([...uniqueFolders, ...docs])
        }
      } catch {
        if (active) {
          const archiveTree = dashboard?.archiveTree || []
          setSearchResults(searchArchiveTreeMatches(archiveTree, deferredQuery))
          setStudentSearchProfile(null)
        }
      } finally {
        if (active) {
          setSearchBusy(false)
        }
      }
    }
    loadSearch()
    return () => {
      active = false
    }
  }, [deferredQuery, session, dashboard])

  function toggleQuickAccess() {
    setQuickAccessOpen((current) => {
      const next = !current
      try {
        window.localStorage.setItem(QUICK_ACCESS_OPEN_KEY, String(next))
      } catch {
        // ignore storage failures
      }
      return next
    })
  }

  async function handleLogin(event) {
    event.preventDefault()
    const username = loginForm.username.trim()
    const password = loginForm.password.trim()

    if (!username && !password) {
      setAuthError('Please enter your username and password.')
      return
    }
    if (!username) {
      setAuthError('Please enter your username.')
      return
    }
    if (!password) {
      setAuthError('Please enter your password.')
      return
    }

    setAuthBusy(true)
    setAuthError('')
    try {
      const account = await login(username, password)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(account))
      }
      setSession(account)
      setLoginForm({
        username: account.username || '',
        password: ''
      })
    } catch (err) {
      setAuthError(formatLoginError(err.message))
    } finally {
      setAuthBusy(false)
    }
  }

  function handleLogout() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_SESSION_KEY)
      window.location.hash = ''
    }
    setSession(null)
    setDashboard(null)
    setError('')
    showNotice('')
    setAuthError('')
    setAuthBusy(false)
    setLoginForm({
      username: '',
      password: ''
    })
    setForm(buildDefaultUploadForm())
    setSearchQuery('')
    setSearchResults(null)
    setStudentSearchProfile(null)
    setSelectedCategory('')
    setStudentLookupQuery('')
    setStudentLookupResult(null)
    setStudentLookupError('')
    setStudentLookupInfo('')
    setStudentEntryMode('idle')
    setLoading(false)
    setModalOpen(false)
    setFile(null)
    setScanResult(null)
    setScanError('')
    setScanBusy(false)
    setRoute({ view: 'dashboard', folderId: null })
    setFolderDetail(null)
    setFolderError('')
    setFolderLoading(false)
  }

  if (!session) {
    return (
      <LoginScreen
        form={loginForm}
        onChange={setLoginForm}
        onSubmit={handleLogin}
        busy={authBusy}
        error={authError}
      />
    )
  }

  const data = dashboard ?? emptyDashboard
  const dashboardLabel = roleConfig.dashboardTitle
  const departmentLabel = session.department || data.department || roleConfig.department
  const avatarLabel = getInitials(session.fullName || data.userName)
  const selectedCategoryMeta = selectedCategory && visibleDocumentCategories.some((category) => category.value === selectedCategory)
    ? getCategoryMeta(selectedCategory)
    : null
  const archiveList = archiveRevision >= 0 ? archiveItems : []
  const dashboardActivities = (activities.length ? activities : (data.departmentActivity || []))
    .filter((entry) => dashboardView !== 'recent' || isWithinDays(entry.createdAt, 7))
  const recentActivityCount = (activities.length ? activities : (data.departmentActivity || []))
    .filter((entry) => isWithinDays(entry.createdAt, 7)).length
  const storagePercent = data.storageLimitBytes
    ? Math.min(100, (data.storageUsedBytes / data.storageLimitBytes) * 100)
    : 0
  const isExamOfficer = session.role === 'EXAMINATION_OFFICER'
  const isStudent = session.role === 'STUDENT'
  const isRegistrar = session.role === 'REGISTRAR'
  const isHod = session.role === 'HOD'
  const isLibrarian = session.role === 'LIBRARIAN'
  const hideHeaderBrowse = isRegistrar || isExamOfficer || isHod || isLibrarian
  const isStaffUser = !isStudent
  const isFolderRoute = route.view === 'folder'
  const showStaffDashboardSearch = isStaffUser && !isFolderRoute
  const activeFolderId = isFolderRoute ? route.folderId : null
  const folderNav = folderNavRef.current
  const canGoBackFolder = folderNav.index > 0
  const canGoForwardFolder = folderNav.index < folderNav.stack.length - 1
  const canGoUpFolder = Boolean(folderDetail?.parentId)
  const studentNeedsProfile = studentEntryMode === 'new'
    || Boolean(studentLookupResult && (!studentLookupResult.faculty || !studentLookupResult.department))
  const selectedDepartmentOptions = getDepartmentOptions(form.faculty)
  const selectedExamTypeMeta = isExamOfficer ? getExamPaperTypeMeta(form.examType) : null
  const archiveSemesterOptions = semesterOptionsForAcademicYear(form.academicYear)
  const examTitlePreview = isExamOfficer
    ? buildExamTitle(form, studentLookupResult?.studentNumber || form.studentNumber)
    : getCategoryMeta(form.category).label

  async function handleDecision(taskId, decision) {
    try {
      let note = decision === 'approve' ? 'Approved by librarian' : ''
      if (decision === 'reject') {
        const feedback = window.prompt('Enter feedback for the student (required for rejection):')
        if (feedback == null) {
          return
        }
        note = String(feedback || '').trim()
        if (!note) {
          showNotice('Rejection feedback is required.')
          return
        }
      }
      await decideApproval(taskId, decision, note)
      showNotice(decision === 'approve'
        ? 'Project approved. It is now visible in the shared archive.'
        : 'Project rejected. Feedback was sent to the student.')
      const fresh = await getDashboard()
      setDashboard(fresh)
    } catch (err) {
      showNotice(err.message)
    }
  }

  async function lookupStudentArchive(studentNumber, { populateForm = false } = {}) {
    const trimmed = normalizeStudentId(studentNumber)
    if (!trimmed) {
      setStudentLookupError('Please enter a student ID first.')
      setStudentLookupInfo('')
      setStudentLookupResult(null)
      setStudentEntryMode('idle')
      return null
    }

    setStudentLookupBusy(true)
    try {
      const data = await lookupStudent(trimmed)
      if (!data.found) {
        const formatError = validateStudentIdForNewEntry(trimmed)
        setStudentLookupResult(null)
        setStudentLookupQuery(trimmed)
        setStudentEntryMode(formatError ? 'idle' : 'new')
        setStudentLookupError(formatError)
        setStudentLookupInfo(
          formatError
            ? ''
            : `No archive found for ${trimmed}. Enter the student name and select faculty/department below.`
        )
        if (populateForm) {
          if (formatError) {
            setForm((current) => ({
              ...current,
              studentNumber: trimmed,
              faculty: '',
              department: ''
            }))
          } else {
            setForm((current) => applyStudentIdDefaults({
              ...current,
              studentNumber: trimmed,
              faculty: '',
              department: ''
            }, trimmed))
          }
        }
        return null
      }

      const profile = {
        studentNumber: data.studentNumber || trimmed,
        studentName: data.studentName,
        faculty: data.faculty,
        department: data.department,
        folderId: data.folderId,
        documentCount: data.documentCount || 0,
        documents: data.documents || []
      }
      setStudentLookupResult(profile)
      setStudentLookupQuery(trimmed)
      setStudentEntryMode('existing')
      setStudentLookupError('')
      setStudentLookupInfo('')
      if (populateForm) {
        setForm((current) => applyStudentIdDefaults({
          ...current,
          studentNumber: profile.studentNumber,
          studentName: profile.studentName || current.studentName,
          faculty: profile.faculty || current.faculty || '',
          department: profile.department || current.department || ''
        }, profile.studentNumber))
      }
      return profile
    } catch (err) {
      setStudentLookupResult(null)
      setStudentEntryMode('idle')
      setStudentLookupInfo('')
      setStudentLookupError(err.message || 'Unable to look up this student ID.')
      return null
    } finally {
      setStudentLookupBusy(false)
    }
  }

  function navigateToDashboard() {
    navigateToHash('')
  }

  async function refreshDashboardView() {
    setSearchQuery('')
    setStudentLookupQuery('')
    setStudentLookupResult(null)
    setStudentLookupError('')
    setStudentLookupInfo('')
    setLoading(true)
    try {
      const fresh = await getDashboard()
      setDashboard(fresh)
      if (session.role !== 'ADMIN') {
        const topic = dashboardView === 'default' && selectedCategory ? selectedCategory : ''
        const activityData = await getActivities(null, topic || undefined)
        setActivities(activityData)
      }
      showNotice('Dashboard refreshed.')
    } catch (err) {
      showNotice(err.message || 'Unable to refresh dashboard.')
    } finally {
      setLoading(false)
    }
  }

  function handleArchivedChange() {
    setArchiveRevision((value) => value + 1)
  }

  async function handleRestoreArchived(documentId) {
    try {
      await restoreDocument(documentId)
      showNotice('Document restored from archive.')
      handleArchivedChange()
      const fresh = await getDashboard()
      setDashboard(fresh)
    } catch (err) {
      showNotice(err.message || 'Unable to restore document.')
    }
  }

  async function handlePermanentDelete(documentId) {
    try {
      await permanentlyDeleteDocument(documentId)
      showNotice('Document permanently deleted.')
      handleArchivedChange()
      const fresh = await getDashboard()
      setDashboard(fresh)
    } catch (err) {
      showNotice(err.message || 'Unable to permanently delete document.')
    }
  }

  function handleTreeDeleteFolder(folderNode) {
    if (isProtectedArchiveStructureFolder(folderNode)) {
      showNotice('Faculty and department folders are part of the system structure and cannot be deleted.')
      return
    }
    const itemCount = folderNode.itemCount ?? 0
    if (itemCount > 0) {
      setAppConfirmInput('')
      setAppConfirm({
        title: 'Folder contains items',
        message: `"${folderNode.name}" has ${itemCount} item${itemCount === 1 ? '' : 's'}. Open the folder and review or remove files before deleting it from the archive tree.`,
        confirmLabel: 'Open folder',
        cancelLabel: 'Close',
        onConfirm: async () => {
          openFolder(folderNode.id)
        }
      })
      return
    }

    setAppConfirmInput('')
    setAppConfirm({
      title: 'Delete folder',
      message: `Delete "${folderNode.name}" from the archive tree? This cannot be undone.`,
      confirmLabel: 'Delete folder',
      tone: 'danger',
      onConfirm: async () => {
        await deleteFolder(folderNode.id)
        if (activeFolderId === folderNode.id) {
          navigateToDashboard()
        } else if (isFolderRoute) {
          await reloadFolder()
        }
        const fresh = await getDashboard()
        setDashboard(fresh)
        showNotice(`Folder "${folderNode.name}" deleted.`)
      }
    })
  }

  function handleTreeAddFolder() {
    let parentId = activeFolderId
    let parentName = folderDetail?.name || 'Archive'

    if (isStudent) {
      const personalParent = findStudentPersonalFolderParent(data.archiveTree || [], session.studentNumber)
      const activeFolderAllowed = folderDetail && canStudentCreateInFolder(folderDetail, session.studentNumber)
      if (activeFolderAllowed) {
        parentId = folderDetail.id
        parentName = folderDetail.name
      } else if (personalParent?.id && personalParent.id > 0) {
        parentId = personalParent.id
        parentName = personalParent.name
      }
    } else {
      const parentNode = folderDetail?.id === activeFolderId
        ? folderDetail
        : (activeFolderId ? findFolderNode(data.archiveTree || [], activeFolderId) : null)
      if (!parentNode) {
        showNotice('Select a department, academic year, or semester folder in the archive tree first.')
        return
      }
      if (!canStaffCreateArchiveSubfolder(parentNode, session.role)) {
        if (isDepartmentFolder(parentNode) && !isAdmin) {
          showNotice('Only administrators can create folders directly under a department. Open an academic year or semester folder instead.')
        } else if (isFacultyFolder(parentNode)) {
          showNotice('Folders cannot be created under a faculty. Open a department or lower folder instead.')
        } else {
          showNotice('Select a valid folder to create a subfolder.')
        }
        return
      }
      parentId = parentNode.id
      parentName = parentNode.name
    }

    if (!parentId || parentId < 1) {
      showNotice(isStudent
        ? 'Open your Final Year Project folder first, or upload a project document to create your workspace.'
        : 'No archive folder is available yet.')
      return
    }

    setAppConfirmInput('')
    setAppConfirm({
      title: 'Create new folder',
      message: isStudent
        ? `Create a personal folder inside "${parentName}" for your final year project files.`
        : `Create a subfolder inside "${parentName}".`,
      confirmLabel: 'Create folder',
      inputLabel: 'Folder name',
      inputPlaceholder: 'Enter folder name',
      onConfirm: async (folderName) => {
        const trimmedName = String(folderName || '').trim()
        if (!trimmedName) {
          throw new Error('Please enter a folder name.')
        }
        await createSubfolder(parentId, trimmedName)
        if (isFolderRoute) {
          await reloadFolder()
        }
        const fresh = await getDashboard()
        setDashboard(fresh)
        showNotice(`Folder "${trimmedName}" created.`)
      }
    })
  }

  function closeAppConfirm() {
    if (appConfirmBusy) {
      return
    }
    setAppConfirm(null)
    setAppConfirmInput('')
    setAppConfirmSelect('')
  }

  async function runAppConfirmAction() {
    if (!appConfirm?.onConfirm) {
      return
    }
    setAppConfirmBusy(true)
    try {
      const submittedValue = appConfirm.inputLabel
        ? appConfirmInput
        : appConfirm.selectLabel
          ? appConfirmSelect
          : undefined
      await appConfirm.onConfirm(submittedValue)
      closeAppConfirm()
    } catch (err) {
      showNotice(err.message || 'Action failed.')
    } finally {
      setAppConfirmBusy(false)
    }
  }

  function handleFolderContextMenu(event, folder) {
    event.preventDefault()
    event.stopPropagation()
    setFolderContextMenu({
      x: event.clientX,
      y: event.clientY,
      folder
    })
  }

  function handleRenameFolder(folder) {
    setAppConfirmInput(folder.name)
    setAppConfirmSelect('')
    setAppConfirm({
      title: 'Rename folder',
      message: `Enter a new name for "${folder.name}".`,
      confirmLabel: 'Rename',
      inputLabel: 'Folder name',
      inputPlaceholder: 'Enter folder name',
      onConfirm: async (name) => {
        const trimmedName = String(name || '').trim()
        if (!trimmedName) {
          throw new Error('Please enter a folder name.')
        }
        await renameFolder(folder.id, trimmedName)
        await refreshExplorerData()
        showNotice(`Folder renamed to "${trimmedName}".`)
      }
    })
  }

  function handleCopyFolder(folder) {
    setFolderClipboard({
      mode: 'copy',
      folderId: folder.id,
      folderName: folder.name
    })
    showNotice(`Copied "${folder.name}". Right-click a destination folder and choose Paste.`)
  }

  function handleMoveFolder(folder) {
    const blockedIds = collectDescendantFolderIds(data.archiveTree || [], folder.id)
    const destinations = flattenFolderNodes(data.archiveTree || [])
      .filter((candidate) => !blockedIds.has(candidate.id) && candidate.id !== folder.parentId)

    if (!destinations.length) {
      showNotice('No destination folders are available for this move.')
      return
    }

    setAppConfirmInput('')
    setAppConfirmSelect(String(destinations[0].id))
    setAppConfirm({
      title: 'Move folder',
      message: `Choose where to move "${folder.name}".`,
      confirmLabel: 'Move here',
      selectLabel: 'Destination folder',
      selectOptions: destinations.map((destination) => ({
        value: String(destination.id),
        label: destination.path
      })),
      onConfirm: async (targetId) => {
        const destinationId = Number(targetId)
        await moveFolder(folder.id, destinationId)
        setFolderClipboard(null)
        if (activeFolderId === folder.id) {
          openFolder(destinationId)
        }
        await refreshExplorerData()
        showNotice(`Folder "${folder.name}" moved.`)
      }
    })
  }

  async function handlePasteFolder(targetFolder) {
    if (!folderClipboard) {
      return
    }

    const { mode, folderId, folderName } = folderClipboard
    if (mode === 'copy') {
      await copyFolder(folderId, targetFolder.id)
      showNotice(`Pasted a copy of "${folderName}" into "${targetFolder.name}".`)
    } else if (mode === 'move') {
      await moveFolder(folderId, targetFolder.id)
      if (activeFolderId === folderId) {
        openFolder(targetFolder.id)
      }
      showNotice(`Moved "${folderName}" into "${targetFolder.name}".`)
    }
    setFolderClipboard(null)
    await refreshExplorerData()
  }

  function handleQuickAccess(action) {
    if (action === 'dashboard') {
      setDashboardView('default')
      setSelectedAdminOffice(null)
      navigateToDashboard()
      return
    }
    if (action === 'archive') {
      setDashboardView('archive')
      setSelectedAdminOffice(null)
      setSelectedCategory('')
      setSearchQuery('')
      setStudentSearchProfile(null)
      setSearchResults(null)
      navigateToDashboard()
      return
    }
    if (action === 'recent') {
      setDashboardView('recent')
      setSelectedAdminOffice(null)
      setSelectedCategory('')
      setSearchQuery('')
      setStudentSearchProfile(null)
      setSearchResults(null)
      navigateToDashboard()
      return
    }
    if (action === 'browse') {
      setSelectedAdminOffice(null)
      const firstFolder = (dashboard ?? emptyDashboard).archiveTree?.[0]
      if (firstFolder) {
        openFolder(firstFolder.id)
      } else {
        showNotice('No archive folders are available yet.')
      }
    }
  }

  function openAdminOffice(role) {
    setSelectedAdminOffice(role)
    setDashboardView('default')
    setSearchQuery('')
    setStudentSearchProfile(null)
    setSearchResults(null)
    navigateToDashboard()
  }

  const isAdmin = session.role === 'ADMIN'
  const sidebarQuickAccess = isAdmin
    ? adminQuickAccess
    : isStudent
      ? quickAccess.filter((item) => item.action !== 'archive')
      : staffQuickAccess
  const treeAddParent = folderDetail?.id === activeFolderId
    ? folderDetail
    : (activeFolderId ? findFolderNode(data.archiveTree || [], activeFolderId) : null)
  const allowTreeAddFolder = isStudent
    ? true
    : canStaffCreateArchiveSubfolder(treeAddParent, session.role)

  function openFolder(folderId) {
    if (!folderId) {
      return
    }
    navigateToHash(`#/folders/${folderId}`)
  }

  function handleOpenArchiveFolder(folderId, studentNumber) {
    const targetId = resolveArchiveFolderId({
      folderId,
      studentNumber,
      archiveTree: data.archiveTree || []
    })
    if (!targetId) {
      showNotice('Archive folder not found for this student yet.')
      return
    }
    setDashboardView('default')
    setModalOpen(false)
    openFolder(targetId)
  }

  async function reloadFolder() {
    if (!route.folderId) {
      return
    }
    setFolderLoading(true)
    setFolderError('')
    try {
      const data = await getFolder(route.folderId)
      setFolderDetail(data)
    } catch (err) {
      setFolderDetail(null)
      setFolderError(err.message || 'Folder not found.')
    } finally {
      setFolderLoading(false)
    }
  }

  async function refreshExplorerData() {
    await reloadFolder()
    try {
      const fresh = await getDashboard()
      setDashboard(fresh)
    } catch {
      // Keep the current folder view if dashboard refresh fails.
    }
  }

  function goBackFolder() {
    const nav = folderNavRef.current
    if (nav.index <= 0) {
      return
    }
    const nextIndex = nav.index - 1
    folderNavRef.current = { ...nav, index: nextIndex, skip: true }
    navigateToHash(`#/folders/${nav.stack[nextIndex]}`)
    setFolderNavTick((value) => value + 1)
  }

  function goForwardFolder() {
    const nav = folderNavRef.current
    if (nav.index >= nav.stack.length - 1) {
      return
    }
    const nextIndex = nav.index + 1
    folderNavRef.current = { ...nav, index: nextIndex, skip: true }
    navigateToHash(`#/folders/${nav.stack[nextIndex]}`)
    setFolderNavTick((value) => value + 1)
  }

  function goUpFolder() {
    if (folderDetail?.parentId) {
      openFolder(folderDetail.parentId)
    }
  }

  async function handleUpload(event) {
    event.preventDefault()
    if (!file) {
      showNotice('Please choose a file to upload.')
      return
    }
    if (scanBusy) {
      showNotice('Please wait while the document is being scanned.')
      return
    }
    if (!scanResult?.verified) {
      showNotice(scanError || scanResult?.summary || 'This document could not be confirmed as an AUCA record.')
      return
    }
    if (isStudent && (!session.studentNumber || !session.fullName)) {
      showNotice('Your student profile is incomplete. Contact the registrar office.')
      return
    }
    if (isStudent && Number(file.size || 0) > 5 * 1024 * 1024) {
      showNotice('Student uploads are limited to 5 MB per file.')
      return
    }
    if (!isStudent) {
      const normalizedId = normalizeStudentId(form.studentNumber)
      if (!normalizedId) {
        showNotice('Student ID is required.')
        return
      }
      if (studentEntryMode === 'new') {
        const formatError = validateStudentIdForNewEntry(normalizedId)
        if (formatError) {
          showNotice(formatError)
          return
        }
      }
      const departmentError = validateStudentIdDepartmentMatch(normalizedId, form.department)
      if (departmentError) {
        showNotice(departmentError)
        return
      }
    }
    if (studentNeedsProfile && (!form.faculty || !form.department)) {
      showNotice('Please select the faculty and department for this new student entry.')
      return
    }
    if (!isStudent && !isExamOfficer) {
      if (!String(form.academicYear || '').trim() || !String(form.semester || '').trim()) {
        showNotice('Please select the academic year and semester for archive placement.')
        return
      }
    }
    if (isExamOfficer) {
      const examTypeMeta = selectedExamTypeMeta || getExamPaperTypeMeta(form.examType)
      const marksValue = Number(form.marks)
      const requiredFields = [
        form.academicYear,
        form.semester,
        form.course,
        form.examRoom
      ].every((value) => String(value || '').trim())
      if (!form.examType || !requiredFields || form.marks === '' || Number.isNaN(marksValue)) {
        showNotice('Please complete the exam type, year, semester, course, room, and marks fields.')
        return
      }
      if (marksValue < 0 || marksValue > examTypeMeta.maxMarks) {
        showNotice(`Marks must be between 0 and ${examTypeMeta.maxMarks} for ${examTypeMeta.label}.`)
        return
      }
    }
    setUploadBusy(true)
    try {
      const marksValue = form.marks === '' ? null : Number(form.marks)
      const payload = {
        ...form,
        studentNumber: normalizeStudentId(form.studentNumber),
        title: isExamOfficer
          ? buildExamTitle(form, studentLookupResult?.studentNumber || form.studentNumber)
          : getCategoryMeta(form.category).label,
        pageCount: Number(form.pageCount),
        marks: marksValue,
        examType: isExamOfficer ? form.examType : null,
        academicYear: isStudent ? null : String(form.academicYear || '').trim() || null,
        semester: isStudent ? null : String(form.semester || '').trim() || null,
        course: isExamOfficer ? String(form.course || '').trim() : null,
        examRoom: isExamOfficer ? String(form.examRoom || '').trim() : null
      }
      await submitUpload(payload, file)
      showNotice('Document uploaded successfully.')
      setModalOpen(false)
      setFile(null)
      setScanResult(null)
      setScanError('')
      const fresh = await getDashboard()
      setDashboard(fresh)
      if (isFolderRoute && route.folderId) {
        await reloadFolder()
      }
    } catch (err) {
      showNotice(err.message)
    } finally {
      setUploadBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="workspace">
        <aside className="sidebar sidebar-archive-layout">
          <div className="sidebar-brand-block">
            <BrandLogo />
          </div>

          {isStaffUser ? (
          <div className={`sidebar-section sidebar-quick-access ${quickAccessOpen ? 'is-open' : 'is-collapsed'}`}>
            <button
              type="button"
              className="quick-access-toggle"
              aria-expanded={quickAccessOpen}
              onClick={toggleQuickAccess}
            >
              <span className="eyebrow">Quick Access</span>
              <span className={`quick-access-chevron ${quickAccessOpen ? 'is-open' : ''}`} aria-hidden="true">
                <ChevronDownIcon className="icon" />
              </span>
            </button>
            <div className={`quick-access-panel ${quickAccessOpen ? 'is-open' : ''}`}>
              <div className="quick-access-links">
                {sidebarQuickAccess.map((item) => {
                  const Icon = item.icon
                  const isActive = !isFolderRoute && (
                    (item.action === 'dashboard' && dashboardView === 'default')
                    || (item.action === 'recent' && dashboardView === 'recent')
                    || (item.action === 'archive' && dashboardView === 'archive')
                  ) || (item.action === 'browse' && isFolderRoute)
                  const badgeCount = item.action === 'archive'
                    ? archiveList.length
                    : item.action === 'recent'
                      ? recentActivityCount
                      : null
                  return (
                    <button
                      key={item.label}
                      className={`quick-link ${isActive ? 'active' : ''}`}
                      type="button"
                      onClick={() => handleQuickAccess(item.action)}
                    >
                      <Icon className="icon" />
                      <span>{item.label}</span>
                      {badgeCount ? <strong>{badgeCount}</strong> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          ) : (
          <div className="sidebar-section sidebar-quick-access is-open student-quick-access">
            <p className="eyebrow quick-access-label">Quick Access</p>
            <div className="quick-access-links">
              {sidebarQuickAccess.map((item) => {
                const Icon = item.icon
                const isActive = !isFolderRoute && (
                  (item.action === 'dashboard' && dashboardView === 'default')
                  || (item.action === 'recent' && dashboardView === 'recent')
                  || (item.action === 'archive' && dashboardView === 'archive')
                ) || (item.action === 'browse' && isFolderRoute)
                return (
                  <button
                    key={item.label}
                    className={`quick-link ${isActive ? 'active' : ''}`}
                    type="button"
                    onClick={() => handleQuickAccess(item.action)}
                  >
                    <Icon className="icon" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
          )}

          {isAdmin ? (
            <div className="sidebar-section sidebar-offices">
              <div className="section-head offices-head">
                <p className="eyebrow">Offices</p>
                {adminOfficesBusy ? <span className="offices-sync-dot" title="Refreshing offices" /> : null}
              </div>
              <div className="offices-links">
                {adminOffices.length ? adminOffices.map((office) => (
                  <button
                    key={office.role}
                    type="button"
                    className={`office-link ${selectedAdminOffice === office.role && !isFolderRoute && dashboardView === 'default' ? 'active' : ''}`}
                    onClick={() => openAdminOffice(office.role)}
                    title={office.summary}
                  >
                    <span className="office-link-copy">
                      <strong>{office.label}</strong>
                      <em>{office.department}</em>
                    </span>
                    <span className="office-link-count">{office.userCount}</span>
                  </button>
                )) : (
                  <p className="offices-empty">No office accounts yet.</p>
                )}
              </div>
            </div>
          ) : null}

          {!isAdmin ? (
          <ArchiveTreePanel
            nodes={data.archiveTree || []}
            activeFolderId={activeFolderId}
            onOpenFolder={openFolder}
            onDeleteFolder={isStudent ? null : handleTreeDeleteFolder}
            onFolderContextMenu={handleFolderContextMenu}
            onAddFolder={handleTreeAddFolder}
            allowAddFolder={allowTreeAddFolder}
            treeFilter={treeFilter}
            onTreeFilterChange={setTreeFilter}
            treeFilterOpen={treeFilterOpen}
            onToggleTreeFilter={() => setTreeFilterOpen((current) => !current)}
          />
          ) : null}

          <div className="sidebar-bottom">
            <div className="sidebar-footer">
              <p className="eyebrow">{isStudent ? 'Personal storage' : 'Department Storage'}</p>
              <div className="storage-meter">
                <div className="storage-fill" style={{ width: `${storagePercent}%` }} />
              </div>
              <div className="storage-copy">
                <span>{formatBytes(data.storageUsedBytes)} used</span>
                <span>{formatBytes(data.storageLimitBytes)}</span>
              </div>
            </div>

            <div className="sidebar-account sidebar-account-compact">
              <div className="sidebar-account-row">
                <div className="avatar avatar-sm">{avatarLabel}</div>
                <div className="profile-copy">
                  <strong>{session.fullName || data.userName || 'Archive user'}</strong>
                  <span>{session.roleLabel || roleConfig.roleLabel}</span>
                </div>
                <button type="button" className="sidebar-logout-link" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </aside>

        <main className="main-panel">
          {notice ? (
            <div className="toast-notice" role="status" aria-live="polite">
              {notice}
            </div>
          ) : null}
          {isFolderRoute ? (
          <div className="main-search-bar">
            <label className="main-search-field">
              <SearchIcon className="icon search" />
              <input
                ref={mainSearchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by letter, number, student ID, folder, or file across departments..."
                aria-label="Archive search across departments"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="ghost-icon main-search-clear"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                >
                  <XIcon className="icon tiny" />
                </button>
              ) : null}
            </label>
          </div>
          ) : null}
          {deferredQuery && isFolderRoute ? (
            <GlobalSearchResults
              query={deferredQuery}
              busy={searchBusy}
              results={searchResults}
              studentProfile={studentSearchProfile}
              onClear={() => setSearchQuery('')}
              onOpenDocument={(documentId) => openDocument(documentId).catch((err) => showNotice(err.message || 'Unable to open document.'))}
              onOpenFolder={(folderId) => handleOpenArchiveFolder(folderId, studentSearchProfile?.studentNumber)}
            />
          ) : null}
          {isFolderRoute ? (
            <FolderView
              folder={folderDetail}
              loading={folderLoading}
              error={folderError}
              userRole={session.role}
              studentNumber={session.studentNumber}
              onOpenFolder={openFolder}
              onUpload={() => setModalOpen(true)}
              onRefresh={reloadFolder}
              onFolderContextMenu={handleFolderContextMenu}
              onGoBack={goBackFolder}
              onGoForward={goForwardFolder}
              onGoUp={goUpFolder}
              canGoBack={canGoBackFolder}
              canGoForward={canGoForwardFolder}
              canGoUp={canGoUpFolder}
              onOpenSearch={() => mainSearchInputRef.current?.focus()}
              onNotify={showNotice}
              onDataChange={refreshExplorerData}
              onArchivedChange={handleArchivedChange}
            />
          ) : isAdmin && dashboardView === 'default' ? (
            <div className="dashboard-workspace">
              <header className="dash-header dash-header-staff">
                <div className="dash-header-copy">
                  <nav className="dash-crumbs" aria-label="Breadcrumb">
                    <span>Archive</span>
                    <ChevronRightIcon className="icon small" />
                    <strong>{selectedAdminOffice ? (adminOffices.find((office) => office.role === selectedAdminOffice)?.label || 'Office') : dashboardLabel}</strong>
                  </nav>
                  <h1>{selectedAdminOffice ? (adminOffices.find((office) => office.role === selectedAdminOffice)?.label || 'Office') : dashboardLabel}</h1>
                  <span className="dash-meta">
                    {formatLongDate(new Date())}
                    {data.lastSignIn ? ` · Signed in ${data.lastSignIn}` : ''}
                  </span>
                </div>
              </header>
              {showStaffDashboardSearch && !selectedAdminOffice ? (
                <div className="dash-below-header-search">
                  <label className="main-search-field">
                    <SearchIcon className="icon search" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search by letter, number, student ID, folder, or file across departments..."
                      aria-label="Archive search across departments"
                    />
                    {searchQuery ? (
                      <button
                        type="button"
                        className="ghost-icon main-search-clear"
                        aria-label="Clear search"
                        onClick={() => setSearchQuery('')}
                      >
                        <XIcon className="icon tiny" />
                      </button>
                    ) : null}
                  </label>
                </div>
              ) : null}
              {showStaffDashboardSearch && !selectedAdminOffice && deferredQuery ? (
                <GlobalSearchResults
                  query={deferredQuery}
                  busy={searchBusy}
                  results={searchResults}
                  studentProfile={studentSearchProfile}
                  onClear={() => setSearchQuery('')}
                  onOpenDocument={(documentId) => openDocument(documentId).catch((err) => showNotice(err.message || 'Unable to open document.'))}
                  onOpenFolder={(folderId) => handleOpenArchiveFolder(folderId, studentSearchProfile?.studentNumber)}
                />
              ) : null}
              {selectedAdminOffice ? (
                <AdminOfficeView
                  officeRole={selectedAdminOffice}
                  archiveTree={data.archiveTree || []}
                  onNotify={showNotice}
                  onOpenFolder={(folderId) => handleOpenArchiveFolder(folderId)}
                  onBack={() => setSelectedAdminOffice(null)}
                />
              ) : (
                <AdminDashboard onNotify={showNotice} />
              )}
            </div>
          ) : isStudent && dashboardView === 'default' && !isFolderRoute ? (
            <StudentDashboard
              session={session}
              dashboard={data}
              onNotify={showNotice}
              onRefresh={async () => {
                const fresh = await getDashboard()
                setDashboard(fresh)
              }}
              onCreateFolder={handleTreeAddFolder}
              onBrowse={() => {
                const personalParent = findStudentPersonalFolderParent(data.archiveTree || [], session.studentNumber)
                if (personalParent?.id && personalParent.id > 0) {
                  openFolder(personalParent.id)
                } else {
                  showNotice('Submit a project first, or open your workspace after the first upload.')
                }
              }}
              onOpenDocument={(documentId) => openDocument(documentId).catch((err) => showNotice(err.message || 'Unable to open document.'))}
            />
          ) : (
            <div className="dashboard-workspace">
          <header className="dash-header dash-header-staff">
            <div className="dash-header-copy">
              <nav className="dash-crumbs" aria-label="Breadcrumb">
                <span>Archive</span>
                <ChevronRightIcon className="icon small" />
                <span>Recent activity</span>
                <ChevronRightIcon className="icon small" />
                <strong>{selectedCategoryMeta?.label || dashboardLabel}</strong>
              </nav>
              <h1>{dashboardLabel}</h1>
              <span className="dash-meta">
                {formatLongDate(new Date())}
                {data.lastSignIn ? ` · Signed in ${data.lastSignIn}` : ''}
              </span>
            </div>
            <div className="dash-header-actions">
              {!hideHeaderBrowse ? (
              <button
                className="ghost-btn dash-action-btn"
                type="button"
                onClick={() => {
                  const firstFolder = (data.archiveTree || [])[0]
                  if (firstFolder) {
                    openFolder(firstFolder.id)
                  }
                }}
              >
                <ArrowRightIcon className="icon" />
                Browse
              </button>
              ) : null}
              <button className="primary-btn dash-action-btn" type="button" onClick={() => setModalOpen(true)}>
                <UploadIcon className="icon" />
                Upload
              </button>
            </div>
          </header>

          {showStaffDashboardSearch ? (
            <div className="dash-below-header-search">
              <label className="main-search-field">
                <SearchIcon className="icon search" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by letter, number, student ID, folder, or file across departments..."
                  aria-label="Archive search across departments"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="ghost-icon main-search-clear"
                    aria-label="Clear search"
                    onClick={() => setSearchQuery('')}
                  >
                    <XIcon className="icon tiny" />
                  </button>
                ) : null}
              </label>
            </div>
          ) : null}

          {showStaffDashboardSearch && deferredQuery ? (
            <GlobalSearchResults
              query={deferredQuery}
              busy={searchBusy}
              results={searchResults}
              studentProfile={studentSearchProfile}
              onClear={() => setSearchQuery('')}
              onOpenDocument={(documentId) => openDocument(documentId).catch((err) => showNotice(err.message || 'Unable to open document.'))}
              onOpenFolder={(folderId) => handleOpenArchiveFolder(folderId, studentSearchProfile?.studentNumber)}
            />
          ) : null}

          {visibleDocumentCategories.length ? (
            <nav className="dash-filters" aria-label="Activity areas">
              <button
                type="button"
                className={`dash-filter ${!selectedCategory ? 'active' : ''}`}
                onClick={() => {
                  setDashboardView('default')
                  setSelectedCategory('')
                }}
              >
                All activity
              </button>
              {visibleDocumentCategories.map((category) => {
                const active = selectedCategory === category.value
                return (
                  <button
                    key={category.value}
                    type="button"
                    className={`dash-filter ${active ? 'active' : ''}`}
                    onClick={() => {
                      setDashboardView('default')
                      setSelectedCategory(active ? '' : category.value)
                    }}
                    title={category.summary}
                  >
                    {category.label}
                  </button>
                )
              })}
            </nav>
          ) : null}

          <section className="dash-metrics">
            <StatCard label="Uploaded this week" value={data.recentlyUploaded} caption="new files" accent="upload" />
            <StatCard label="Pending approvals" value={data.pendingApprovals} caption="in your queue" accent="approvals" />
            <StatCard label="Department files" value={data.departmentFiles} caption={departmentLabel || 'All departments'} accent="department" />
            <StatCard label="Storage" value={formatBytes(data.storageUsedBytes)} caption={`of ${formatBytes(data.storageLimitBytes)}`} accent="storage" />
          </section>

          <section className="dash-grid">
            <div className="dash-panel dash-panel-main">
              <div className="dash-panel-head">
                <div>
                  <h2>
                    {dashboardView === 'archive'
                      ? 'Removed archive'
                      : dashboardView === 'recent'
                        ? 'Recent activity'
                        : 'Department activity'}
                  </h2>
                  <p>
                    {dashboardView === 'archive'
                      ? session.role === 'ADMIN'
                        ? 'Files awaiting permanent deletion confirmation. Only administrators can confirm removal.'
                        : `Files moved to archive by ${roleConfig.roleLabel || 'your role'}. An administrator must confirm permanent deletion.`
                      : dashboardView === 'recent'
                        ? 'Actions recorded in the last 7 days.'
                        : selectedCategoryMeta
                          ? `Recent actions for ${selectedCategoryMeta.label.toLowerCase()}.`
                          : 'Recent actions across your department workspace.'}
                  </p>
                </div>
                <div className="dash-panel-actions">
                <button
                  type="button"
                  className="dash-text-btn"
                  onClick={refreshDashboardView}
                >
                  Refresh <ArrowRightIcon className="icon" />
                </button>
                </div>
              </div>

              <div className="table-shell dash-table-shell">
                <table className="dash-table">
                  <thead>
                    <tr>
                      {dashboardView === 'archive' ? (
                        <>
                          <th>Document</th>
                          <th>Student</th>
                          <th>Category</th>
                          <th>Archived</th>
                          <th>Role</th>
                          <th>{session.role === 'ADMIN' ? 'Actions' : 'Status'}</th>
                        </>
                      ) : (
                        <>
                          <th>Action</th>
                          <th>Performed by</th>
                          <th>Type</th>
                          <th>Date</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardView === 'archive' ? (
                      archiveBusy ? (
                        <tr>
                          <td colSpan="6" className="empty-state">Loading archive...</td>
                        </tr>
                      ) : archiveList.length ? (
                        archiveList.map((fileRow) => (
                          <tr key={`archive-${fileRow.id}-${fileRow.archivedAt}`}>
                            <td>
                              <div className="file-cell">
                                <DocumentIcon className="icon doc" />
                                <div>
                                  <strong>{fileRow.title}</strong>
                                  <span>{fileRow.fileName}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <strong>{fileRow.studentNumber || '-'}</strong>
                              <span className="muted-cell">{fileRow.ownerName || 'Student'}</span>
                            </td>
                            <td>
                              <span className="document-chip">
                                {getCategoryMeta(fileRow.category).label}
                              </span>
                            </td>
                            <td>{formatDateTime(fileRow.archivedAt)}</td>
                            <td>{fileRow.archivedBy || '-'}</td>
                            <td>
                              <div className="archive-row-actions">
                                <button type="button" className="dash-text-btn" onClick={() => handleRestoreArchived(fileRow.id)}>
                                  Restore
                                </button>
                                {session.role === 'ADMIN' ? (
                                  <button type="button" className="dash-text-btn danger-text" onClick={() => handlePermanentDelete(fileRow.id)}>
                                    Delete permanently
                                  </button>
                                ) : (
                                  <span className="status rejected">AWAITING ADMIN</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="empty-state">
                            Archive is empty. Removed files from your role will appear here.
                          </td>
                        </tr>
                      )
                    ) : loading || activitiesBusy ? (
                      <tr>
                        <td colSpan="4" className="empty-state">Loading activity...</td>
                      </tr>
                    ) : dashboardActivities.length ? (
                      dashboardActivities.map((entry) => (
                        <tr key={entry.id}>
                          <td>
                            <div className="file-cell">
                              <ActivityDot category={entry.category} />
                              <div>
                                <strong>{entry.message}</strong>
                              </div>
                            </div>
                          </td>
                          <td>{entry.actor}</td>
                          <td>
                            <span className="document-chip">{activityCategoryLabel(entry.category)}</span>
                          </td>
                          <td>{formatDateTime(entry.createdAt)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="empty-state">
                          {dashboardView === 'recent'
                            ? 'No activity recorded in the last 7 days.'
                            : selectedCategoryMeta
                              ? `No recent actions for ${selectedCategoryMeta.label.toLowerCase()}.`
                              : 'No activity recorded yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="dash-panel dash-panel-side">
              <div className="dash-panel-head dash-panel-head-inline">
                <h2>Approvals</h2>
                <span className="dash-count">{data.awaitingApproval?.length || 0}</span>
              </div>

              <div className="dash-approval-list">
                {(data.awaitingApproval || []).length ? (data.awaitingApproval || []).map((task) => (
                  <div key={task.id} className="dash-approval-item">
                    <div className="approval-copy">
                      <div className="approval-title">
                        <DocumentIcon className="icon doc" />
                        <strong>{task.documentTitle}</strong>
                      </div>
                      <span>{task.requestedBy}</span>
                      <p>{task.note}</p>
                    </div>
                    <div className="approval-meta">
                      <span className={`priority ${String(task.priority || '').toLowerCase()}`}>{task.priority}</span>
                      <div className="approval-actions">
                        <button type="button" className="tiny-btn approve" onClick={() => handleDecision(task.id, 'approve')}>
                          <CheckIcon className="icon" /> Approve
                        </button>
                        <button type="button" className="tiny-btn reject" onClick={() => handleDecision(task.id, 'reject')}>
                          <XIcon className="icon" /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <p className="dash-side-empty">Nothing waiting for approval.</p>
                )}
              </div>

              <div className="dash-side-block">
                <div className="dash-panel-head dash-panel-head-inline">
                  <h3>Student lookup</h3>
                  <span className="dash-count">{studentLookupResult?.documentCount || 0}</span>
                </div>
                <p className="dash-side-note">Search by student ID ({STUDENT_ID_FORMATS_HINT}) to view their full archive.</p>
                <div className="lookup-form">
                  <input
                    value={studentLookupQuery}
                    onChange={(event) => {
                      setStudentLookupQuery(event.target.value)
                      setStudentLookupError('')
                      setStudentLookupInfo('')
                    }}
                    placeholder="e.g. 20251SEN001 or 25876"
                  />
                  <button
                    type="button"
                    className="primary-btn lookup-button"
                    onClick={() => lookupStudentArchive(studentLookupQuery)}
                    disabled={studentLookupBusy}
                  >
                    {studentLookupBusy ? 'Searching...' : 'Search student'}
                  </button>
                </div>
                {studentLookupError ? <div className="lookup-error">{studentLookupError}</div> : null}
                {!studentLookupError && studentLookupInfo ? <div className="lookup-info">{studentLookupInfo}</div> : null}
                {studentLookupResult ? (
                  <div className="lookup-result">
                    <button
                      type="button"
                      className="lookup-summary lookup-summary-link"
                      onClick={() => handleOpenArchiveFolder(studentLookupResult.folderId, studentLookupResult.studentNumber)}
                      title="Open student archive folder"
                    >
                      <strong>{studentLookupResult.studentName}</strong>
                      <span>{studentLookupResult.studentNumber}</span>
                      <span>{studentLookupResult.documentCount} documents</span>
                      <span className="lookup-open-folder">Open folder</span>
                    </button>
                    <div className="lookup-documents">
                      {(studentLookupResult.documents || []).slice(0, 3).map((document) => (
                        <button
                          key={document.id}
                          type="button"
                          className="lookup-doc-item lookup-doc-item-link"
                          onClick={() => handleOpenArchiveFolder(document.folderId || studentLookupResult.folderId, studentLookupResult.studentNumber)}
                          title={`Open folder: ${document.folderName || 'Archive'}`}
                        >
                          <DocumentIcon className="icon doc" />
                          <div>
                            <strong>{document.title}</strong>
                            <span>
                              {getCategoryMeta(document.category).label} - {formatDate(document.issueDate)} - {document.pageCount || '-'} pages
                            </span>
                            <span className="muted-cell">{document.folderName || 'Open archive folder'}</span>
                            {document.examType ? (
                              <span className="muted-cell">
                                {[
                                  getExamPaperTypeMeta(document.examType).label,
                                  document.course,
                                  document.academicYear,
                                  document.semester,
                                  document.marks != null ? `${document.marks}/${getExamPaperTypeMeta(document.examType).maxMarks}` : null,
                                  document.examRoom
                                ].filter(Boolean).join(' | ')}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      ))}
                      {(studentLookupResult.documents || []).length > 3 ? (
                        <button
                          type="button"
                          className="lookup-more lookup-more-link"
                          onClick={() => handleOpenArchiveFolder(studentLookupResult.folderId, studentLookupResult.studentNumber)}
                        >
                          + {(studentLookupResult.documents || []).length - 3} more documents · Open folder
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="lookup-empty">Search a student ID to reveal their archive.</p>
                )}
              </div>

              <div className="dash-side-block dash-side-block-muted">
                <h3>Recent activity</h3>
                <div className="dash-activity-list">
                  {(data.departmentActivity || []).map((entry) => (
                    <div key={entry.id} className="dash-activity-row">
                      <ActivityDot category={entry.category} />
                      <div>
                        <strong>{entry.message}</strong>
                        <span>{entry.actor} - {formatDate(entry.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </section>

          {error ? <div className="banner warning">{error}</div> : null}
            </div>
          )}
        </main>
      </div>

      <FolderContextMenu
        open={Boolean(folderContextMenu)}
        x={folderContextMenu?.x || 0}
        y={folderContextMenu?.y || 0}
        folder={folderContextMenu?.folder}
        clipboard={folderClipboard}
        userRole={session.role}
        studentNumber={session.studentNumber}
        onRename={handleRenameFolder}
        onCopy={handleCopyFolder}
        onPaste={handlePasteFolder}
        onMove={handleMoveFolder}
        onClose={() => setFolderContextMenu(null)}
      />

      <ConfirmDialog
        open={Boolean(appConfirm)}
        title={appConfirm?.title || ''}
        message={appConfirm?.message || ''}
        confirmLabel={appConfirm?.confirmLabel}
        tone={appConfirm?.tone}
        inputLabel={appConfirm?.inputLabel}
        inputPlaceholder={appConfirm?.inputPlaceholder}
        inputValue={appConfirmInput}
        onInputChange={setAppConfirmInput}
        selectLabel={appConfirm?.selectLabel}
        selectOptions={appConfirm?.selectOptions}
        selectValue={appConfirmSelect}
        onSelectChange={setAppConfirmSelect}
        onConfirm={runAppConfirmAction}
        onCancel={closeAppConfirm}
        busy={appConfirmBusy}
      />

      {modalOpen ? (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)} role="presentation">
          <div className="modal" onClick={(event) => event.stopPropagation()} role="presentation">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Upload Document</p>
                <h2>Add a new record to the archive</h2>
              </div>
              <button className="ghost-icon" type="button" onClick={() => setModalOpen(false)}>
                <XIcon className="icon" />
              </button>
            </div>

            <form className="upload-form" onSubmit={handleUpload}>
              <div className="title-banner">
                <div>
                  <p className="eyebrow">{isExamOfficer ? 'Exam title' : 'Document title'}</p>
                  <strong>{examTitlePreview}</strong>
                  <span>
                    {isExamOfficer
                      ? 'Auto-generated from the exam type, course, year, semester, and student ID.'
                      : 'Auto-generated from the selected document type.'}
                  </span>
                </div>
                <span className="title-chip">{isExamOfficer ? selectedExamTypeMeta?.label || 'Exam' : getCategoryMeta(form.category).value}</span>
              </div>

              {isStudent ? (
                <div className="student-upload-banner">
                  <div>
                    <p className="eyebrow">Your student profile</p>
                    <strong>{session.fullName}</strong>
                    <span>ID {session.studentNumber} · Uploads count toward your personal 256 MB limit</span>
                  </div>
                  <span className="title-chip">Final Year Project</span>
                </div>
              ) : null}

              {studentLookupResult && !isStudent ? (
                <div className="student-summary-bar">
                  <div className="student-summary-copy">
                    <p className="eyebrow">Student profile</p>
                    <strong>{studentLookupResult.studentName}</strong>
                    <span>{studentLookupResult.studentNumber}</span>
                  </div>
                  <div className="student-summary-badges">
                    <span className="summary-chip">{studentLookupResult.faculty || 'Faculty not set'}</span>
                    <span className="summary-chip">{studentLookupResult.department || 'Department not set'}</span>
                    <span className="summary-chip">{studentLookupResult.documentCount} documents</span>
                    <button
                      type="button"
                      className="summary-chip summary-chip-link"
                      onClick={() => handleOpenArchiveFolder(studentLookupResult.folderId, studentLookupResult.studentNumber)}
                    >
                      Open archive folder
                    </button>
                  </div>
                </div>
              ) : null}

              {isExamOfficer ? (
                <div className="exam-path-banner">
                  <div>
                    <p className="eyebrow">Archive folder path</p>
                    <strong>
                      {[
                        form.department || 'Department',
                        String(form.academicYear || '').trim(),
                        String(form.semester || '').trim(),
                        String(form.studentNumber || '').trim(),
                        selectedExamTypeMeta?.label,
                        String(form.course || '').trim()
                      ].filter(Boolean).join(' / ')}
                    </strong>
                    <span>Documents are stored under the department year, semester, student, and exam folders.</span>
                  </div>
                  <span className="title-chip">
                    {selectedExamTypeMeta?.maxMarks ? `Max ${selectedExamTypeMeta.maxMarks}` : 'Marks'}
                  </span>
                </div>
              ) : null}

              {!isStudent && !isExamOfficer ? (
                <section className="exam-details-panel">
                  <div className="exam-details-head">
                    <div>
                      <p className="eyebrow">Archive placement</p>
                      <strong>Choose the academic year and semester folder for this document.</strong>
                    </div>
                    <span className="inline-note">
                      Create custom folders inside semester folders such as 2025/1, 2025/2, or 2025/3.
                    </span>
                  </div>

                  <div className="exam-details-grid">
                    <label>
                      <span>Academic year</span>
                      <select
                        value={form.academicYear}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          academicYear: event.target.value,
                          semester: ''
                        }))}
                      >
                        <option value="">Select academic year</option>
                        {ACADEMIC_YEARS.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Semester</span>
                      <select
                        value={form.semester}
                        onChange={(event) => setForm((current) => ({ ...current, semester: event.target.value }))}
                        disabled={!form.academicYear}
                      >
                        <option value="">Select semester</option>
                        {archiveSemesterOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>
              ) : null}

              <div className="form-grid">
                {!isStudent ? (
                <label className="lookup-field">
                  <span>Student ID</span>
                  <div className="lookup-input-row">
                    <input
                      value={form.studentNumber}
                      onChange={(event) => {
                        const next = applyStudentIdDefaults(form, event.target.value)
                        setForm(next)
                        setStudentLookupError('')
                        setStudentLookupInfo('')
                        setStudentLookupResult(null)
                        setStudentEntryMode('idle')
                      }}
                      placeholder="e.g. 20251SEN001 or 25876"
                    />
                    <button
                      type="button"
                      className="ghost-btn lookup-action"
                      onClick={() => lookupStudentArchive(form.studentNumber, { populateForm: true })}
                      disabled={studentLookupBusy}
                    >
                      {studentLookupBusy ? 'Checking...' : 'Search student'}
                    </button>
                  </div>
                  {studentLookupResult?.studentNumber === String(form.studentNumber || '').trim() ? (
                    <small className="lookup-hint">
                      Found {studentLookupResult.studentName} with {studentLookupResult.documentCount} stored documents.
                    </small>
                  ) : null}
                  {studentLookupError && form.studentNumber.trim() ? <small className="lookup-hint error">{studentLookupError}</small> : null}
                  {studentLookupInfo && form.studentNumber.trim() ? <small className="lookup-hint info">{studentLookupInfo}</small> : null}
                </label>
                ) : null}
                {!isStudent ? (
                <label>
                  <span>Student name</span>
                  <input
                    value={form.studentName}
                    onChange={(event) => setForm({ ...form, studentName: event.target.value })}
                    placeholder="Will be linked to the student ID"
                  />
                </label>
                ) : null}
                {documentTypeLocked ? (
                  <div className="title-banner locked-category">
                    <div>
                      <p className="eyebrow">Document type</p>
                      <strong>{getCategoryMeta(form.category).label}</strong>
                      <span>
                        {isExamOfficer
                          ? 'This role only uploads exam papers.'
                          : isStudent
                            ? 'Students can only upload final year project documents.'
                            : 'This role only uploads this document category.'}
                      </span>
                    </div>
                    <span className="title-chip">Locked</span>
                  </div>
                ) : (
                  <label>
                    <span>Document type</span>
                    <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                      {studentDocumentCategories.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                    <small className="lookup-hint">
                      {isExamOfficer
                        ? 'Title is generated from the exam type, course, year, semester, and student ID.'
                        : `Title will default to ${getCategoryMeta(form.category).label}.`}
                    </small>
                  </label>
                )}
                <label>
                  <span>Page count</span>
                  <input
                    type="number"
                    min="1"
                    value={form.pageCount}
                    onChange={(event) => setForm({ ...form, pageCount: event.target.value })}
                  />
                </label>
                <label>
                  <span>{isExamOfficer ? 'Exam date' : 'Issue date'}</span>
                  <input
                    type="date"
                    value={form.issueDate}
                    onChange={(event) => setForm({ ...form, issueDate: event.target.value })}
                  />
                </label>
                <label>
                  <span>Uploaded by</span>
                  <input
                    value={form.uploadedBy}
                    onChange={(event) => setForm({ ...form, uploadedBy: event.target.value })}
                    placeholder="Will default from your account"
                    readOnly={isStudent}
                  />
                </label>
                {!isExamOfficer ? (
                  <label>
                    <span>Tags</span>
                    <input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="Optional" />
                  </label>
                ) : null}
              </div>

              {isExamOfficer ? (
                <section className="exam-details-panel">
                  <div className="exam-details-head">
                    <div>
                      <p className="eyebrow">Exam details</p>
                      <strong>Capture the paper metadata once and keep it searchable.</strong>
                    </div>
                    <span className="inline-note">
                      {selectedExamTypeMeta?.summary || 'Choose the exam type first so marks validation is applied automatically.'}
                    </span>
                  </div>

                  <div className="exam-details-grid">
                    <label>
                      <span>Exam type</span>
                      <select
                        value={form.examType}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          examType: event.target.value
                        }))}
                      >
                        {examPaperTypes.map((examType) => (
                          <option key={examType.value} value={examType.value}>
                            {examType.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Academic year</span>
                      <select
                        value={form.academicYear}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          academicYear: event.target.value,
                          semester: ''
                        }))}
                      >
                        <option value="">Select academic year</option>
                        {ACADEMIC_YEARS.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Semester</span>
                      <select
                        value={form.semester}
                        onChange={(event) => setForm((current) => ({ ...current, semester: event.target.value }))}
                        disabled={!form.academicYear}
                      >
                        <option value="">Select semester</option>
                        {archiveSemesterOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Course</span>
                      <input
                        value={form.course}
                        onChange={(event) => setForm((current) => ({ ...current, course: event.target.value }))}
                        placeholder="e.g. Software Engineering"
                      />
                    </label>
                    <label>
                      <span>Marks</span>
                      <input
                        type="number"
                        min="0"
                        max={selectedExamTypeMeta?.maxMarks || 40}
                        value={form.marks}
                        onChange={(event) => setForm((current) => ({ ...current, marks: event.target.value }))}
                        placeholder={`0 - ${selectedExamTypeMeta?.maxMarks || 40}`}
                      />
                      <small className="lookup-hint">
                        {selectedExamTypeMeta ? `Must be between 0 and ${selectedExamTypeMeta.maxMarks}.` : 'Select an exam type to see the mark limit.'}
                      </small>
                    </label>
                    <label>
                      <span>Room</span>
                      <input
                        value={form.examRoom}
                        onChange={(event) => setForm((current) => ({ ...current, examRoom: event.target.value }))}
                        placeholder="e.g. Room A2"
                      />
                    </label>
                  </div>
                </section>
              ) : null}

              {studentNeedsProfile ? (
                <section className="student-profile-panel">
                  <div>
                    <p className="eyebrow">
                      {studentEntryMode === 'new' ? 'New student entry' : 'Complete student profile'}
                    </p>
                    <strong>
                      {studentEntryMode === 'new'
                        ? `Use ${STUDENT_ID_FORMATS_HINT}`
                        : 'Fill in the missing faculty and department'}
                    </strong>
                  </div>

                  <div className="student-profile-grid">
                    <label>
                      <span>Faculty</span>
                      <select
                        value={form.faculty}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          faculty: event.target.value,
                          department: ''
                        }))}
                      >
                        <option value="">Select faculty</option>
                        {studentFacultyOptions.map((faculty) => (
                          <option key={faculty.value} value={faculty.value}>
                            {faculty.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Department</span>
                      <select
                        value={form.department}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          department: event.target.value
                        }))}
                        disabled={!form.faculty}
                      >
                        <option value="">
                          {form.faculty ? 'Select department' : 'Choose a faculty first'}
                        </option>
                        {selectedDepartmentOptions.map((department) => (
                          <option key={department} value={department}>
                            {department}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <p className="inline-note">
                    {studentEntryMode === 'new'
                      ? 'This student ID was not found. Choose the faculty and department to create the first archive entry.'
                      : 'This student profile is missing faculty or department. Completing both fields will save the profile for future uploads.'}
                  </p>
                </section>
              ) : null}

              {studentLookupResult && !studentNeedsProfile ? (
                <p className="inline-note">
                  Stored faculty and department will be reused automatically for this student.
                </p>
              ) : null}

              {!isExamOfficer ? (
                <label className="full-width">
                  <span>Description</span>
                  <textarea rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </label>
              ) : null}

              <label className="full-width file-picker">
                <span>File</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] || null
                    setFile(nextFile)
                    setScanResult(null)
                    setScanError('')
                  }}
                />
              </label>

              {file ? (
                <div className={`upload-scan-panel ${scanBusy ? 'is-scanning' : scanResult?.verified ? 'is-verified' : scanResult ? 'is-rejected' : ''}`}>
                  {scanBusy ? (
                    <>
                      <strong>Scanning document…</strong>
                      <p>Reading the PDF and checking for AUCA-related information.</p>
                    </>
                  ) : scanError ? (
                    <>
                      <strong>Scan failed</strong>
                      <p>{scanError}</p>
                    </>
                  ) : scanResult ? (
                    <>
                      <div className="upload-scan-head">
                        {scanResult.verified ? <CheckIcon className="icon tiny" /> : <XIcon className="icon tiny" />}
                        <strong>{scanResult.verified ? 'AUCA document confirmed' : 'Document not accepted'}</strong>
                      </div>
                      <p>{scanResult.summary}</p>
                      {scanResult.matchedSignals?.length ? (
                        <ul className="upload-scan-signals">
                          {scanResult.matchedSignals.map((signal) => (
                            <li key={signal}>{signal}</li>
                          ))}
                        </ul>
                      ) : null}
                      {scanResult.preview ? (
                        <p className="upload-scan-preview">“{scanResult.preview}”</p>
                      ) : null}
                      <span className="upload-scan-meta">
                        {scanResult.pageCount} page{scanResult.pageCount === 1 ? '' : 's'}
                        {scanResult.scanMethod ? ` · ${scanResult.scanMethod}` : ''}
                      </span>
                    </>
                  ) : null}
                </div>
              ) : null}

              <div className="modal-actions">
                <button type="button" className="ghost-btn" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={uploadBusy || scanBusy || (file && !scanResult?.verified)}
                >
                  <UploadIcon className="icon" />
                  {uploadBusy ? 'Uploading...' : 'Upload to archive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function StatCard({ label, value, caption, accent }) {
  const iconMap = {
    upload: UploadIcon,
    approvals: ClockIcon,
    department: FolderIcon,
    storage: DocumentIcon
  }
  const Icon = iconMap[accent] || UploadIcon

  return (
    <article className={`dash-metric dash-metric-${accent}`}>
      <span className="dash-metric-icon" aria-hidden="true">
        <Icon className="icon" />
      </span>
      <div className="dash-metric-body">
        <span className="dash-metric-label">{label}</span>
        <strong>{value}</strong>
        <span className="dash-metric-caption">{caption}</span>
      </div>
    </article>
  )
}

export default App
