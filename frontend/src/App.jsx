import React, { useCallback, useEffect, useRef, useState, useDeferredValue } from 'react'
import { createSubfolder, decideApproval, deleteDocument, deleteFolder, downloadDocument, downloadFolderZip, formatLoginError, getActivities, getAdminDashboard, getAdminOffices, getArchivedDocuments, getDashboard, getFolder, getSessionProfile, getSharedWithMe, getSharedWithMeCount, getStudentArchive, importFolderArchive, login, lookupStudent, moveFolder, copyFolder, permanentlyDeleteDocument, renameFolder, replaceDocumentFile, restoreDocument, searchDocuments, shareItems, submitUpload, addDepartmentAcademicYear } from './api'
import AdminDashboard from './components/AdminDashboard'
import AdminOfficeView from './components/AdminOfficeView'
import { buildAdminOffices, filterArchiveTreeForOffice } from './adminOfficeUtils'
import AcademicYearField from './components/AcademicYearField'
import MobileScanPage from './components/MobileScanPage'
import UploadPhoneScanPanel from './components/UploadPhoneScanPanel'
import UploadFileDropzone from './components/UploadFileDropzone'
import LibrarianDashboard from './components/LibrarianDashboard'
import StudentDashboard from './components/StudentDashboard'
import StudentBookReservationControls, { StudentArchiveBookReservationPanel } from './components/StudentBookReservationControls'
import DocumentPdfViewer from './components/DocumentPdfViewer'
import StudentFypWizard from './components/StudentFypWizard'
import ProjectCoverPhoto from './components/ProjectCoverPhoto'
import BrandLogo from './components/BrandLogo'
import {
  applyStudentIdDefaults,
  normalizeStudentId,
  semesterOptionsForAcademicYear,
  STAFF_FOLDER_NAME_HINT,
  STUDENT_ID_FORMATS_HINT,
  validateStaffFolderName,
  validateStudentIdDepartmentMatch,
  validateStudentIdForNewEntry
} from './studentId'
import { validateAcademicYearFormat } from './academicYears'
import { validatePdfFile, validateReplacementFile } from './fileSignatures'
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
  ChevronDownIcon,
  BellIcon
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
  { label: 'Recent activity', icon: ClockIcon, count: null, action: 'recent' },
  { label: 'Dashboard', icon: HomeIcon, count: null, action: 'dashboard' },
  { label: 'Shared with me', icon: BellIcon, count: null, action: 'shared' },
  { label: 'Trash', icon: TrashIcon, count: null, action: 'archive' }
]

const studentQuickAccess = [
  { label: 'Shared with me', icon: BellIcon, count: null, action: 'shared' },
  { label: 'Recent activity', icon: ClockIcon, count: null, action: 'recent' },
  { label: 'Dashboard', icon: HomeIcon, count: null, action: 'dashboard' },
  { label: 'Trash', icon: TrashIcon, count: null, action: 'archive' }
]

const staffQuickAccess = [
  { label: 'Recent activity', icon: ClockIcon, count: null, action: 'recent' },
  { label: 'Dashboard', icon: HomeIcon, count: null, action: 'dashboard' },
  { label: 'Shared with me', icon: BellIcon, count: null, action: 'shared' },
  { label: 'Trash', icon: TrashIcon, count: null, action: 'archive' },
  { label: 'Browse Archive', icon: FolderIcon, count: null, action: 'browse' }
]

const adminQuickAccess = [
  { label: 'System Dashboard', icon: HomeIcon, count: null, action: 'dashboard' },
  { label: 'Shared with me', icon: BellIcon, count: null, action: 'shared' },
  { label: 'Trash', icon: TrashIcon, count: null, action: 'archive' },
  { label: 'Browse Archive', icon: FolderIcon, count: null, action: 'browse' }
]

const librarianQuickAccess = [
  { label: 'Library Dashboard', icon: HomeIcon, count: null, action: 'dashboard' },
  { label: 'Shared with me', icon: BellIcon, count: null, action: 'shared' },
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

const legacyDocumentTypeCategories = new Set([
  'REGISTRATION_FORM',
  'REINTEGRATION_FORM',
  'APPLICATION_DOCUMENTS'
])

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
    departments: ['Accounting', 'Management', 'Finance']
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

const SHARE_DESTINATIONS = [
  { value: 'EXAMINATION_OFFICER', label: 'Examination Office' },
  { value: 'HOD', label: 'Head of Department' },
  { value: 'LIBRARIAN', label: 'Librarian' },
  { value: 'STUDENT', label: 'Student' }
]

const SHARE_PERMISSIONS = [
  { value: 'VIEW_ONLY', label: 'View only', hint: 'Secure read-only viewer — no download, print, or copy' },
  { value: 'READ_ONLY', label: 'Read & download', hint: 'View and download files' },
  { value: 'WRITE', label: 'Write', hint: 'Upload files and create folders' },
  { value: 'EDIT', label: 'Edit', hint: 'Replace, rename, and modify items' }
]

const SHARE_EXPIRATION_OPTIONS = [
  { value: 'NEVER', label: 'No expiration' },
  { value: '7_DAYS', label: '7 days' },
  { value: '30_DAYS', label: '30 days' },
  { value: 'CUSTOM', label: 'Custom date' }
]

function getShareDestinations(role) {
  return SHARE_DESTINATIONS.filter((destination) => destination.value !== role)
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

function isToday(value) {
  if (!value) {
    return false
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return false
  }
  const now = new Date()
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
}

function groupActivitiesByRecency(entries) {
  const today = []
  const earlier = []
  for (const entry of entries || []) {
    if (isToday(entry.createdAt)) {
      today.push(entry)
    } else {
      earlier.push(entry)
    }
  }
  return { today, earlier }
}

function stripLibrarianReviewFolders(nodes) {
  return (nodes || []).flatMap((node) => {
    const code = String(node.code || '').toUpperCase()
    const name = String(node.name || '').trim().toLowerCase()
    if (code === 'LIB-FYP' || code.startsWith('LIB-FYP') || name === 'library fyp reviews') {
      return []
    }
    if (code.includes('-SHARED') || code === 'SHARED' || name === 'shared documents') {
      return []
    }
    return [{
      ...node,
      children: stripLibrarianReviewFolders(node.children || [])
    }]
  })
}

function isSemesterFolder(folder) {
  const code = String(folder?.code || '').toUpperCase()
  return code.includes('-SEM-') && !code.includes('-STU-')
}

function trimArchiveTreeToSemesters(nodes) {
  return (nodes || []).map((node) => {
    if (isSemesterFolder(node)) {
      return { ...node, children: [] }
    }
    return {
      ...node,
      children: trimArchiveTreeToSemesters(node.children || [])
    }
  })
}

function prepareStaffArchiveTree(nodes, userRole) {
  let tree = stripLibrarianReviewFolders(nodes || [])
  if (userRole === 'REGISTRAR' || userRole === 'LIBRARIAN') {
    tree = trimArchiveTreeToSemesters(tree)
  }
  return tree
}

function canAddAcademicYearRole(userRole) {
  return userRole === 'REGISTRAR'
    || userRole === 'LIBRARIAN'
    || userRole === 'EXAMINATION_OFFICER'
}

function usesStructureArchiveBrowse(userRole) {
  return isOfficeArchiveRole(userRole) || userRole === 'LIBRARIAN'
}

function usesSemesterFolderUpload(userRole) {
  return userRole === 'REGISTRAR'
    || userRole === 'EXAMINATION_OFFICER'
    || userRole === 'HOD'
    || userRole === 'LIBRARIAN'
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
    visibleCategories: []
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
    defaultCategory: '',
    visibleCategories: []
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
    visibleCategories: []
  }
}

function readAuthStorage() {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function loadStoredSession() {
  const storage = readAuthStorage()
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(AUTH_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveStoredSession(account) {
  const storage = readAuthStorage()
  if (!storage || !account) {
    return
  }
  storage.setItem(AUTH_SESSION_KEY, JSON.stringify(account))
  try {
    window.localStorage.removeItem(AUTH_SESSION_KEY)
  } catch {
    // ignore legacy storage cleanup failures
  }
}

async function refreshStoredSession(stored) {
  if (!stored?.id) {
    return stored
  }
  try {
    const profile = await getSessionProfile()
    saveStoredSession(profile)
    return profile
  } catch {
    return stored
  }
}

function formatDashboardError(message) {
  const text = String(message || '').trim()
  if (text.includes('not linked to a student ID') || text.includes('Student ID is required')) {
    return 'This student account is not linked to a student ID. Ask an administrator to add the student ID on the Users page, then sign out and sign in again.'
  }
  if (text.includes('Student profile not found') || text.includes('Faculty and department are required')) {
    return 'Your student profile is incomplete. Ask an administrator to set a valid student ID (for example 20251SENG041) on the Users page.'
  }
  if (text) {
    return `Unable to load dashboard data. (${text})`
  }
  return 'Dashboard data is unavailable until the API and database are reachable.'
}

function clearStoredSession() {
  const storage = readAuthStorage()
  if (storage) {
    storage.removeItem(AUTH_SESSION_KEY)
  }
  try {
    window.localStorage.removeItem(AUTH_SESSION_KEY)
  } catch {
    // ignore legacy storage cleanup failures
  }
}

function isMobileScanHash(hash = '') {
  return /^#\/mobile-scan\/[a-f0-9]+$/i.test(String(hash || ''))
}

function clearProtectedHash() {
  if (typeof window === 'undefined') {
    return
  }
  const hash = window.location.hash || ''
  if (!isMobileScanHash(hash) && hash) {
    window.location.hash = ''
  }
}

function findStudentDefaultFolders(nodes) {
  const official = (nodes || []).find((node) => {
    const code = String(node.code || '').toUpperCase()
    const name = String(node.name || '')
    return code.endsWith('-SOFF') || name === 'Official Documents'
  }) || null
  const projects = (nodes || []).find((node) => {
    const code = String(node.code || '').toUpperCase()
    const name = String(node.name || '')
    return code.endsWith('-SMY') || name === 'Final Year Project' || name === 'My Projects'
  }) || null
  const archive = (nodes || []).find((node) => {
    const code = String(node.code || '').toUpperCase()
    const name = String(node.name || '').toLowerCase()
    return code.endsWith('-SARC') || name === 'archive project'
  }) || null
  return { official, projects, archive }
}

function computeStudentFypCounts(dashboard) {
  const documents = dashboard?.recentFiles || []
  const projects = documents.filter((item) => item.category === 'FINAL_YEAR_PROJECT')
  const statusOf = (item) => String(item.status || '').toUpperCase()
  return {
    pending: projects.filter((item) => statusOf(item) === 'PENDING').length,
    rejected: projects.filter((item) => statusOf(item) === 'REJECTED').length,
    accepted: projects.filter((item) => statusOf(item) === 'APPROVED').length
  }
}

function childFolderBadgeCount(child, fypCounts) {
  const code = String(child?.code || '').toUpperCase()
  const name = String(child?.name || '').toLowerCase()
  if (code.includes('-PND') || name === 'pending') {
    return fypCounts.pending
  }
  if (code.includes('-REJ') || name === 'rejected') {
    return fypCounts.rejected
  }
  if (code.includes('-APR') || code.includes('-ACC') || name === 'accepted' || name === 'approved') {
    return fypCounts.accepted
  }
  return null
}

const studentFypStatusItems = [
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' }
]

function matchesFypStatusFolder(node, status) {
  const code = String(node?.code || '').toUpperCase()
  const name = String(node?.name || '').toLowerCase()
  if (status === 'pending') {
    return code.includes('-PND') || name === 'pending'
  }
  if (status === 'rejected') {
    return code.includes('-REJ') || name === 'rejected'
  }
  if (status === 'accepted') {
    return code.includes('-ACC') || code.includes('-APR') || name === 'accepted' || name === 'approved'
  }
  return false
}

function resolveStudentFypStatusFolder(defaults, status) {
  const children = defaults.projects?.children || []
  if (status === 'accepted') {
    return children.find((child) => matchesFypStatusFolder(child, status)) || defaults.archive || null
  }
  return children.find((child) => matchesFypStatusFolder(child, status)) || null
}

function fypStatusBadgeCount(status, fypCounts) {
  return fypCounts?.[status] ?? 0
}

const studentFolderMeta = {
  official: {
    label: 'Official Documents',
    description: 'Forms and records from registrar'
  },
  projects: {
    label: 'Final Year Project',
    description: 'Submit and track your project review',
    expandable: true
  },
  archive: {
    label: 'Archive project',
    description: 'Your approved archived copy'
  }
}

function findStudentPersonalFolderParent(nodes, studentNumber) {
  const { projects, official } = findStudentDefaultFolders(nodes)
  if (projects) {
    return projects
  }
  if (official) {
    return official
  }
  const marker = String(studentNumber || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  let studentRoot = null

  function walk(list) {
    for (const node of list || []) {
      const code = String(node.code || '').toUpperCase()
      const name = String(node.name || '')
      if (marker && code.includes(`-STU-${marker}`) && name === String(studentNumber)) {
        studentRoot = node
      }
      if (node.children?.length) {
        walk(node.children)
      }
    }
  }

  walk(nodes)
  return studentRoot
}

function canStudentCreateInFolder(folder) {
  if (!folder) {
    return false
  }
  const code = String(folder.code || '').toUpperCase()
  if (code.includes('-SARC') || code.includes('LIB-FYP')) {
    return false
  }
  return code.endsWith('-SOFF') || code.endsWith('-SMY')
}

function isStudentFinalYearProjectFolder(folder) {
  if (!folder) {
    return false
  }
  const code = String(folder.code || '').toUpperCase()
  const name = String(folder.name || '').trim().toLowerCase()
  return code.endsWith('-SMY') || code.endsWith('-SMY-PND') || name === 'final year project' || name === 'my projects'
}

function isPublishedArchiveFolder(folder) {
  if (!folder) {
    return false
  }
  const code = String(folder.code || '').toUpperCase()
  return code.includes('-FYP-PUB')
}

function isStudentOfficialDocumentsFolder(folder) {
  if (!folder) {
    return false
  }
  const code = String(folder.code || '').toUpperCase()
  const name = String(folder.name || '').trim().toLowerCase()
  return code.includes('-SOFF') || name === 'official documents'
}

function canStudentUploadInFolder(folder) {
  if (!folder) {
    return false
  }
  const code = String(folder.code || '').toUpperCase()
  if (code.includes('-SARC') || code.includes('LIB-FYP') || code.includes('-SMY')) {
    return false
  }
  return isStudentOfficialDocumentsFolder(folder)
}

function isArchiveProjectRootFolder(folder) {
  if (!folder) {
    return false
  }
  const code = String(folder.code || '').toUpperCase()
  const name = String(folder.name || '').trim().toLowerCase()
  return code.endsWith('-SARC') || name === 'archive project'
}

function isProjectProfileFolder(folder) {
  if (!folder) {
    return false
  }
  const code = String(folder.code || '').toUpperCase()
  return code.includes('-SARC-PRF-') || /(?:^|-)PRF-/.test(code)
}

function splitExternalLinks(value) {
  return String(value || '')
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatShortDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(new Date(value))
}

const NON_ADMIN_STAFF_ROLES = ['REGISTRAR', 'EXAMINATION_OFFICER', 'HOD', 'LIBRARIAN']
const OFFICE_ARCHIVE_ROLES = ['REGISTRAR', 'EXAMINATION_OFFICER', 'HOD']

function isNonAdminStaffRole(userRole) {
  return NON_ADMIN_STAFF_ROLES.includes(userRole)
}

function isOfficeArchiveRole(userRole) {
  return OFFICE_ARCHIVE_ROLES.includes(userRole)
}

function usesOfficeDashboardFormat(userRole) {
  return userRole === 'REGISTRAR'
    || userRole === 'HOD'
    || userRole === 'EXAMINATION_OFFICER'
    || userRole === 'LIBRARIAN'
}

function isFacultyFolder(folder) {
  const code = String(folder?.code || '').toUpperCase()
  return /^FAC-[A-Z0-9]+$/.test(code)
}

function isDepartmentFolder(folder) {
  const code = String(folder?.code || '').toUpperCase()
  return /^FAC-[A-Z0-9]+-DEPT-[A-Z0-9]+$/.test(code)
}

function isAcademicYearFolder(folder) {
  const code = String(folder?.code || '').toUpperCase()
  return /-AY-\d{8}$/.test(code)
}

function isSemesterOrDeeperFolder(folder) {
  const code = String(folder?.code || '').toUpperCase()
  return code.includes('-SEM-')
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
  // Registrar, Examination Office, HOD, and Librarian manage documents from semester level downward.
  if (usesStructureArchiveBrowse(userRole)) {
    return isSemesterOrDeeperFolder(parentFolder)
  }
  if (isNonAdminStaffRole(userRole)) {
    return !isDepartmentFolder(parentFolder)
  }
  return true
}

function isOfficeStructureBrowseOnly(folder, userRole) {
  return usesStructureArchiveBrowse(userRole) && !isSemesterOrDeeperFolder(folder)
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
  if (!folder || folder.parentId == null || folder.locked) {
    return false
  }
  if (isProtectedArchiveStructureFolder(folder)) {
    return false
  }
  if (userRole === 'STUDENT') {
    const code = String(folder.code || '').toUpperCase()
    if (code.endsWith('-SOFF') || code.endsWith('-SMY')) {
      return false
    }
    return code.includes('-MY-') && (code.includes('-SOFF') || code.includes('-SMY'))
  }
  return true
}

function canPasteIntoFolder(folder, userRole, studentNumber) {
  if (!folder || folder.id == null || folder.id < 1) {
    return false
  }
  if (userRole === 'STUDENT') {
    return canStudentCreateInFolder(folder)
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

function findFolderAncestors(nodes, folderId, trail = []) {
  for (const node of nodes || []) {
    const nextTrail = [...trail, node]
    if (Number(node.id) === Number(folderId)) {
      return nextTrail
    }
    const nested = findFolderAncestors(node.children, folderId, nextTrail)
    if (nested) {
      return nested
    }
  }
  return null
}

function isStudentWorkspaceFolder(folder) {
  if (!folder) {
    return false
  }
  const code = String(folder.code || '').toUpperCase()
  return code.includes('-STU-')
}

/** Pick the best navigable container for a match (project / student / semester / folder). */
function resolveSearchProjectContainer(folderId, archiveTree, fallbackName = 'Archive location') {
  const ancestors = findFolderAncestors(archiveTree, folderId)
  if (!ancestors?.length) {
    return {
      id: folderId,
      name: fallbackName,
      code: '',
      location: fallbackName
    }
  }

  const pick = (predicate) => {
    for (let index = ancestors.length - 1; index >= 0; index -= 1) {
      if (predicate(ancestors[index])) {
        return ancestors[index]
      }
    }
    return null
  }

  const container = pick(isProjectProfileFolder)
    || pick(isArchiveProjectRootFolder)
    || pick(isStudentFinalYearProjectFolder)
    || pick(isStudentOfficialDocumentsFolder)
    || pick(isStudentWorkspaceFolder)
    || pick(isSemesterOrDeeperFolder)
    || pick(isDepartmentFolder)
    || ancestors[ancestors.length - 1]

  return {
    id: container.id,
    name: container.name,
    code: container.code || '',
    location: formatFolderLocation(archiveTree, container.id) || container.name
  }
}

/**
 * Registrar search: collapse document/folder hits into whole archive locations
 * so one click opens the containing project/folder.
 */
function groupRegistrarSearchAsProjects(documents, folderMatches, archiveTree) {
  const projects = new Map()

  function ensureProject(container, seed = {}) {
    const key = String(container.id)
    if (!projects.has(key)) {
      projects.set(key, {
        id: `project-${container.id}`,
        kind: 'project',
        title: container.name,
        fileName: container.code || 'Archive location',
        folderId: container.id,
        folderName: container.name,
        location: container.location,
        department: container.location,
        studentNumber: seed.studentNumber || '',
        ownerName: seed.ownerName || '',
        category: 'PROJECT',
        modifiedAt: seed.modifiedAt || null,
        matchCount: 0,
        matchedLabels: []
      })
    }
    return projects.get(key)
  }

  for (const folderRow of folderMatches || []) {
    if (!folderRow?.folderId) {
      continue
    }
    const container = resolveSearchProjectContainer(folderRow.folderId, archiveTree, folderRow.title)
    const project = ensureProject(container)
    project.matchCount += 1
    if (folderRow.title && !project.matchedLabels.includes(folderRow.title)) {
      project.matchedLabels.push(folderRow.title)
    }
  }

  for (const document of documents || []) {
    if (!document?.folderId && !document?.studentNumber) {
      continue
    }
    const studentFolder = document.studentNumber
      ? findStudentFolderInTree(archiveTree, document.studentNumber)
      : null
    const targetFolderId = document.folderId || studentFolder?.id
    if (!targetFolderId) {
      continue
    }
    const container = resolveSearchProjectContainer(
      targetFolderId,
      archiveTree,
      document.folderName || document.title || 'Archive location'
    )
    const project = ensureProject(container, {
      studentNumber: document.studentNumber,
      ownerName: document.ownerName,
      modifiedAt: document.modifiedAt
    })
    project.matchCount += 1
    if (!project.studentNumber && document.studentNumber) {
      project.studentNumber = document.studentNumber
    }
    if (!project.ownerName && document.ownerName) {
      project.ownerName = document.ownerName
    }
    if (document.modifiedAt && (!project.modifiedAt || String(document.modifiedAt) > String(project.modifiedAt))) {
      project.modifiedAt = document.modifiedAt
    }
    const label = document.title || document.fileName
    if (label && !project.matchedLabels.includes(label)) {
      project.matchedLabels.push(label)
    }
  }

  return [...projects.values()].map((project) => {
    const preview = project.matchedLabels.slice(0, 2).join(' · ')
    const extra = project.matchedLabels.length > 2
      ? ` (+${project.matchedLabels.length - 2} more)`
      : ''
    return {
      ...project,
      fileName: project.matchCount === 1
        ? (preview || '1 match inside this location')
        : `${project.matchCount} matches${preview ? `: ${preview}${extra}` : ''}`
    }
  })
}

/**
 * Registrar search: matching documents first (best match on top),
 * then archive locations for quick navigation.
 */
function buildRegistrarSearchResults(documents, folderMatches, archiveTree, query) {
  const trimmed = String(query || '').trim().toLowerCase()
  const rankedDocuments = enrichResultsWithLocation(documents || [], archiveTree)
    .map((document) => {
      const fileName = String(document.fileName || '').toLowerCase()
      const title = String(document.title || '').toLowerCase()
      const studentNumber = String(document.studentNumber || '').toLowerCase()
      let score = 10
      if (fileName === trimmed || title === trimmed) {
        score = 100
      } else if (fileName.includes(trimmed) || title.includes(trimmed)) {
        score = 85
      } else if (studentNumber === trimmed) {
        score = 70
      } else if (studentNumber.includes(trimmed)) {
        score = 55
      }
      return {
        ...document,
        kind: 'document',
        _score: score
      }
    })
    .sort((left, right) => right._score - left._score || String(right.modifiedAt || '').localeCompare(String(left.modifiedAt || '')))
    .map(({ _score, ...document }) => document)

  const locations = groupRegistrarSearchAsProjects(documents, folderMatches, archiveTree)
  const documentFolderIds = new Set(rankedDocuments.map((document) => document.folderId).filter(Boolean))
  const extraLocations = locations.filter((location) => !documentFolderIds.has(location.folderId))

  return [...rankedDocuments, ...extraLocations]
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
const ACTIVITY_SEEN_KEY_PREFIX = 'auca-activity-seen-'

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

function loadSidebarPanelOpen(storageKey, defaultOpen = true) {
  if (typeof window === 'undefined') {
    return defaultOpen
  }
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw == null) {
      return defaultOpen
    }
    return raw !== 'false'
  } catch {
    return defaultOpen
  }
}

function activitySeenStorageKey(username) {
  return `${ACTIVITY_SEEN_KEY_PREFIX}${String(username || 'anon').trim().toLowerCase()}`
}

function loadActivitySeenAt(username) {
  if (typeof window === 'undefined' || !username) {
    return null
  }
  try {
    const raw = window.localStorage.getItem(activitySeenStorageKey(username))
    return raw || null
  } catch {
    return null
  }
}

function saveActivitySeenAt(username, iso) {
  if (typeof window === 'undefined' || !username || !iso) {
    return
  }
  try {
    window.localStorage.setItem(activitySeenStorageKey(username), iso)
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}

function latestActivityTimestamp(entries) {
  let latest = 0
  for (const entry of entries || []) {
    const time = entry?.createdAt ? new Date(entry.createdAt).getTime() : 0
    if (Number.isFinite(time) && time > latest) {
      latest = time
    }
  }
  return latest
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

function DashboardSessionMeta({ lastSignIn }) {
  return (
    <span className="dash-meta">
      <span className="dash-meta-date">{formatLongDate(new Date())}</span>
      {lastSignIn ? (
        <>
          <span className="dash-meta-sep" aria-hidden="true" />
          <span className="dash-meta-signin">Signed in {lastSignIn}</span>
        </>
      ) : null}
    </span>
  )
}

function todayInputValue() {
  const date = new Date()
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
}

function formatDisplayDate(isoDate) {
  const value = String(isoDate || todayInputValue()).trim()
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) {
    return value
  }
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function resolveFolderUploadPlacement(folder) {
  if (!folder) {
    return {
      faculty: '',
      department: '',
      academicYear: '',
      semester: '',
      semesterFolderId: null
    }
  }
  const chain = [
    ...(folder.breadcrumbs || []),
    { id: folder.id, name: folder.name, code: folder.code }
  ]
  let faculty = ''
  let department = ''
  let academicYear = ''
  let semester = ''
  let semesterFolderId = null
  for (const crumb of chain) {
    const code = String(crumb.code || '').toUpperCase()
    const name = String(crumb.name || '').trim()
    if (/^FAC-[A-Z0-9]+$/.test(code)) {
      faculty = name
    }
    if (/^FAC-[A-Z0-9]+-DEPT-[A-Z0-9]+$/.test(code)) {
      department = name
    }
    if (/-AY-\d{8}$/.test(code) || /^\d{4}-\d{4}$/.test(name)) {
      academicYear = name
    }
    if ((code.includes('-SEM-') && !code.includes('-STU-')) || /^\d{4}\/\d$/.test(name)) {
      semester = name
      semesterFolderId = crumb.id ?? null
    }
  }
  return { faculty, department, academicYear, semester, semesterFolderId }
}

function formatUploadPlacementSummary(placement) {
  return [
    placement?.faculty,
    placement?.department,
    placement?.academicYear,
    placement?.semester
  ].filter(Boolean).join(' / ')
}

function applyUploadPlacementContext(form, placement) {
  return {
    ...form,
    faculty: placement?.faculty || form.faculty,
    department: placement?.department || form.department,
    academicYear: placement?.academicYear || form.academicYear,
    semester: placement?.semester || form.semester
  }
}

function applyExistingStudentPlacement(form, profile) {
  if (!profile?.studentNumber) {
    return form
  }
  return {
    ...form,
    studentNumber: profile.studentNumber,
    studentName: profile.studentName || form.studentName,
    faculty: profile.faculty || form.faculty,
    department: profile.department || form.department,
    academicYear: profile.academicYear || form.academicYear,
    semester: profile.semester || form.semester
  }
}

function formatExistingStudentPlacement(profile) {
  return [
    profile?.faculty,
    profile?.department,
    profile?.academicYear,
    profile?.semester
  ].filter(Boolean).join(' / ')
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
  return studentCategoryByValue[value] || { value, label: value || '', summary: 'Student record' }
}

function isLegacyDocumentTypeCategory(category) {
  return legacyDocumentTypeCategories.has(String(category || '').toUpperCase())
}

function shouldShowDocumentCategoryLabel(category, context = {}) {
  if (!category || isLegacyDocumentTypeCategory(category)) {
    return false
  }
  if (isFinalYearProjectCategory(category) && !isFinalYearProjectDocumentView(context)) {
    return false
  }
  return true
}

function resolveUploadCategory(role, { usesPlacementUpload, isExamOfficer, isStudent }) {
  if (isStudent) {
    return 'FINAL_YEAR_PROJECT'
  }
  if (isExamOfficer) {
    return 'EXAMINATION_DOCUMENTS'
  }
  if (role === 'LIBRARIAN') {
    return 'FINAL_YEAR_PROJECT'
  }
  if (usesPlacementUpload && (role === 'REGISTRAR' || role === 'HOD')) {
    return null
  }
  const configured = roleDashboardConfig[role]?.defaultCategory
  return configured || null
}

function resolveCategoryChipLabel(category) {
  if (!shouldShowDocumentCategoryLabel(category)) {
    return 'Document'
  }
  return getCategoryMeta(category).label
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

function isFinalYearProjectCategory(value) {
  return String(value || '').toUpperCase() === 'FINAL_YEAR_PROJECT'
}

function isFinalYearProjectDocumentView(context = {}) {
  return Boolean(
    context.showArchiveGallery
    || context.showProfileHeader
    || context.inPublishedArchive
    || context.showFypSubmit
    || isStudentFinalYearProjectFolder(context.folder)
    || isPublishedArchiveFolder(context.folder)
  )
}

function stripFinalYearProjectLabel(text) {
  return String(text || '')
    .replace(/\s*[-–—|·]\s*Final Year Project/gi, '')
    .replace(/^Final Year Project\s*[-–—|·]\s*/i, '')
    .replace(/\s*Final Year Project\s*$/i, '')
    .trim()
}

function inferCategoryLabelFromTitle(title) {
  const normalized = String(title || '').trim().toLowerCase()
  if (!normalized) {
    return ''
  }
  for (const category of studentDocumentCategories) {
    if (isFinalYearProjectCategory(category.value)) {
      continue
    }
    if (normalized.includes(category.label.toLowerCase())) {
      return category.label
    }
  }
  return ''
}

function resolveExplorerDocumentCategoryLabel(document, context = {}) {
  const category = document?.category
  if (!shouldShowDocumentCategoryLabel(category, context)) {
    return ''
  }
  return getCategoryMeta(category).label
}

function stripPlacementMetadataFromTitle(text, document) {
  let result = stripFinalYearProjectLabel(String(text || '').trim())
  if (!result) {
    return ''
  }

  const segments = result.split(/\s*-\s*/).map((segment) => segment.trim()).filter(Boolean)
  if (!segments.length) {
    return ''
  }

  const categoryLabels = new Set(
    studentDocumentCategories
      .filter((category) => !isFinalYearProjectCategory(category.value))
      .map((category) => category.label.toLowerCase())
  )
  const studentNumber = String(document?.studentNumber || '').trim()
  const academicYear = String(document?.academicYear || '').trim()
  const semester = String(document?.semester || '').trim()

  const filtered = segments.filter((segment) => {
    const lower = segment.toLowerCase()
    if (categoryLabels.has(lower)) {
      return false
    }
    if (studentNumber && segment === studentNumber) {
      return false
    }
    if (academicYear && segment === academicYear) {
      return false
    }
    if (semester && segment === semester) {
      return false
    }
    if (/^\d{4}-\d{4}$/.test(segment)) {
      return false
    }
    if (/^\d{4}\/\d+$/.test(segment)) {
      return false
    }
    return true
  })

  return filtered.join(' - ').trim()
}

function humanizeFileName(fileName) {
  return String(fileName || '').trim().replace(/\.pdf$/i, '').trim()
}

function looksLikeRawFileName(value) {
  const text = String(value || '').trim()
  if (!text) {
    return true
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text)) {
    return true
  }
  if (/^\d+\.pdf$/i.test(text)) {
    return true
  }
  return false
}

function resolveExplorerDocumentTitle(document, context = {}) {
  const title = String(document?.title || '').trim()
  const fileName = String(document?.fileName || '').trim()
  let candidate = title

  if (title && fileName && title.toLowerCase().endsWith(` - ${fileName.toLowerCase()}`)) {
    candidate = title.slice(0, title.length - fileName.length - 3).trim()
  }

  candidate = stripPlacementMetadataFromTitle(candidate, document)
  if (candidate && !looksLikeRawFileName(candidate)) {
    return candidate
  }

  const fromFile = humanizeFileName(fileName)
  if (fromFile && !looksLikeRawFileName(fromFile)) {
    return fromFile
  }

  return 'Archived document'
}

function resolveExplorerDocumentFileLabel(document, context = {}) {
  const fileName = String(document?.fileName || '').trim()
  const displayTitle = resolveExplorerDocumentTitle(document, context)
  if (!fileName || looksLikeRawFileName(fileName)) {
    return ''
  }
  const normalizedTitle = displayTitle.toLowerCase()
  const normalizedFile = humanizeFileName(fileName).toLowerCase()
  if (normalizedTitle === normalizedFile || normalizedTitle === fileName.toLowerCase()) {
    return ''
  }
  return fileName
}

function resolveExplorerDocumentMetaLine(document) {
  const examMeta = buildDocumentMetaLine(document)
  if (examMeta) {
    return examMeta
  }

  const parts = []
  const studentNumber = String(document?.studentNumber || '').trim()
  if (studentNumber) {
    parts.push(studentNumber)
  }
  const ownerName = String(document?.ownerName || '').trim()
  if (ownerName && ownerName !== studentNumber) {
    parts.push(ownerName)
  }
  if (document?.modifiedAt) {
    parts.push(formatShortDate(document.modifiedAt))
  }
  return parts.join(' · ')
}

function resolveExplorerDocumentStatsLine(document, context = {}) {
  const parts = []
  if (document?.sizeBytes) {
    parts.push(formatBytes(document.sizeBytes))
  }
  if (document?.pageCount) {
    parts.push(`${document.pageCount} page${Number(document.pageCount) === 1 ? '' : 's'}`)
  }
  const fileLabel = resolveExplorerDocumentFileLabel(document, context)
  if (fileLabel) {
    parts.push(fileLabel)
  }
  return parts.join(' · ')
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

function SidebarTree({ nodes, activeFolderId, onOpenFolder, onDeleteFolder, onFolderContextMenu, expandedIds, onToggleExpand, allowDeleteFolder = true }) {
  return (
    <ul className="tree-list" role="tree">
      {nodes.map((node) => {
        const hasChildren = Boolean(node.children?.length)
        const isExpanded = expandedIds.has(node.id)
        const isSelected = node.id === activeFolderId
        const isAncestor = isAncestorOfActive(node, activeFolderId)
        const canDelete = allowDeleteFolder
          && node.parentId != null
          && !isProtectedArchiveStructureFolder(node)

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
                  allowDeleteFolder={allowDeleteFolder}
                />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function StudentWorkspaceNav({
  nodes,
  activeFolderId,
  fypCounts,
  fypTab = 'pending',
  isFolderRoute = false,
  onOpenFolder,
  onSelectFypStatus,
  onNotify
}) {
  const defaults = findStudentDefaultFolders(nodes)
  const [projectsExpanded, setProjectsExpanded] = useState(true)

  const folders = [
    { key: 'official', ...studentFolderMeta.official, node: defaults.official },
    { key: 'projects', ...studentFolderMeta.projects, node: defaults.projects },
    { key: 'archive', ...studentFolderMeta.archive, node: defaults.archive }
  ]

  useEffect(() => {
    const hasActiveStatusFolder = studentFypStatusItems.some((item) => {
      const target = resolveStudentFypStatusFolder(defaults, item.key)
      return target?.id && Number(activeFolderId) === Number(target.id)
    })
    if (hasActiveStatusFolder) {
      setProjectsExpanded(true)
    }
  }, [activeFolderId, defaults.projects])

  function openFolder(folder) {
    if (folder.node?.id) {
      onOpenFolder?.(folder.node.id)
      return
    }
    onNotify?.(`${folder.label} is still being prepared. Refresh the page if this persists.`)
  }

  function handleFypStatusClick(status) {
    onSelectFypStatus?.(status)
    const target = resolveStudentFypStatusFolder(defaults, status)
    if (target?.id) {
      onOpenFolder?.(target.id)
      return
    }
    const label = studentFypStatusItems.find((item) => item.key === status)?.label || 'Folder'
    onNotify?.(`${label} is not ready yet. Refresh the page if this persists.`)
  }

  function isFypStatusActive(status) {
    const target = resolveStudentFypStatusFolder(defaults, status)
    if (isFolderRoute && target?.id && Number(activeFolderId) === Number(target.id)) {
      return true
    }
    return !isFolderRoute && fypTab === status
  }

  return (
    <div className="sidebar-section student-folders-nav">
      <div className="section-head">
        <p className="eyebrow">My folders</p>
      </div>
      <div className="student-folders-nav-list">
        {folders.map((folder) => {
          const isActive = Boolean(folder.node?.id && Number(activeFolderId) === Number(folder.node.id))
          const childActive = folder.expandable && studentFypStatusItems.some((item) => {
            const target = resolveStudentFypStatusFolder(defaults, item.key)
            return target?.id && Number(activeFolderId) === Number(target.id)
          })
          const itemCount = folder.node?.itemCount ?? 0
          const isExpanded = folder.expandable ? projectsExpanded : false
          const fypAttentionCount = folder.expandable
            ? fypStatusBadgeCount('pending', fypCounts) + fypStatusBadgeCount('rejected', fypCounts)
            : 0

          return (
            <article
              key={folder.key}
              className={`student-folder-nav-item ${folder.expandable ? 'student-folder-nav-item-fyp' : ''} ${isActive || childActive ? 'active' : ''}`}
            >
              <div className={`student-folder-nav-row ${folder.expandable ? 'student-folder-nav-row-fyp' : ''}`}>
                {folder.expandable && folder.node?.id ? (
                  <button
                    type="button"
                    className="student-folder-nav-toggle"
                    aria-label={isExpanded ? 'Hide status folders' : 'Show status folders'}
                    aria-expanded={isExpanded}
                    onClick={(event) => {
                      event.stopPropagation()
                      setProjectsExpanded((current) => !current)
                    }}
                  >
                    <ChevronRightIcon className={`icon tiny tree-chevron ${isExpanded ? 'expanded' : ''}`} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="student-folder-nav-button"
                  onClick={() => openFolder(folder)}
                >
                  <span className="student-folder-nav-icon">
                    <FolderIcon className="icon folder" />
                  </span>
                  <span className="student-folder-nav-copy">
                    <strong>{folder.label}</strong>
                    <em>{folder.description}</em>
                  </span>
                  {folder.expandable && !isExpanded && fypAttentionCount > 0 ? (
                    <span className="student-folder-nav-count is-alert">{fypAttentionCount}</span>
                  ) : itemCount ? (
                    <span className="student-folder-nav-count">{itemCount}</span>
                  ) : null}
                </button>
              </div>

              {folder.expandable ? (
                <div className={`student-folder-nav-children-panel ${isExpanded ? 'is-open' : ''}`}>
                  <div className="student-folder-nav-children">
                    {studentFypStatusItems.map((statusItem) => {
                      const badge = fypStatusBadgeCount(statusItem.key, fypCounts)
                      const statusIsActive = isFypStatusActive(statusItem.key)
                      const isAlert = statusItem.key === 'rejected' && badge > 0
                      return (
                        <button
                          key={statusItem.key}
                          type="button"
                          className={`student-folder-nav-child student-fyp-status-row ${statusIsActive ? 'active' : ''}`}
                          aria-current={statusIsActive ? 'page' : undefined}
                          onClick={() => handleFypStatusClick(statusItem.key)}
                        >
                          <span className={`student-fyp-status-dot status-${statusItem.key}`} aria-hidden="true" />
                          <span className="student-folder-nav-child-label">{statusItem.label}</span>
                          {badge > 0 ? (
                            <span className={`student-folder-nav-count student-fyp-status-count ${isAlert ? 'is-alert' : ''}`}>{badge}</span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </div>
  )
}

function StudentDefaultFoldersNav(props) {
  return <StudentWorkspaceNav {...props} />
}

function ArchiveTreePanel({
  nodes,
  activeFolderId,
  onOpenFolder,
  onDeleteFolder,
  onFolderContextMenu,
  allowDeleteFolder = true,
  title = 'Archive Tree',
  collapsible = false,
  collapseStorageKey = 'auca-archive-tree-open',
  embedded = false
}) {
  const [expandedIds, setExpandedIds] = useState(() => collectDefaultExpandedIds(nodes))
  const [sectionOpen, setSectionOpen] = useState(() => loadSidebarPanelOpen(collapseStorageKey, true))

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

  function toggleSectionOpen() {
    setSectionOpen((current) => {
      const next = !current
      try {
        window.localStorage.setItem(collapseStorageKey, String(next))
      } catch {
        // ignore storage failures
      }
      return next
    })
  }

  if (embedded) {
    return (
      <div className="admin-office-tree-embedded">
        <div className="archive-tree-scroll archive-tree-scroll-embedded">
          <SidebarTree
            nodes={nodes}
            activeFolderId={activeFolderId}
            onOpenFolder={onOpenFolder}
            onDeleteFolder={onDeleteFolder}
            onFolderContextMenu={onFolderContextMenu}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
            allowDeleteFolder={allowDeleteFolder}
          />
        </div>
      </div>
    )
  }

  const treeContent = (
    <div className="archive-tree-scroll">
      <SidebarTree
        nodes={nodes}
        activeFolderId={activeFolderId}
        onOpenFolder={onOpenFolder}
        onDeleteFolder={onDeleteFolder}
        onFolderContextMenu={onFolderContextMenu}
        expandedIds={expandedIds}
        onToggleExpand={onToggleExpand}
        allowDeleteFolder={allowDeleteFolder}
      />
    </div>
  )

  if (!collapsible) {
    return (
      <div className="sidebar-section archive-tree">
        <div className="section-head archive-tree-head">
          <p className="eyebrow">{title}</p>
        </div>
        {treeContent}
      </div>
    )
  }

  return (
    <div className={`sidebar-section archive-tree sidebar-collapsible archive-tree-collapsible ${sectionOpen ? 'is-open' : 'is-collapsed'}`}>
      <button
        type="button"
        className="quick-access-toggle sidebar-collapsible-toggle archive-tree-head"
        aria-expanded={sectionOpen}
        onClick={toggleSectionOpen}
      >
        <span className="eyebrow">{title}</span>
        <span className={`quick-access-chevron ${sectionOpen ? 'is-open' : ''}`} aria-hidden="true">
          <ChevronDownIcon className="icon" />
        </span>
      </button>
      <div className={`quick-access-panel ${sectionOpen ? 'is-open' : ''}`}>
        <div className="sidebar-collapsible-body archive-tree-body">
          {treeContent}
        </div>
      </div>
    </div>
  )
}

function getRouteFromHash() {
  if (typeof window === 'undefined') {
    return { view: 'dashboard', folderId: null }
  }

  const hash = window.location.hash || ''
  const mobileScanMatch = hash.match(/^#\/mobile-scan\/([a-f0-9]+)$/i)
  if (mobileScanMatch) {
    return {
      view: 'mobile-scan',
      folderId: null,
      scanToken: mobileScanMatch[1]
    }
  }

  const folderMatch = hash.match(/^#\/folders\/(\d+)$/)
  if (folderMatch) {
    if (!loadStoredSession()) {
      return { view: 'dashboard', folderId: null }
    }
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
  if (String(path || '').includes('/folders/') && !loadStoredSession()) {
    window.location.hash = ''
    return
  }
  window.location.hash = path
}

function ActivityDot({ category }) {
  const tone = String(category || '').toUpperCase()
  return <span className={`activity-dot ${tone.toLowerCase()}`} />
}

function DashboardActivityRow({ entry }) {
  return (
    <tr>
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
  )
}

function DashboardActivityGroup({ label, entries }) {
  if (!entries?.length) {
    return null
  }
  return (
    <>
      <tr className="dash-activity-group-row">
        <td colSpan="4">{label}</td>
      </tr>
      {entries.map((entry) => (
        <DashboardActivityRow key={entry.id} entry={entry} />
      ))}
    </>
  )
}

function ProfileMenu({
  avatarLabel,
  departmentLabel,
  studentNumber,
  isStudent,
  storageUsedBytes,
  storageLimitBytes,
  storagePercent,
  onLogout,
  formatBytes
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) {
      return undefined
    }
    const closeMenu = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    window.addEventListener('click', closeMenu)
    return () => {
      window.removeEventListener('click', closeMenu)
    }
  }, [open])

  return (
    <div className="topbar-profile-wrap" ref={menuRef}>
      <button
        type="button"
        className={`topbar-profile-trigger profile-chip ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
      >
        <div className="avatar avatar-sm">{avatarLabel}</div>
        <div className="profile-copy">
          <strong className="topbar-profile-office">{departmentLabel}</strong>
        </div>
        <span className={`topbar-profile-chevron ${open ? 'is-open' : ''}`} aria-hidden="true">
          <ChevronDownIcon className="icon" />
        </span>
      </button>

      {open ? (
        <div className="topbar-profile-menu" role="menu">
          {isStudent && studentNumber ? (
            <div className="topbar-profile-meta">
              <p className="topbar-profile-id">Student ID: {studentNumber}</p>
            </div>
          ) : null}

          <div className="topbar-profile-storage">
            <p className="eyebrow">{isStudent ? 'Personal storage' : 'Department storage'}</p>
            <div className="storage-meter">
              <div className="storage-fill" style={{ width: `${storagePercent}%` }} />
            </div>
            <div className="storage-copy">
              <span>{formatBytes(storageUsedBytes)} used</span>
              <span>{formatBytes(storageLimitBytes)}</span>
            </div>
          </div>

          <button type="button" className="ghost-btn logout-btn topbar-profile-logout" onClick={onLogout}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}

function LoginScreen({ form, onChange, onSubmit, busy, error }) {
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
              UserName
            </label>
              <div className="auth-input-shell">
                <input
                  id="auth-username"
                  value={form.username}
                  onChange={(event) => onChange({ ...form, username: event.target.value })}
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
  hideConfirmButton = false,
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
            <select
              value={selectValue || ''}
              onChange={(event) => onSelectChange?.(event.target.value)}
              autoFocus={!inputLabel}
              disabled={busy}
            >
              {(selectOptions || []).map((option) => (
                <option key={option.value || 'empty'} value={option.value} disabled={option.disabled}>
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
          {hideConfirmButton ? null : (
            <button
              type="button"
              className={tone === 'danger' ? 'danger-btn' : 'primary-btn'}
              onClick={() => onConfirm?.(inputLabel ? inputValue : selectLabel ? selectValue : undefined)}
              disabled={busy || (inputLabel ? !String(inputValue || '').trim() : false) || (selectLabel ? !String(selectValue || '').trim() : false)}
            >
              {busy ? 'Working...' : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DocumentContextMenu({
  open,
  x,
  y,
  documentItem,
  busy,
  onOpenInNewWindow,
  onDownload,
  onClose
}) {
  if (!open || !documentItem) {
    return null
  }

  return (
    <div
      className="folder-context-menu document-context-menu"
      style={{ top: `${y}px`, left: `${x}px` }}
      role="menu"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        role="menuitem"
        disabled={busy}
        onClick={() => { onOpenInNewWindow?.(documentItem); onClose?.() }}
      >
        Open in viewer
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={busy}
        onClick={() => { onDownload?.(documentItem); onClose?.() }}
      >
        Download file
      </button>
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

function ExplorerStatusBadge({ status, userRole }) {
  const normalized = String(status || '').toUpperCase()
  // Registrar uploads go straight into the archive — do not show pending/approved chips.
  if (userRole === 'REGISTRAR') {
    return null
  }
  if (!normalized || normalized === 'APPROVED') {
    return null
  }
  const label = normalized
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
  onSubmitFinalYearProject,
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
  onArchivedChange,
  onReservationChange,
  reservationRefreshToken = 0,
  onOpenDocument,
  addressBarActions
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
  const [documentContextMenu, setDocumentContextMenu] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareTargetRole, setShareTargetRole] = useState('')
  const [sharePermission, setSharePermission] = useState('READ_ONLY')
  const [shareExpiration, setShareExpiration] = useState('NEVER')
  const [shareCustomExpiresAt, setShareCustomExpiresAt] = useState('')
  const [shareAllowReshare, setShareAllowReshare] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const shareDestinations = getShareDestinations(userRole)
  const isStudent = userRole === 'STUDENT'
  const inPublishedArchive = isStudent && isPublishedArchiveFolder(folder)
  // Registrar / Exam / HOD: browse shell above semester; document tools from semester down.
  // Department level also unlocks Download + Share so content can be mirrored across departments.
  const isStructureBrowseOnly = isOfficeStructureBrowseOnly(folder, userRole) && !isDepartmentFolder(folder)
  const showDepartmentShareTools = usesStructureArchiveBrowse(userRole) && isDepartmentFolder(folder)
  const canAddAcademicYear = canAddAcademicYearRole(userRole) && isDepartmentFolder(folder)
  const canCreateFolder = isStudent
    ? canStudentCreateInFolder(folder)
    : !isStructureBrowseOnly && !showDepartmentShareTools && canStaffCreateArchiveSubfolder(folder, userRole)
  const showFypSubmit = isStudent && isStudentFinalYearProjectFolder(folder)
  const canUpload = isStudent
    ? canStudentUploadInFolder(folder)
    : usesStructureArchiveBrowse(userRole)
      ? isSemesterOrDeeperFolder(folder)
      : !isProtectedArchiveStructureFolder(folder)
  const canDownload = isStudent
    ? true
    : usesStructureArchiveBrowse(userRole)
      ? (isSemesterOrDeeperFolder(folder) || isDepartmentFolder(folder))
      : !isProtectedArchiveStructureFolder(folder)
  const canShare = !isStudent && (
    usesStructureArchiveBrowse(userRole)
      ? (isSemesterOrDeeperFolder(folder) || isDepartmentFolder(folder))
      : !isProtectedArchiveStructureFolder(folder)
  )
  const canReplace = !isStudent && isSemesterOrDeeperFolder(folder)
  const canImport = !isStudent && isSemesterOrDeeperFolder(folder) && isOfficeArchiveRole(userRole)
  const canFilterDocuments = isOfficeArchiveRole(userRole)
    ? isSemesterOrDeeperFolder(folder)
    : !isStudent
  const replaceInputRef = useRef(null)
  const importInputRef = useRef(null)
  const [importBusy, setImportBusy] = useState(false)

  useEffect(() => {
    setSelectedFolderIds(new Set())
    setSelectedDocumentIds(new Set())
    setFilterOpen(false)
    setDocumentContextMenu(null)
  }, [folder?.id])

  useEffect(() => {
    if (!documentContextMenu) {
      return undefined
    }
    const close = () => setDocumentContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [documentContextMenu])

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

  async function handleDownloadDocument(documentItem) {
    if (!documentItem?.id || openingDocumentId) {
      return
    }

    setOpeningDocumentId(documentItem.id)
    try {
      await downloadDocument(documentItem.id)
      onNotify?.(`Downloading ${documentItem.fileName || documentItem.title || 'document'}...`)
    } catch (err) {
      onNotify?.(err.message || 'Unable to download document.')
    } finally {
      setOpeningDocumentId(null)
    }
  }

  async function handleOpenDocument(documentItem) {
    if (!documentItem?.id || openingDocumentId) {
      return
    }

    setOpeningDocumentId(documentItem.id)
    try {
      await onOpenDocument?.(documentItem.id, documentItem.title || documentItem.fileName)
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
    setSelectedFolderIds(new Set())
    setSelectedDocumentIds(new Set([documentItem.id]))
  }

  function handleDocumentContextMenu(event, documentItem) {
    event.preventDefault()
    event.stopPropagation()
    setSelectedFolderIds(new Set())
    setSelectedDocumentIds(new Set([documentItem.id]))
    setDocumentContextMenu({
      x: event.clientX,
      y: event.clientY,
      document: documentItem
    })
  }

  function handleDocumentKeyDown(event, documentItem) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSelectedFolderIds(new Set())
      setSelectedDocumentIds(new Set([documentItem.id]))
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
    const useStructureOrder = isFacultyFolder(folder) || isDepartmentFolder(folder) || isAcademicYearFolder(folder)
    if (sortBy === 'name' || useStructureOrder) {
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
    if (
      isFinalYearProjectCategory(document.category)
      && !isFinalYearProjectDocumentView({
        showArchiveGallery: isArchiveProjectRootFolder(folder),
        showProfileHeader: isProjectProfileFolder(folder),
        inPublishedArchive,
        showFypSubmit,
        folder
      })
    ) {
      return false
    }
    return true
  })

  const breadcrumbs = folder.breadcrumbs || []
  const showArchiveGallery = isArchiveProjectRootFolder(folder)
  const showProfileHeader = isProjectProfileFolder(folder)
  const profileDocument = showProfileHeader
    ? documents.find((document) => String(document.category || '').toUpperCase() === 'FINAL_YEAR_PROJECT') || documents[0] || null
    : null
  const documentsByFolderId = new Map(
    documents.map((document) => [Number(document.folderId), document])
  )
  const visibleDocumentsForGrid = showArchiveGallery ? [] : visibleDocuments
  const isEmpty = showArchiveGallery
    ? !visibleChildren.length
    : !visibleChildren.length && !visibleDocumentsForGrid.length
  const selectedDocuments = getSelectedDocuments(documents)
  const selectedFolders = getSelectedFolders(children)
  const selectionCount = selectedFolderIds.size + selectedDocumentIds.size
  const showExplorerFilter = !isStructureBrowseOnly && !showDepartmentShareTools
  const filterIsActive = filterType !== 'all' || sortBy !== 'modified'

  function handleAddAcademicYearClick() {
    openConfirm({
      title: 'Add academic year',
      message: `Add a new academic year under "${folder.name}". Default semesters will be created automatically (for example 2029/1, 2029/2, 2029/3).`,
      confirmLabel: 'Add year',
      inputLabel: 'Academic year',
      inputPlaceholder: '2029-2030',
      onConfirm: async (academicYear) => {
        const formatError = validateAcademicYearFormat(academicYear)
        if (formatError) {
          throw new Error(formatError)
        }
        const created = await addDepartmentAcademicYear(folder.id, String(academicYear).trim())
        onNotify?.(`Academic year "${created.name}" added with default semesters.`)
        await onDataChange?.()
        if (created?.id) {
          onOpenFolder?.(created.id)
        }
      }
    })
  }

  function handleNewFolderClick() {
    setNewFolderName('')
    openConfirm({
      title: 'Create new folder',
      message: isStudent
        ? `Create a personal folder inside "${folder.name}" for your project files?`
        : `Create a subfolder inside "${folder.name}". Name format: ${STAFF_FOLDER_NAME_HINT}.`,
      confirmLabel: 'Create folder',
      inputLabel: 'Folder name',
      inputPlaceholder: isStudent ? 'Enter folder name' : 'e.g. 20251SENG041',
      onConfirm: async (folderName) => {
        const trimmedName = String(folderName || '').trim()
        if (!trimmedName) {
          throw new Error('Please enter a folder name.')
        }
        if (!isStudent) {
          const namingError = validateStaffFolderName(trimmedName)
          if (namingError) {
            throw new Error(namingError)
          }
        }
        const finalName = isStudent ? trimmedName : normalizeStudentId(trimmedName)
        await createSubfolder(folder.id, finalName)
        onNotify?.(`Folder "${finalName}" created.`)
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

  async function runFolderImport(payload) {
    setImportBusy(true)
    try {
      const result = await importFolderArchive(folder.id, payload)
      const skippedNote = result.skippedCount
        ? ` ${result.skippedCount} item${result.skippedCount === 1 ? '' : 's'} skipped.`
        : ''
      onNotify?.(
        `Imported ${result.importedCount} document${result.importedCount === 1 ? '' : 's'} into "${folder.name}". `
        + `ZIP archives are unzipped here — open folders below to browse the real content.${skippedNote}`
      )
      await onDataChange?.()
    } catch (err) {
      onNotify?.(err.message || 'Import failed.')
    } finally {
      setImportBusy(false)
    }
  }

  async function collectDirectoryFiles(directoryHandle, parentPath = '') {
    const files = []
    const paths = []
    for await (const [name, handle] of directoryHandle.entries()) {
      const nextPath = parentPath ? `${parentPath}/${name}` : name
      if (handle.kind === 'directory') {
        const nested = await collectDirectoryFiles(handle, nextPath)
        files.push(...nested.files)
        paths.push(...nested.paths)
      } else if (handle.kind === 'file') {
        files.push(await handle.getFile())
        paths.push(nextPath)
      }
    }
    return { files, paths }
  }

  function isArchivePath(path) {
    const lower = String(path || '').toLowerCase()
    return lower.endsWith('.zip') || lower.endsWith('.jar') || lower.endsWith('.7z')
  }

  function isIgnoredImportPath(path) {
    const lower = String(path || '').toLowerCase()
    return lower.endsWith('.ds_store')
      || lower.endsWith('thumbs.db')
      || lower.includes('__macosx/')
  }

  function openImportFilePicker() {
    const input = importInputRef.current
    if (!input) {
      return
    }
    input.value = ''
    input.removeAttribute('webkitdirectory')
    input.removeAttribute('directory')
    input.accept = '.zip,application/zip,application/x-zip-compressed'
    input.multiple = false
    input.click()
  }

  function openImportFolderPicker() {
    const input = importInputRef.current
    if (!input) {
      return
    }
    input.value = ''
    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')
    input.removeAttribute('accept')
    input.multiple = true
    input.click()
  }

  async function pickImportFolder() {
    if (typeof window.showDirectoryPicker === 'function') {
      try {
        const directoryHandle = await window.showDirectoryPicker({ mode: 'read' })
        const collected = await collectDirectoryFiles(directoryHandle)
        if (!collected.files.length) {
          onNotify?.('The selected folder is empty.')
          return
        }
        if (collected.paths.some(isArchivePath)) {
          onNotify?.('Select a ZIP file directly instead of a folder that contains archives.')
          return
        }
        const importable = collected.files.filter((file, index) => !isIgnoredImportPath(collected.paths[index]))
        if (!importable.length) {
          onNotify?.('The selected folder does not contain any importable documents.')
          return
        }
        await runFolderImport({
          files: importable,
          paths: importable.map((file, index) => collected.paths[index])
        })
      } catch (error) {
        if (error?.name !== 'AbortError') {
          onNotify?.(error.message || 'Unable to read the selected folder.')
        }
      }
      return
    }
    openImportFolderPicker()
  }

  function startImportDocumentsPicker() {
    if (importBusy) {
      return
    }

    const input = importInputRef.current
    if (!input) {
      return
    }

    let selected = false
    const onWindowFocus = () => {
      window.removeEventListener('focus', onWindowFocus)
      window.setTimeout(async () => {
        if (selected || importBusy || input.files?.length) {
          return
        }
        await pickImportFolder()
      }, 400)
    }

    const onInputChange = async (event) => {
      selected = true
      window.removeEventListener('focus', onWindowFocus)
      input.removeEventListener('change', onInputChange)
      await handleImportInputSelected(event)
    }

    window.addEventListener('focus', onWindowFocus)
    input.addEventListener('change', onInputChange)
    openImportFilePicker()
  }

  function handleImportDocumentsClick() {
    if (importBusy) {
      return
    }

    openConfirm({
      title: 'Import documents',
      message: 'Import documents accepts a ZIP archive or folder. ZIP files are unzipped into this semester folder — student subfolders and documents appear here so you can navigate and open the real content without leaving the archive.',
      confirmLabel: 'Choose ZIP or folder',
      onConfirm: async () => {
        startImportDocumentsPicker()
      }
    })
  }

  async function handleImportInputSelected(event) {
    const fileList = Array.from(event.target.files || [])
    event.target.value = ''
    if (!fileList.length) {
      return
    }

    const singleZip = fileList.length === 1 && fileList[0].name.toLowerCase().endsWith('.zip')
    if (singleZip) {
      await runFolderImport({ archive: fileList[0] })
      return
    }

    const folderSelection = fileList.some((file) => {
      const path = String(file.webkitRelativePath || '')
      return path.includes('/')
    })
    if (folderSelection || fileList.length > 1) {
      if (fileList.some((file) => isArchivePath(file.webkitRelativePath || file.name))) {
        onNotify?.('Select a ZIP file directly instead of a folder that contains archives.')
        return
      }
      const importable = fileList.filter((file) => !isIgnoredImportPath(file.webkitRelativePath || file.name))
      if (!importable.length) {
        onNotify?.('The selected folder does not contain any importable documents.')
        return
      }
      await runFolderImport({
        files: importable,
        paths: importable.map((file) => file.webkitRelativePath || file.name)
      })
      return
    }

    onNotify?.('Select a ZIP archive or a folder with documents inside.')
  }

  function handleOpenSelectedFolder() {
    const targets = getSelectedFolders(children)
    if (targets.length === 1) {
      onOpenFolder?.(targets[0].id)
      return
    }
    if (targets.length > 1) {
      onNotify?.('Select one folder to open, or double-click a department to browse it.')
      return
    }
    if (children.length === 1) {
      onOpenFolder?.(children[0].id)
      return
    }
    onNotify?.(
      isFacultyFolder(folder)
        ? 'Select a department folder, then click Open — or double-click it to browse.'
        : isDepartmentFolder(folder)
          ? 'Select an academic year, then click Open — or double-click it to browse.'
          : isAcademicYearFolder(folder)
            ? 'Select a semester folder, then click Open — or double-click it to manage documents.'
            : 'Select a folder below, then click Open — or double-click it to browse deeper.'
    )
  }

  function handleDownloadClick() {
    const selectedDocs = selectedDocumentIds.size
      ? documents.filter((document) => selectedDocumentIds.has(document.id))
      : []
    const selectedFolderList = selectedFolderIds.size
      ? children.filter((child) => selectedFolderIds.has(child.id))
      : []

    if (!selectedDocs.length && !selectedFolderList.length) {
      openConfirm({
        title: 'Download folder ZIP',
        message: `Download "${folder.name}" as a ZIP file (including files in subfolders)? You can unzip it on your computer to open the files.`,
        confirmLabel: 'Download ZIP',
        onConfirm: async () => {
          await downloadFolderZip(folder.id)
          onNotify?.(`Downloaded "${folder.name}.zip". Unzip the file to browse its contents.`)
        }
      })
      return
    }

    openConfirm({
      title: 'Download selection as ZIP',
      message: `Download ${selectedDocs.length} document${selectedDocs.length === 1 ? '' : 's'}${selectedFolderList.length ? ` and ${selectedFolderList.length} folder${selectedFolderList.length === 1 ? '' : 's'}` : ''} as a ZIP file?`,
      confirmLabel: 'Download ZIP',
      onConfirm: async () => {
        await downloadFolderZip(
          folder.id,
          selectedDocs.map((document) => document.id),
          selectedFolderList.map((child) => child.id)
        )
        onNotify?.('Download started. Unzip the ZIP file to open the files inside.')
      }
    })
  }

  function handleShareClick() {
    if (!shareDestinations.length) {
      onNotify?.('No share destinations are available for your role.')
      return
    }
    if (!selectedFolderIds.size && !selectedDocumentIds.size) {
      onNotify?.('Select one or more folders or files to share.')
      return
    }
    setShareTargetRole(shareDestinations[0]?.value || '')
    setSharePermission('READ_ONLY')
    setShareExpiration('NEVER')
    setShareCustomExpiresAt('')
    setShareAllowReshare(false)
    setShareOpen(true)
  }

  async function handleShareConfirm() {
    if (!shareTargetRole) {
      onNotify?.('Choose who to share with.')
      return
    }
    if (!sharePermission) {
      onNotify?.('Choose a permission level.')
      return
    }
    if (shareExpiration === 'CUSTOM' && !shareCustomExpiresAt) {
      onNotify?.('Choose a custom expiration date.')
      return
    }
    const folderIds = [...selectedFolderIds]
    const documentIds = [...selectedDocumentIds]
    if (!folderIds.length && !documentIds.length) {
      onNotify?.('Select one or more folders or files to share.')
      return
    }
    setShareBusy(true)
    try {
      const result = await shareItems({
        targetRole: shareTargetRole,
        permission: sharePermission,
        folderIds,
        documentIds,
        expirationPreset: shareExpiration,
        expiresAt: shareExpiration === 'CUSTOM' ? shareCustomExpiresAt : null,
        allowReshare: shareAllowReshare
      })
      setShareOpen(false)
      setSelectedFolderIds(new Set())
      setSelectedDocumentIds(new Set())
      onNotify?.(result.message || `Shared with ${result.targetRoleLabel}.`)
      await onDataChange?.()
    } catch (err) {
      onNotify?.(err.message || 'Unable to share the selected items.')
    } finally {
      setShareBusy(false)
    }
  }

  function handleReplaceClick() {
    const selected = documents.filter((document) => selectedDocumentIds.has(document.id))
    if (selected.length !== 1) {
      onNotify?.('Select exactly one document to replace its file.')
      return
    }
    replaceInputRef.current?.click()
  }

  async function handleReplaceFileSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    const selected = documents.filter((document) => selectedDocumentIds.has(document.id))
    if (!file || selected.length !== 1) {
      return
    }
    const validation = await validateReplacementFile(file)
    if (!validation.ok) {
      onNotify?.(validation.message)
      return
    }
    const documentItem = selected[0]
    openConfirm({
      title: 'Replace document file',
      message: `Replace the file for "${documentItem.fileName || documentItem.title}" with "${file.name}"? The document record stays in this folder.`,
      confirmLabel: 'Replace file',
      onConfirm: async () => {
        await replaceDocumentFile(documentItem.id, file)
        onNotify?.(`Replaced file for "${documentItem.title || documentItem.fileName}".`)
        setSelectedDocumentIds(new Set())
        await onDataChange?.()
      }
    })
  }

  function handleFilterClick() {
    setFilterOpen((current) => !current)
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
                <p className="eyebrow">Share</p>
                <h2>
                  {selectionCount === 1
                    ? 'Share selected item'
                    : `Share ${selectionCount} selected items`}
                </h2>
              </div>
              <button type="button" className="ghost-icon" onClick={() => setShareOpen(false)} disabled={shareBusy}>
                <XIcon className="icon" />
              </button>
            </div>
            <p className="share-modal-lead">
              Choose who should receive these items. They will appear under Shared with me with the permission you set.
            </p>
            <p className="share-section-label">Share with</p>
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
            <p className="share-section-label">Permission</p>
            <div className="share-role-options">
              {SHARE_PERMISSIONS.map((option) => (
                <label key={option.value} className={`share-role-option ${sharePermission === option.value ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="share-permission"
                    value={option.value}
                    checked={sharePermission === option.value}
                    onChange={() => setSharePermission(option.value)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <em className="share-permission-hint">{option.hint}</em>
                  </span>
                </label>
              ))}
            </div>
            <p className="share-section-label">Access duration</p>
            <div className="share-role-options">
              {SHARE_EXPIRATION_OPTIONS.map((option) => (
                <label key={option.value} className={`share-role-option ${shareExpiration === option.value ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="share-expiration"
                    value={option.value}
                    checked={shareExpiration === option.value}
                    onChange={() => setShareExpiration(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            {shareExpiration === 'CUSTOM' ? (
              <label className="share-custom-date">
                <span>Expires on</span>
                <input
                  type="date"
                  value={shareCustomExpiresAt}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setShareCustomExpiresAt(event.target.value)}
                />
              </label>
            ) : null}
            <label className="share-reshare-option">
              <input
                type="checkbox"
                checked={shareAllowReshare}
                onChange={(event) => setShareAllowReshare(event.target.checked)}
              />
              <span>
                <strong>Allow recipient to re-share</strong>
                <em className="share-permission-hint">Recipients can forward these items to other departments unless this stays unchecked.</em>
              </span>
            </label>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setShareOpen(false)} disabled={shareBusy}>Cancel</button>
              <button type="button" className="primary-btn" onClick={handleShareConfirm} disabled={shareBusy || !shareTargetRole || !sharePermission}>
                {shareBusy ? 'Sharing...' : 'Share'}
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
        {addressBarActions ? (
          <div className="explorer-address-actions">
            {addressBarActions}
          </div>
        ) : null}
      </div>

      <div className="explorer-toolbar">
        <div className="explorer-toolbar-actions">
          {isStructureBrowseOnly ? (
            <>
              <button type="button" className="primary-btn explorer-tool-btn" onClick={handleOpenSelectedFolder}>
                <FolderIcon className="icon" />
                Open
              </button>
              <button type="button" className="ghost-btn explorer-tool-btn" onClick={onRefresh}>
                <RefreshIcon className="icon" />
                Refresh
              </button>
            </>
          ) : showDepartmentShareTools ? (
            <>
              <button type="button" className="primary-btn explorer-tool-btn" onClick={handleOpenSelectedFolder}>
                <FolderIcon className="icon" />
                Open
              </button>
              {canAddAcademicYear ? (
                <button type="button" className="ghost-btn explorer-tool-btn" onClick={handleAddAcademicYearClick}>
                  <FolderPlusIcon className="icon" />
                  Add academic year
                </button>
              ) : null}
              {canDownload ? (
                <button type="button" className="ghost-btn explorer-tool-btn" onClick={handleDownloadClick}>
                  <DownloadIcon className="icon" />
                  Download
                </button>
              ) : null}
              {canShare ? (
                <button type="button" className="ghost-btn explorer-tool-btn" onClick={handleShareClick}>
                  <ShareIcon className="icon" />
                  Share
                </button>
              ) : null}
              <button type="button" className="ghost-btn explorer-tool-btn" onClick={onRefresh}>
                <RefreshIcon className="icon" />
                Refresh
              </button>
            </>
          ) : (
            <>
              {canCreateFolder ? (
                <button type="button" className="ghost-btn explorer-tool-btn" onClick={handleNewFolderClick}>
                  <FolderPlusIcon className="icon" />
                  New folder
                </button>
              ) : null}
              {showFypSubmit ? (
                <button type="button" className="primary-btn explorer-tool-btn" onClick={() => onSubmitFinalYearProject?.()}>
                  <UploadIcon className="icon" />
                  Submit final year project
                </button>
              ) : canUpload ? (
                <button type="button" className="primary-btn explorer-tool-btn" onClick={handleUploadClick}>
                  <UploadIcon className="icon" />
                  Upload
                </button>
              ) : null}
              {canImport ? (
                <button
                  type="button"
                  className="ghost-btn explorer-tool-btn"
                  disabled={importBusy}
                  onClick={handleImportDocumentsClick}
                >
                  <FolderPlusIcon className="icon" />
                  {importBusy ? 'Importing…' : 'Import documents'}
                </button>
              ) : null}
              {canDownload ? (
                <button type="button" className="ghost-btn explorer-tool-btn" onClick={handleDownloadClick}>
                  <DownloadIcon className="icon" />
                  Download
                </button>
              ) : null}
              {canShare ? (
                <button type="button" className="ghost-btn explorer-tool-btn" onClick={handleShareClick}>
                  <ShareIcon className="icon" />
                  Share
                </button>
              ) : null}
              {canReplace ? (
                <button type="button" className="ghost-btn explorer-tool-btn" onClick={handleReplaceClick}>
                  <UploadIcon className="icon" />
                  Replace
                </button>
              ) : null}
              {showExplorerFilter ? (
                <button type="button" className="ghost-btn explorer-tool-btn" onClick={handleFilterClick}>
                  <FilterIcon className="icon" />
                  Filter{filterOpen || filterIsActive ? ' ✓' : ''}
                </button>
              ) : null}
              <button type="button" className="ghost-btn explorer-tool-btn" onClick={onRefresh}>
                <RefreshIcon className="icon" />
                Refresh
              </button>
              <input
                ref={replaceInputRef}
                type="file"
                accept="application/pdf,.pdf,application/zip,.zip"
                hidden
                onChange={handleReplaceFileSelected}
              />
              <input
                ref={importInputRef}
                type="file"
                hidden
              />
            </>
          )}
        </div>
        <div className="explorer-view-toggle">
          {!isStructureBrowseOnly && !showDepartmentShareTools ? (
            <button type="button" className="explorer-icon-btn" onClick={onOpenSearch} aria-label="Search archive">
              <SearchIcon className="icon" />
            </button>
          ) : null}
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
          <div className="explorer-filter-group">
            <span className="explorer-filter-group-label">Show</span>
            <div className="explorer-filter-group-options">
              {[
                { value: 'all', label: 'All items' },
                { value: 'folders', label: 'Folders only' },
                ...(canFilterDocuments
                  ? [
                    { value: 'documents', label: 'Documents only' },
                    ...(userRole === 'REGISTRAR'
                      ? []
                      : [
                        { value: 'approved', label: 'Approved' },
                        { value: 'pending', label: 'Pending' }
                      ])
                  ]
                  : [])
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
            </div>
          </div>
          <div className="explorer-filter-group">
            <span className="explorer-filter-group-label">Sort</span>
            <div className="explorer-filter-group-options">
              {[
                { value: 'modified', label: 'Last modified' },
                { value: 'name', label: 'Name' }
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`explorer-filter-chip ${sortBy === option.value ? 'active' : ''}`}
                  onClick={() => setSortBy(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="explorer-filter-close" onClick={() => setFilterOpen(false)}>
            Close
          </button>
        </div>
      ) : null}

      {selectionCount ? (
        <p className="explorer-selection-note">{selectionCount} item{selectionCount === 1 ? '' : 's'} selected</p>
      ) : isStructureBrowseOnly ? (
        <p className="explorer-hint">
          {isFacultyFolder(folder)
            ? 'Open a department, then an academic year and semester to manage documents.'
            : isDepartmentFolder(folder)
              ? (canAddAcademicYearRole(userRole)
                ? 'Add an academic year here, or open an existing year and semester to manage documents.'
                : 'Open an academic year, then a semester folder to upload, share, or manage documents.')
              : isAcademicYearFolder(folder)
                ? 'Open a semester folder to unlock New folder, Upload, Download, Share, Replace, and Filter.'
                : 'Browse into a semester folder to manage documents.'}
        </p>
      ) : showArchiveGallery ? (
        <p className="explorer-hint">
          Approved final year projects appear here as profiles. Reserve department books below, or open a profile to view your archived copy.
        </p>
      ) : showProfileHeader ? (
        <p className="explorer-hint">
          This is an accepted project profile created after librarian approval.
        </p>
      ) : inPublishedArchive ? (
        <p className="explorer-hint">
          Browse approved final year projects from your department. Reserve a book for a 20-minute slot (max 3 students per book) before downloading.
        </p>
      ) : visibleDocuments.length ? (
        <p className="explorer-hint">
          Click to select a document. Right-click for open and download options. <kbd>Ctrl</kbd>+click to multi-select for bulk download or delete.
        </p>
      ) : null}

      {showArchiveGallery && isStudent ? (
        <StudentArchiveBookReservationPanel
          studentNumber={studentNumber}
          refreshToken={reservationRefreshToken}
          onNotify={onNotify}
          onChanged={() => onReservationChange?.()}
        />
      ) : null}

      {showProfileHeader && profileDocument ? (
        <section className="project-profile-panel" aria-label="Accepted project profile">
          <ProjectCoverPhoto
            documentId={profileDocument.id}
            hasCoverPhoto={Boolean(profileDocument.hasCoverPhoto)}
            alt={`${profileDocument.ownerName || profileDocument.title || 'Student'} face photo`}
            className="project-profile-photo"
          />
          <div className="project-profile-copy">
            <p className="eyebrow">Accepted project profile</p>
            <h2>{profileDocument.title || folder.name}</h2>
            <p className="project-profile-meta">
              {[profileDocument.ownerName, profileDocument.studentNumber, profileDocument.department]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {profileDocument.description ? (
              <p className="project-profile-description">{profileDocument.description}</p>
            ) : null}
            <div className="project-profile-links">
              {profileDocument.githubUrl ? (
                <a href={profileDocument.githubUrl} target="_blank" rel="noreferrer">
                  GitHub repository
                </a>
              ) : null}
              {splitExternalLinks(profileDocument.externalLinks).map((link) => (
                <a key={link} href={link} target="_blank" rel="noreferrer">
                  {link}
                </a>
              ))}
            </div>
            <div className="project-profile-actions">
              <button type="button" className="primary-btn" onClick={() => handleOpenDocument(profileDocument)}>
                <DownloadIcon className="icon" />
                Open project ZIP
              </button>
              <span className="project-profile-status">Accepted · {formatShortDate(profileDocument.modifiedAt)}</span>
            </div>
          </div>
        </section>
      ) : null}

      <div
        className={`explorer-content ${viewMode === 'list' ? 'list-view' : 'grid-view'} ${showArchiveGallery ? 'project-profile-gallery' : ''}`}
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
        {showArchiveGallery
          ? visibleChildren.map((child) => {
            const project = documentsByFolderId.get(Number(child.id))
            return (
              <button
                key={child.id}
                type="button"
                className={`project-profile-card ${selectedFolderIds.has(child.id) ? 'selected' : ''}`}
                onClick={() => onOpenFolder?.(child.id)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  onFolderContextMenu?.(event, child)
                }}
              >
                <ProjectCoverPhoto
                  documentId={project?.id}
                  hasCoverPhoto={Boolean(project?.hasCoverPhoto)}
                  alt={`${project?.ownerName || child.name} face photo`}
                  className="project-profile-card-photo"
                />
                <div className="project-profile-card-copy">
                  <strong>{project?.title || child.name}</strong>
                  <span>
                    {[project?.ownerName, project?.studentNumber].filter(Boolean).join(' · ') || 'Accepted project'}
                  </span>
                  {project?.description ? (
                    <em>{project.description.length > 110 ? `${project.description.slice(0, 110)}…` : project.description}</em>
                  ) : (
                    <em>Open profile to view project details and files.</em>
                  )}
                  <span className="project-profile-card-meta">
                    Accepted · {formatShortDate(project?.modifiedAt)} · {formatBytes(project?.sizeBytes)}
                  </span>
                </div>
              </button>
            )
          })
          : visibleChildren.map((child) => (
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

        {visibleDocumentsForGrid.map((document) => {
          const documentViewContext = {
            showArchiveGallery,
            showProfileHeader,
            inPublishedArchive,
            showFypSubmit,
            folder
          }
          const displayTitle = resolveExplorerDocumentTitle(document, documentViewContext)
          const metaLine = resolveExplorerDocumentMetaLine(document)
          const statsLine = resolveExplorerDocumentStatsLine(document, documentViewContext)
          const categoryLabel = resolveExplorerDocumentCategoryLabel(document, documentViewContext)
          const docType = String(document.type || 'PDF').toUpperCase()

          return (
          <div
            key={document.id}
            role="button"
            tabIndex={0}
            className={`explorer-item explorer-file explorer-document-card ${selectedDocumentIds.has(document.id) ? 'selected' : ''} ${openingDocumentId === document.id ? 'opening' : ''}`}
            onClick={(event) => handleDocumentClick(event, document)}
            onContextMenu={(event) => handleDocumentContextMenu(event, document)}
            onKeyDown={(event) => handleDocumentKeyDown(event, document)}
            title="Click to select. Right-click for open and download."
          >
            <ExplorerStatusBadge status={document.status} userRole={userRole} />
            <div className="explorer-document-head">
              <span className="explorer-document-type">{docType}</span>
              {categoryLabel ? <span className="explorer-document-category">{categoryLabel}</span> : null}
            </div>
            <div className="explorer-document-body">
              <strong className="explorer-document-title">{displayTitle}</strong>
              {metaLine ? <span className="explorer-document-meta">{metaLine}</span> : null}
              {statsLine ? <span className="explorer-document-stats">{statsLine}</span> : null}
              {inPublishedArchive ? (
                <StudentBookReservationControls
                  documentId={document.id}
                  studentNumber={studentNumber}
                  documentStudentNumber={document.studentNumber}
                  category={document.category}
                  status={document.status}
                  inPublishedArchive={inPublishedArchive}
                  onNotify={onNotify}
                  onChanged={() => onReservationChange?.()}
                />
              ) : null}
            </div>
          </div>
          )
        })}

        {isEmpty ? (
          <div className="explorer-empty">
            <FolderIcon className="icon folder" />
            <strong>{filterType === 'all' ? 'This folder is empty' : 'No items match this filter'}</strong>
            <span>
              {showFypSubmit
                ? 'Use Submit final year project to start the guided 5-step upload.'
                : showArchiveGallery || showProfileHeader
                  ? 'Accepted project profiles will appear here after librarian approval.'
                  : canUpload
                    ? 'Upload a document or create a subfolder to get started.'
                    : 'Accepted project profiles will appear here after librarian approval.'}
            </span>
            {showFypSubmit ? (
              <button type="button" className="primary-btn" onClick={() => onSubmitFinalYearProject?.()}>
                <UploadIcon className="icon" />
                Submit final year project
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <DocumentContextMenu
        open={Boolean(documentContextMenu)}
        x={documentContextMenu?.x || 0}
        y={documentContextMenu?.y || 0}
        documentItem={documentContextMenu?.document}
        busy={Boolean(openingDocumentId)}
        onOpenInNewWindow={handleOpenDocument}
        onDownload={handleDownloadDocument}
        onClose={() => setDocumentContextMenu(null)}
      />
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

function GlobalSearchResults({ query, busy, results, studentProfile, onOpenDocument, onDownloadDocument, onOpenFolder, onClear, mode = 'documents' }) {
  const [documentContextMenu, setDocumentContextMenu] = useState(null)
  const [openingDocumentId, setOpeningDocumentId] = useState(null)

  useEffect(() => {
    if (!documentContextMenu) {
      return undefined
    }
    const close = () => setDocumentContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', close)
    }
  }, [documentContextMenu])

  async function handleOpenSearchDocument(documentId) {
    if (!documentId || openingDocumentId) {
      return
    }
    setOpeningDocumentId(documentId)
    try {
      await onOpenDocument?.(documentId)
    } finally {
      setOpeningDocumentId(null)
    }
  }

  async function handleDownloadSearchDocument(documentId) {
    if (!documentId || openingDocumentId) {
      return
    }
    setOpeningDocumentId(documentId)
    try {
      await onDownloadDocument?.(documentId)
    } finally {
      setOpeningDocumentId(null)
    }
  }

  if (!query) {
    return null
  }

  const isProjectMode = mode === 'projects' || mode === 'registrar'
  const isRegistrarMode = mode === 'registrar'
  const documentResults = (results || []).filter((row) => row.kind !== 'folder' && row.kind !== 'project')
  const locationResults = (results || []).filter((row) => row.kind === 'folder' || row.kind === 'project')
  const resultCount = results?.length || 0
  const documentCount = documentResults.length

  let summary = `${resultCount} match${resultCount === 1 ? '' : 'es'} for "${query}" across the archive`
  if (busy) {
    summary = 'Searching across departments...'
  } else if (studentProfile) {
    summary = `${studentProfile.documentCount} document${studentProfile.documentCount === 1 ? '' : 's'} for ${studentProfile.studentName || studentProfile.studentNumber}`
  } else if (isRegistrarMode) {
    if (documentCount > 0) {
      summary = `${documentCount} document${documentCount === 1 ? '' : 's'} matched "${query}" — open the file above, or jump to its folder`
    } else if (locationResults.length > 0) {
      summary = `No document matched "${query}", but ${locationResults.length} related location${locationResults.length === 1 ? '' : 's'} were found`
    } else {
      summary = `No document or folder matched "${query}"`
    }
  } else if (isProjectMode) {
    summary = `${resultCount} location${resultCount === 1 ? '' : 's'} match "${query}" — open one to jump there`
  }

  return (
    <section className="dash-panel global-search-panel">
      <div className="dash-panel-head">
        <div>
          <h2>{isRegistrarMode ? 'Archive search' : (isProjectMode ? 'Go to archive location' : 'Archive search')}</h2>
          <p>{summary}</p>
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
              <th>{isRegistrarMode ? 'Result' : (isProjectMode ? 'Location' : 'Item')}</th>
              <th>Student</th>
              <th>Type</th>
              <th>Location</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {busy ? (
              <tr>
                <td colSpan="5" className="empty-state">Searching...</td>
              </tr>
            ) : results?.length ? (
              results.map((fileRow) => {
                const isDocument = fileRow.kind !== 'folder' && fileRow.kind !== 'project'
                return (
                  <tr
                    key={fileRow.id}
                    className={`document-row ${isDocument ? 'search-hit-document' : ''}`}
                    onClick={() => {
                      if (!isDocument && fileRow.folderId) {
                        onOpenFolder?.(fileRow.folderId)
                      }
                    }}
                    onContextMenu={(event) => {
                      if (!isDocument) {
                        return
                      }
                      event.preventDefault()
                      setDocumentContextMenu({
                        x: event.clientX,
                        y: event.clientY,
                        document: {
                          id: fileRow.id,
                          fileName: fileRow.fileName,
                          title: fileRow.title
                        }
                      })
                    }}
                    title={isDocument ? 'Right-click for open and download options' : 'Open archive location'}
                  >
                    <td>
                      <div className="file-cell">
                        {isDocument ? (
                          <DocumentIcon className="icon doc" />
                        ) : (
                          <FolderIcon className="icon folder" />
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
                        <span className="muted-cell">
                          {isDocument ? (fileRow.ownerName || '-') : 'Archive location'}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="document-chip">
                        {fileRow.kind === 'project'
                          ? 'Folder'
                          : fileRow.kind === 'folder'
                            ? 'Folder'
                            : resolveCategoryChipLabel(fileRow.category)}
                      </span>
                    </td>
                    <td>
                      <span className="search-location-path" title={fileRow.location || fileRow.department || ''}>
                        {fileRow.location || fileRow.department || '-'}
                      </span>
                    </td>
                    <td>
                      <div className="archive-row-actions">
                        {isDocument ? (
                          <>
                            <button
                              type="button"
                              className="dash-text-btn"
                              disabled={openingDocumentId === fileRow.id}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleOpenSearchDocument(fileRow.id)
                              }}
                            >
                              Open file
                            </button>
                            <button
                              type="button"
                              className="dash-text-btn"
                              disabled={openingDocumentId === fileRow.id}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleDownloadSearchDocument(fileRow.id)
                              }}
                            >
                              Download
                            </button>
                          </>
                        ) : null}
                        {fileRow.folderId ? (
                          <button
                            type="button"
                            className="dash-text-btn"
                            onClick={(event) => {
                              event.stopPropagation()
                              onOpenFolder?.(fileRow.folderId)
                            }}
                          >
                            {isDocument ? 'Open folder' : 'Open'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan="5" className="empty-state">
                  {isRegistrarMode
                    ? `No document matched "${query}". Try a full file name, student ID, or folder name.`
                    : isProjectMode
                      ? 'No matching archive locations found. Try a student ID, folder name, or file title.'
                      : 'No matching folders or documents found under departments.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <DocumentContextMenu
        open={Boolean(documentContextMenu)}
        x={documentContextMenu?.x || 0}
        y={documentContextMenu?.y || 0}
        documentItem={documentContextMenu?.document}
        busy={Boolean(openingDocumentId)}
        onOpenInNewWindow={(documentItem) => handleOpenSearchDocument(documentItem.id)}
        onDownload={(documentItem) => handleDownloadSearchDocument(documentItem.id)}
        onClose={() => setDocumentContextMenu(null)}
      />
    </section>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
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
  const [settledSearchQuery, setSettledSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searchBusy, setSearchBusy] = useState(false)
  const [studentSearchProfile, setStudentSearchProfile] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [uploadSourceMode, setUploadSourceMode] = useState('file')
  const [studentFypWizardOpen, setStudentFypWizardOpen] = useState(false)
  const [studentFypEditId, setStudentFypEditId] = useState(null)
  const [studentFypTab, setStudentFypTab] = useState('pending')
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadBatchProgress, setUploadBatchProgress] = useState({ current: 0, total: 0 })
  const [dashboardView, setDashboardView] = useState('default')
  const [sharedItems, setSharedItems] = useState([])
  const [sharedBusy, setSharedBusy] = useState(false)
  const [sharedCount, setSharedCount] = useState(0)
  const [reservationRefreshToken, setReservationRefreshToken] = useState(0)
  const [documentViewer, setDocumentViewer] = useState(null)
  const [quickAccessOpen, setQuickAccessOpen] = useState(loadQuickAccessOpen)
  const [adminOffices, setAdminOffices] = useState(() => buildAdminOffices([], {}, []))
  const [selectedAdminOffice, setSelectedAdminOffice] = useState(null)
  const [adminOfficePanel, setAdminOfficePanel] = useState('tree')
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

  const handleDownloadDocumentById = useCallback(async (documentId) => {
    if (!documentId) {
      return
    }
    try {
      await downloadDocument(documentId)
      showNotice('Downloading document...')
    } catch (err) {
      showNotice(err.message || 'Unable to download document.')
    }
  }, [showNotice])

  const openDocumentPreview = useCallback((documentId, title, options = {}) => {
    if (!documentId) {
      return
    }
    setDocumentViewer({
      documentId,
      title: title || 'Document',
      sharedAccess: options.sharedAccess === true,
      sharePermission: options.sharePermission || '',
      sharePermissionLabel: options.sharePermissionLabel || '',
      allowDownload: options.sharedAccess ? options.allowDownload : undefined
    })
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
  const [approvalReviewTask, setApprovalReviewTask] = useState(null)
  const [approvalReviewNote, setApprovalReviewNote] = useState('')
  const [approvalReviewBusy, setApprovalReviewBusy] = useState(false)
  const [activities, setActivities] = useState([])
  const [activitiesBusy, setActivitiesBusy] = useState(false)
  const [route, setRoute] = useState(getRouteFromHash)
  const [folderDetail, setFolderDetail] = useState(null)
  const [folderLoading, setFolderLoading] = useState(false)
  const [folderError, setFolderError] = useState('')
  const folderNavRef = useRef({ stack: [], index: -1, skip: false })
  const [, setFolderNavTick] = useState(0)

  const [form, setForm] = useState(buildDefaultUploadForm)
  const [uploadQueue, setUploadQueue] = useState([])
  const roleConfig = getRoleDashboardConfig(session?.role)
  const visibleDocumentCategories = getVisibleDocumentCategories(session?.role)

  useEffect(() => {
    let active = true

    async function bootstrapAuth() {
      const stored = loadStoredSession()
      if (!stored) {
        clearProtectedHash()
        if (active) {
          setSession(null)
          setAuthChecked(true)
        }
        return
      }

      try {
        const sessionProfile = await refreshStoredSession(stored)
        await getDashboard()
        if (active) {
          setSession(sessionProfile)
        }
      } catch {
        clearStoredSession()
        clearProtectedHash()
        if (active) {
          setSession(null)
        }
      } finally {
        if (active) {
          setAuthChecked(true)
        }
      }
    }

    bootstrapAuth()
    return () => {
      active = false
    }
  }, [])

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
        let activeSession = session
        if (session.role === 'STUDENT' && !session.studentNumber && session.id) {
          activeSession = await refreshStoredSession(session)
          if (active && activeSession !== session) {
            setSession(activeSession)
          }
        }
        const data = await getDashboard()
        if (!active) return
        setDashboard(data)
        setError('')
      } catch (err) {
        if (!active) return
        if (session?.role === 'STUDENT' && session?.id) {
          try {
            const refreshed = await refreshStoredSession(session)
            if (refreshed?.studentNumber) {
              setSession(refreshed)
              const data = await getDashboard()
              if (!active) return
              setDashboard(data)
              setError('')
              return
            }
          } catch {
            // fall through to error state below
          }
        }
        setDashboard(emptyDashboard)
        setError(formatDashboardError(err?.message))
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

    const syncRoute = () => {
      if (!session) {
        clearProtectedHash()
      }
      setRoute(getRouteFromHash())
    }

    syncRoute()
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [session])

  useEffect(() => {
    if (!session) {
      setForm(buildDefaultUploadForm())
      setUploadQueue([])
      setUploadBatchProgress({ current: 0, total: 0 })
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
      category: usesSemesterFolderUpload(session.role) && (session.role === 'REGISTRAR' || session.role === 'HOD')
        ? ''
        : (roleConfig.defaultCategory || current.category),
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
    if (!session) {
      setSharedItems([])
      setSharedCount(0)
      return
    }

    let active = true
    async function loadShared() {
      try {
        const [items, countPayload] = await Promise.all([
          getSharedWithMe(),
          getSharedWithMeCount()
        ])
        if (!active) {
          return
        }
        setSharedItems(Array.isArray(items) ? items : [])
        setSharedCount(Number(countPayload?.count) || (Array.isArray(items) ? items.length : 0))
      } catch {
        if (active) {
          setSharedItems([])
          setSharedCount(0)
        }
      }
    }

    loadShared()
    return () => {
      active = false
    }
  }, [session, dashboardView])

  useEffect(() => {
    if (!session || session.role !== 'ADMIN') {
      setAdminOffices([])
      setSelectedAdminOffice(null)
      setAdminOfficesBusy(false)
      return
    }

    setAdminOffices(buildAdminOffices([], {}, []))

    let active = true
    async function loadAdminOffices(silent = false) {
      if (!silent) {
        setAdminOfficesBusy(true)
      }
      try {
        let adminData = { users: [], usersByRole: {} }
        let officeData = []
        try {
          adminData = await getAdminDashboard()
        } catch {
          // dashboard optional for office list fallback
        }
        try {
          officeData = await getAdminOffices()
        } catch {
          // offices API optional; buildAdminOffices still returns standard offices
        }
        if (!active) {
          return
        }
        const offices = buildAdminOffices(
          adminData?.users || [],
          adminData?.usersByRole || {},
          officeData || []
        )
        setAdminOffices(offices.length ? offices : buildAdminOffices([], {}, []))
        setSelectedAdminOffice((current) => {
          if (!current) {
            return null
          }
          return offices.some((office) => office.role === current) ? current : null
        })
      } catch {
        if (active && !silent) {
          setAdminOffices(buildAdminOffices([], {}, []))
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
      setSettledSearchQuery('')
      return
    }

    const liveQuery = searchQuery.trim()
    if (!liveQuery) {
      setSettledSearchQuery('')
      setSearchResults(null)
      setStudentSearchProfile(null)
      setSearchBusy(false)
      return
    }

    // Wait until typing settles so the best document match appears once the query is complete.
    setSearchBusy(true)
    setSearchResults(null)
    const timer = window.setTimeout(() => {
      setSettledSearchQuery(liveQuery)
    }, 450)
    return () => window.clearTimeout(timer)
  }, [searchQuery, session])

  useEffect(() => {
    if (!session) {
      setSearchResults(null)
      setStudentSearchProfile(null)
      setSearchBusy(false)
      return
    }

    if (!settledSearchQuery) {
      if (!searchQuery.trim()) {
        setSearchResults(null)
        setStudentSearchProfile(null)
        setSearchBusy(false)
      }
      return
    }

    let active = true
    async function loadSearch() {
      setSearchBusy(true)
      try {
        const archiveTree = dashboard?.archiveTree || []
        const folderMatches = searchArchiveTreeMatches(archiveTree, settledSearchQuery)
        const registrarMode = usesOfficeDashboardFormat(session.role)

        if (looksLikeStudentId(settledSearchQuery)) {
          try {
            const archive = await lookupStudent(settledSearchQuery)
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
              if (registrarMode) {
                const studentFolderMatch = archive.folderId
                  ? [{
                    id: `folder-${archive.folderId}`,
                    kind: 'folder',
                    title: archive.studentName || archive.studentNumber,
                    fileName: archive.studentNumber,
                    folderId: archive.folderId,
                    location: formatFolderLocation(archiveTree, archive.folderId) || archive.department || '',
                    studentNumber: archive.studentNumber,
                    ownerName: archive.studentName || '',
                    category: 'FOLDER'
                  }]
                  : folderMatches
                setSearchResults(buildRegistrarSearchResults(docs, studentFolderMatch, archiveTree, settledSearchQuery))
              } else {
                setSearchResults([...folderMatches, ...docs])
              }
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

        const data = await searchDocuments(settledSearchQuery)
        if (active) {
          const docs = enrichResultsWithLocation(data, archiveTree)
          if (registrarMode) {
            setSearchResults(buildRegistrarSearchResults(docs, folderMatches, archiveTree, settledSearchQuery))
          } else {
            const seenFolderIds = new Set(docs.map((row) => row.folderId).filter(Boolean))
            const uniqueFolders = folderMatches.filter((row) => !seenFolderIds.has(row.folderId))
            setSearchResults([...uniqueFolders, ...docs])
          }
        }
      } catch {
        if (active) {
          const archiveTree = dashboard?.archiveTree || []
          const folderMatches = searchArchiveTreeMatches(archiveTree, settledSearchQuery)
          setSearchResults(
            usesOfficeDashboardFormat(session.role)
              ? buildRegistrarSearchResults([], folderMatches, archiveTree, settledSearchQuery)
              : folderMatches
          )
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
  }, [settledSearchQuery, session, dashboard])

  useEffect(() => {
    if (session?.role !== 'STUDENT') {
      return
    }
    const rejectedCount = computeStudentFypCounts(dashboard ?? emptyDashboard).rejected
    if (rejectedCount > 0) {
      setStudentFypTab('rejected')
    }
  }, [session?.role, dashboard])

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
      saveStoredSession(account)
      const refreshed = await refreshStoredSession(account)
      setSession(refreshed)
      setLoginForm({
        username: refreshed.username || '',
        password: ''
      })
    } catch (err) {
      setAuthError(formatLoginError(err.message))
    } finally {
      setAuthBusy(false)
    }
  }

  function handleLogout() {
    clearStoredSession()
    if (typeof window !== 'undefined') {
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
    setUploadQueue([])
    setUploadBatchProgress({ current: 0, total: 0 })
    setRoute({ view: 'dashboard', folderId: null })
    setFolderDetail(null)
    setFolderError('')
    setFolderLoading(false)
  }

  if (route.view === 'mobile-scan' && route.scanToken) {
    return <MobileScanPage token={route.scanToken} />
  }

  if (!authChecked || !session) {
    return (
      <LoginScreen
        form={loginForm}
        onChange={setLoginForm}
        onSubmit={handleLogin}
        busy={authBusy || !authChecked}
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
  const rawActivities = activities.length ? activities : (data.departmentActivity || [])
  const dashboardActivities = rawActivities
    .filter((entry) => dashboardView !== 'recent' || isToday(entry.createdAt))
  const recentActivityCount = rawActivities
    .filter((entry) => isToday(entry.createdAt)).length
  const groupedDashboardActivities = groupActivitiesByRecency(dashboardActivities)
  const storagePercent = data.storageLimitBytes
    ? Math.min(100, (data.storageUsedBytes / data.storageLimitBytes) * 100)
    : 0
  const isExamOfficer = session.role === 'EXAMINATION_OFFICER'
  const usesPlacementUpload = usesSemesterFolderUpload(session.role)
  const isStudent = session.role === 'STUDENT'
  const isRegistrar = session.role === 'REGISTRAR'
  const isHod = session.role === 'HOD'
  const isLibrarian = session.role === 'LIBRARIAN'
  const isAdmin = session.role === 'ADMIN'
  const adminArchiveTree = isAdmin && selectedAdminOffice
    ? filterArchiveTreeForOffice(data.archiveTree || [], selectedAdminOffice)
    : []
  const adminArchiveTreeTitle = selectedAdminOffice
    ? `${adminOffices.find((office) => office.role === selectedAdminOffice)?.label || 'Office'} archive tree`
    : 'Archive Tree'
  const hideHeaderBrowse = usesOfficeDashboardFormat(session.role) || isLibrarian || isStudent
  const showOfficeDashboardFormat = usesOfficeDashboardFormat(session.role)
  const isStaffUser = !isStudent
  const isFolderRoute = route.view === 'folder'
  const showStaffDashboardSearch = showOfficeDashboardFormat && !isFolderRoute
  const hideFolderSearch = usesStructureArchiveBrowse(session.role) && !isSemesterOrDeeperFolder(folderDetail)
  const staffArchiveTree = prepareStaffArchiveTree(data.archiveTree || [], session.role)
  const activeFolderId = isFolderRoute ? route.folderId : null
  const folderNav = folderNavRef.current
  const canGoBackFolder = folderNav.index > 0
  const canGoForwardFolder = folderNav.index < folderNav.stack.length - 1
  const canGoUpFolder = Boolean(folderDetail?.parentId)
  const studentNeedsProfile = studentEntryMode === 'new'
    || Boolean(studentLookupResult && (!studentLookupResult.faculty || !studentLookupResult.department))
  const selectedDepartmentOptions = getDepartmentOptions(form.faculty)
  const archiveSemesterOptions = semesterOptionsForAcademicYear(form.academicYear)
  const uploadPlacement = usesPlacementUpload ? resolveFolderUploadPlacement(folderDetail) : null
  const uploadPlacementSummary = formatUploadPlacementSummary(uploadPlacement)
  const uploadScanContext = {
    studentNumber: normalizeStudentId(form.studentNumber),
    studentName: String(form.studentName || '').trim(),
    ...(resolveUploadCategory(session?.role, {
      usesPlacementUpload,
      isExamOfficer,
      isStudent
    })
      ? { category: resolveUploadCategory(session?.role, { usesPlacementUpload, isExamOfficer, isStudent }) }
      : {}),
    course: String(form.course || '').trim(),
    faculty: String(form.faculty || '').trim(),
    department: String(form.department || '').trim()
  }
  const uploadMaxFileSizeBytes = isStudent ? 5 * 1024 * 1024 : 10 * 1024 * 1024
  const verifiedUploadItems = uploadQueue.filter((item) => item.status === 'verified')
  const uploadQueueScanning = uploadQueue.some((item) => item.status === 'pending' || item.status === 'scanning')
  const uploadQueueRequiresStudentId = usesPlacementUpload && !normalizeStudentId(form.studentNumber)
  const effectiveUploadPlacementSummary = studentEntryMode === 'existing'
    ? formatUploadPlacementSummary({
        faculty: form.faculty,
        department: form.department,
        academicYear: form.academicYear,
        semester: form.semester
      })
    : uploadPlacementSummary

  async function handleDecision(taskId, decision, reviewNote = '') {
    try {
      setApprovalReviewBusy(true)
      let note = String(reviewNote || '').trim()
      if (decision === 'approve' && !note) {
        note = 'Approved by librarian'
      }
      if (decision === 'reject' && !note) {
        showNotice('Rejection feedback is required.')
        return
      }
      await decideApproval(taskId, decision, note)
      showNotice(decision === 'approve'
        ? 'Project approved. It was moved to the student Archive project and published for department reading.'
        : 'Project rejected. The student was notified and can revise from Final Year Project → Rejected.')
      setApprovalReviewTask(null)
      setApprovalReviewNote('')
      const fresh = await getDashboard()
      setDashboard(fresh)
    } catch (err) {
      showNotice(err.message)
    } finally {
      setApprovalReviewBusy(false)
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
        if (usesPlacementUpload) {
          setStudentLookupResult(null)
          setStudentLookupQuery(trimmed)
          setStudentEntryMode('new')
          setStudentLookupError('')
          setStudentLookupInfo(
            uploadPlacementSummary
              ? `No archive found for ${trimmed}. Enter the student name to link this ID under ${uploadPlacementSummary}.`
              : `No archive found for ${trimmed}. Enter the student name to link this ID.`
          )
          if (populateForm) {
            setForm((current) => applyUploadPlacementContext({
              ...current,
              studentNumber: trimmed,
              studentName: ''
            }, uploadPlacement))
          }
          return null
        }
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
        academicYear: data.academicYear,
        semester: data.semester,
        folderId: data.folderId,
        documentCount: data.documentCount || 0,
        documents: data.documents || []
      }
      setStudentLookupResult(profile)
      setStudentLookupQuery(trimmed)
      setStudentEntryMode('existing')
      setStudentLookupError('')
      const existingPlacement = formatExistingStudentPlacement(profile)
      setStudentLookupInfo(
        existingPlacement
          ? `Existing student found. Upload will go to ${existingPlacement}.`
          : ''
      )
      if (populateForm) {
        if (usesPlacementUpload) {
          setForm((current) => applyExistingStudentPlacement(current, profile))
        } else {
          setForm((current) => applyStudentIdDefaults({
            ...current,
            studentNumber: profile.studentNumber,
            studentName: profile.studentName || current.studentName,
            faculty: profile.faculty || current.faculty || '',
            department: profile.department || current.department || ''
          }, profile.studentNumber))
        }
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

  async function refreshSharedWithMe() {
    try {
      const [items, countPayload] = await Promise.all([
        getSharedWithMe(),
        getSharedWithMeCount()
      ])
      setSharedItems(Array.isArray(items) ? items : [])
      setSharedCount(Number(countPayload?.count) || (Array.isArray(items) ? items.length : 0))
    } catch {
      setSharedItems([])
      setSharedCount(0)
    }
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
      await refreshSharedWithMe()
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
      const defaults = findStudentDefaultFolders(data.archiveTree || [])
      const activeFolderAllowed = folderDetail && canStudentCreateInFolder(folderDetail)
      if (activeFolderAllowed) {
        parentId = folderDetail.id
        parentName = folderDetail.name
      } else if (defaults.projects?.id) {
        parentId = defaults.projects.id
        parentName = defaults.projects.name
      } else if (defaults.official?.id) {
        parentId = defaults.official.id
        parentName = defaults.official.name
      }
    } else {
      const parentNode = folderDetail?.id === activeFolderId
        ? folderDetail
        : (activeFolderId ? findFolderNode(data.archiveTree || [], activeFolderId) : null)
      if (!parentNode) {
        showNotice('Select a semester folder in the archive tree first.')
        return
      }
      if (!canStaffCreateArchiveSubfolder(parentNode, session.role)) {
        if (isOfficeArchiveRole(session.role) && !isSemesterOrDeeperFolder(parentNode)) {
          showNotice('Open a semester folder first. Document tools unlock from semester level downward.')
        } else if (isDepartmentFolder(parentNode) && !isAdmin) {
          showNotice('Only administrators can create folders directly under a department. Open a semester folder instead.')
        } else if (isFacultyFolder(parentNode)) {
          showNotice('Folders cannot be created under a faculty. Open a department, year, then semester instead.')
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
        ? 'Open Official Documents or Final Year Project first, then create a subfolder inside one of them.'
        : 'No archive folder is available yet.')
      return
    }

    setAppConfirmInput('')
    setAppConfirm({
      title: 'Create new folder',
      message: isStudent
        ? `Create a subfolder inside "${parentName}". The default folders themselves cannot be renamed or deleted.`
        : `Create a subfolder inside "${parentName}". Name format: ${STAFF_FOLDER_NAME_HINT}.`,
      confirmLabel: 'Create folder',
      inputLabel: 'Folder name',
      inputPlaceholder: isStudent ? 'Enter folder name' : 'e.g. 20251SENG041',
      onConfirm: async (folderName) => {
        const trimmedName = String(folderName || '').trim()
        if (!trimmedName) {
          throw new Error('Please enter a folder name.')
        }
        if (!isStudent) {
          const namingError = validateStaffFolderName(trimmedName)
          if (namingError) {
            throw new Error(namingError)
          }
        }
        const finalName = isStudent ? trimmedName : normalizeStudentId(trimmedName)
        await createSubfolder(parentId, finalName)
        if (isFolderRoute) {
          await reloadFolder()
        }
        const fresh = await getDashboard()
        setDashboard(fresh)
        showNotice(`Folder "${finalName}" created.`)
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
      .filter((candidate) => canPasteIntoFolder(candidate, session.role, session.studentNumber))

    if (!destinations.length) {
      showNotice('No destination folders are available for this move.')
      return
    }

    setAppConfirmInput('')
    setAppConfirmSelect('')
    setAppConfirm({
      title: 'Move folder',
      message: `Select where to move "${folder.name}". It will be moved there immediately.`,
      confirmLabel: 'Move here',
      selectLabel: 'Destination folder',
      hideConfirmButton: true,
      autoConfirmOnSelect: true,
      selectOptions: [
        { value: '', label: 'Choose destination folder...', disabled: true },
        ...destinations.map((destination) => ({
          value: String(destination.id),
          label: destination.path
        }))
      ],
      onConfirm: async (targetId) => {
        const destinationId = Number(targetId)
        if (!destinationId) {
          throw new Error('Choose a destination folder.')
        }
        const destination = destinations.find((item) => Number(item.id) === destinationId)
        await moveFolder(folder.id, destinationId)
        setFolderClipboard(null)
        if (activeFolderId === folder.id) {
          openFolder(destinationId)
        }
        await refreshExplorerData()
        showNotice(`Moved "${folder.name}" into "${destination?.name || 'the selected folder'}".`)
      }
    })
  }

  async function handlePasteFolder(targetFolder) {
    if (!folderClipboard) {
      return
    }

    const { mode, folderId, folderName } = folderClipboard
    const blockedIds = collectDescendantFolderIds(data.archiveTree || [], folderId)
    if (blockedIds.has(targetFolder.id)) {
      showNotice('A folder cannot be moved or pasted into itself or one of its subfolders.')
      return
    }

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
    if (action === 'shared') {
      setDashboardView('shared')
      setSelectedAdminOffice(null)
      setSelectedCategory('')
      setSearchQuery('')
      setStudentSearchProfile(null)
      setSearchResults(null)
      setSharedBusy(true)
      getSharedWithMe()
        .then((items) => {
          setSharedItems(Array.isArray(items) ? items : [])
          setSharedCount(Array.isArray(items) ? items.length : 0)
        })
        .catch(() => {
          setSharedItems([])
          setSharedCount(0)
        })
        .finally(() => setSharedBusy(false))
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
      return
    }
    if (action === 'submit-fyp') {
      setStudentFypEditId(null)
      setStudentFypWizardOpen(true)
    }
  }

  function openAdminOffice(role) {
    setSelectedAdminOffice(role)
    setAdminOfficePanel('tree')
    setDashboardView('default')
    setSearchQuery('')
    setStudentSearchProfile(null)
    setSearchResults(null)
    navigateToDashboard()
  }

  const sidebarQuickAccess = isAdmin
    ? adminQuickAccess
    : isStudent
      ? studentQuickAccess
      : isLibrarian
        ? librarianQuickAccess
        : isStaffUser
          ? staffQuickAccess
          : []
  const studentFypCounts = isStudent ? computeStudentFypCounts(data) : { pending: 0, rejected: 0, accepted: 0 }
  const librarianPendingCount = isLibrarian
    ? (data.awaitingApproval || []).filter((task) => String(task.status || '').toUpperCase() === 'PENDING').length
    : 0

  function handleSelectStudentFypStatus(status) {
    setStudentFypTab(status)
    setDashboardView('default')
    setSelectedAdminOffice(null)
    setSelectedCategory('')
    setSearchQuery('')
    setStudentSearchProfile(null)
    setSearchResults(null)
    navigateToDashboard()
  }

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
    await refreshSharedWithMe()
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

  function clearUploadQueue() {
    setUploadQueue([])
  }

  function appendPhoneImportToQueue(importedFile, pageCount) {
    if (!importedFile) {
      return
    }
    setUploadQueue([{
      id: crypto.randomUUID(),
      file: importedFile,
      status: 'pending',
      scanResult: null,
      scanError: '',
      pageCount: pageCount || null,
      uploadError: ''
    }])
  }

  function openUploadModal() {
    const placement = usesPlacementUpload ? resolveFolderUploadPlacement(folderDetail) : null
    if (usesPlacementUpload) {
      if (!placement?.faculty || !placement?.department || !placement?.academicYear || !placement?.semester) {
        showNotice('Open a semester folder under a department to upload. Documents follow the folder you are viewing.')
        return
      }
    }
    setUploadSourceMode('file')
    setUploadBatchProgress({ current: 0, total: 0 })
    clearUploadQueue()
    setStudentLookupResult(null)
    setStudentLookupError('')
    setStudentLookupInfo('')
    setStudentEntryMode('idle')
    setForm({
      ...buildDefaultUploadForm(),
      category: resolveUploadCategory(session?.role, {
        usesPlacementUpload,
        isExamOfficer,
        isStudent: session?.role === 'STUDENT'
      }) || '',
      uploadedBy: session?.fullName || session?.username || '',
      faculty: placement?.faculty || '',
      department: placement?.department || '',
      academicYear: placement?.academicYear || '',
      semester: placement?.semester || '',
      issueDate: todayInputValue()
    })
    setModalOpen(true)
  }

  function closeUploadModal() {
    setModalOpen(false)
    setUploadSourceMode('file')
    setUploadBatchProgress({ current: 0, total: 0 })
    clearUploadQueue()
  }

  async function handleUpload(event) {
    event.preventDefault()
    if (!verifiedUploadItems.length) {
      showNotice('Add at least one verified PDF to upload.')
      return
    }
    if (uploadQueueScanning) {
      showNotice('Please wait while documents are being scanned.')
      return
    }
    if (isStudent && (!session.studentNumber || !session.fullName)) {
      showNotice('Your student profile is incomplete. Contact the registrar office.')
      return
    }
    if (!isStudent && !usesPlacementUpload) {
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
    if (usesPlacementUpload) {
      const normalizedId = normalizeStudentId(form.studentNumber)
      if (!normalizedId) {
        showNotice('Student ID is required.')
        return
      }
    }
    if (studentNeedsProfile && !usesPlacementUpload && (!form.faculty || !form.department)) {
      showNotice('Please select the faculty and department for this new student entry.')
      return
    }
    if (usesPlacementUpload && studentEntryMode === 'new' && !String(form.studentName || '').trim()) {
      showNotice('Enter the student name to link this new student ID.')
      return
    }
    if (usesPlacementUpload && (!form.faculty || !form.department || !form.academicYear || !form.semester)) {
      showNotice('Upload placement could not be determined. Open a semester folder under a department and try again.')
      return
    }

    const itemsToUpload = [...verifiedUploadItems]
    setUploadBusy(true)
    setUploadBatchProgress({ current: 0, total: itemsToUpload.length })

    let uploadedCount = 0
    let failedCount = 0
    let lastUploaded = null

    try {
      const studentNumber = normalizeStudentId(form.studentNumber)

      for (let index = 0; index < itemsToUpload.length; index += 1) {
        const item = itemsToUpload[index]
        setUploadBatchProgress({ current: index + 1, total: itemsToUpload.length })
        setUploadQueue((current) => current.map((queueItem) => (
          queueItem.id === item.id ? { ...queueItem, status: 'uploading', uploadError: '' } : queueItem
        )))

        try {
          const resolvedPageCount = Number(item.pageCount || item.scanResult?.pageCount || form.pageCount) || 1
          const distinctTitle = item.file.name
          const uploadCategory = resolveUploadCategory(session?.role, {
            usesPlacementUpload,
            isExamOfficer,
            isStudent
          })
          const payload = usesPlacementUpload
            ? {
                studentNumber,
                studentName: form.studentName,
                faculty: form.faculty,
                department: form.department,
                uploadedBy: form.uploadedBy,
                pageCount: resolvedPageCount,
                academicYear: String(form.academicYear || '').trim() || null,
                semester: String(form.semester || '').trim() || null,
                issueDate: todayInputValue(),
                title: distinctTitle,
                description: null,
                tags: null,
                examType: isExamOfficer ? '' : null,
                course: isExamOfficer ? '' : null,
                marks: isExamOfficer ? null : null,
                examRoom: isExamOfficer ? '' : null
              }
            : {
                ...form,
                studentNumber,
                title: distinctTitle,
                pageCount: resolvedPageCount,
                marks: form.marks === '' ? null : Number(form.marks),
                academicYear: isStudent ? null : String(form.academicYear || '').trim() || null,
                semester: isStudent ? null : String(form.semester || '').trim() || null
              }
          if (uploadCategory) {
            payload.category = uploadCategory
          } else {
            delete payload.category
          }

          const uploaded = await submitUpload(payload, item.file)
          uploadedCount += 1
          lastUploaded = uploaded
          setUploadQueue((current) => current.map((queueItem) => (
            queueItem.id === item.id ? { ...queueItem, status: 'uploaded', uploadError: '' } : queueItem
          )))
        } catch (err) {
          failedCount += 1
          setUploadQueue((current) => current.map((queueItem) => (
            queueItem.id === item.id
              ? { ...queueItem, status: 'failed', uploadError: err.message || 'Upload failed.' }
              : queueItem
          )))
        }
      }

      if (uploadedCount > 0) {
        const fresh = await getDashboard()
        setDashboard(fresh)
        if (isFolderRoute && route.folderId) {
          await reloadFolder()
        }
      }

      if (failedCount === 0) {
        showNotice(`${uploadedCount} document${uploadedCount === 1 ? '' : 's'} uploaded successfully.`)
        closeUploadModal()
        if (lastUploaded?.id) {
          const lastItem = itemsToUpload[itemsToUpload.length - 1]
          openDocumentPreview(lastUploaded.id, lastUploaded.title || lastItem?.file?.name || 'Document')
        }
      } else if (uploadedCount > 0) {
        showNotice(`${uploadedCount} uploaded, ${failedCount} failed. Remove or retry failed files.`)
      } else {
        showNotice('All uploads failed. Check the queue for details.')
      }
    } finally {
      setUploadBusy(false)
      setUploadBatchProgress({ current: 0, total: 0 })
    }
  }

  const profileMenu = (
    <ProfileMenu
      avatarLabel={avatarLabel}
      departmentLabel={departmentLabel}
      studentNumber={session.studentNumber}
      isStudent={isStudent}
      storageUsedBytes={data.storageUsedBytes}
      storageLimitBytes={data.storageLimitBytes}
      storagePercent={storagePercent}
      onLogout={handleLogout}
      formatBytes={formatBytes}
    />
  )

  return (
    <div className="app-shell">
      <div className="workspace">
        <aside className="sidebar sidebar-archive-layout">
          <div className="sidebar-brand-block">
            <BrandLogo />
          </div>

          {(isStaffUser || isStudent) ? (
            <div className={`sidebar-section sidebar-quick-access ${isStudent ? 'student-quick-access' : ''} ${quickAccessOpen ? 'is-open' : 'is-collapsed'}`}>
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
                      (item.action === 'dashboard' && dashboardView === 'default' && !selectedAdminOffice)
                      || (item.action === 'recent' && dashboardView === 'recent')
                      || (item.action === 'archive' && dashboardView === 'archive')
                      || (item.action === 'shared' && dashboardView === 'shared')
                    ) || (item.action === 'browse' && isFolderRoute)
                    const badgeCount = item.action === 'archive'
                      ? archiveList.length
                      : item.action === 'recent'
                        ? recentActivityCount
                        : item.action === 'shared'
                          ? sharedCount
                          : isStudent && item.action === 'dashboard'
                            ? studentFypCounts.rejected || null
                            : isLibrarian && item.action === 'dashboard'
                              ? librarianPendingCount
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
          ) : null}

          {!isAdmin && isStudent ? (
            <>
              {studentFypCounts.pending === 0 && studentFypCounts.rejected === 0 ? (
                <div className="sidebar-section student-sidebar-links">
                  <div className="section-head student-sidebar-links-head">
                    <p className="eyebrow">Workspace</p>
                  </div>
                  <div className="student-sidebar-links-list">
                    <button
                      type="button"
                      className="quick-link"
                      onClick={() => handleQuickAccess('submit-fyp')}
                    >
                      <UploadIcon className="icon" />
                      <span>Submit project</span>
                    </button>
                  </div>
                </div>
              ) : null}
              <StudentDefaultFoldersNav
                nodes={data.archiveTree || []}
                activeFolderId={activeFolderId}
                fypCounts={studentFypCounts}
                fypTab={studentFypTab}
                isFolderRoute={isFolderRoute}
                onOpenFolder={openFolder}
                onSelectFypStatus={handleSelectStudentFypStatus}
                onNotify={showNotice}
              />
            </>
          ) : null}

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
                    className={`office-link ${selectedAdminOffice === office.role ? 'active' : ''}`}
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

          {!isAdmin && !isStudent ? (
            <ArchiveTreePanel
              nodes={staffArchiveTree}
              activeFolderId={activeFolderId}
              onOpenFolder={openFolder}
              onDeleteFolder={handleTreeDeleteFolder}
              onFolderContextMenu={handleFolderContextMenu}
              allowDeleteFolder={false}
            />
          ) : null}
        </aside>

        <main className="main-panel">
          {notice ? (
            <div className="toast-notice" role="status" aria-live="polite">
              {notice}
            </div>
          ) : null}
          {isFolderRoute && !hideFolderSearch ? (
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
          {deferredQuery && isFolderRoute && !hideFolderSearch ? (
            <GlobalSearchResults
              query={settledSearchQuery || deferredQuery}
              busy={searchBusy || (Boolean(searchQuery.trim()) && searchQuery.trim() !== settledSearchQuery)}
              results={searchResults}
              studentProfile={studentSearchProfile}
              mode={usesOfficeDashboardFormat(session.role) ? 'registrar' : 'documents'}
              onClear={() => setSearchQuery('')}
              onOpenDocument={(documentId, title) => openDocumentPreview(documentId, title)}
              onDownloadDocument={handleDownloadDocumentById}
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
              onUpload={openUploadModal}
              onSubmitFinalYearProject={() => {
                setStudentFypEditId(null)
                setStudentFypWizardOpen(true)
              }}
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
              onReservationChange={() => setReservationRefreshToken((value) => value + 1)}
              reservationRefreshToken={reservationRefreshToken}
              onOpenDocument={openDocumentPreview}
              addressBarActions={profileMenu}
            />
          ) : isAdmin && dashboardView === 'default' ? (
            <div className={`dashboard-workspace${selectedAdminOffice ? ' dashboard-workspace-admin-office' : ' dashboard-workspace-admin'}`}>
              <header className="dash-header dash-header-staff">
                <div className="dash-header-copy">
                  <nav className="dash-crumbs" aria-label="Breadcrumb">
                    <span>Archive</span>
                    <ChevronRightIcon className="icon small" />
                    <strong>{selectedAdminOffice ? (adminOffices.find((office) => office.role === selectedAdminOffice)?.label || 'Office') : dashboardLabel}</strong>
                  </nav>
                  <h1>{selectedAdminOffice ? (adminOffices.find((office) => office.role === selectedAdminOffice)?.label || 'Office') : dashboardLabel}</h1>
                </div>
                <div
                  className={`dash-header-meta-center${showOfficeDashboardFormat ? ' dash-header-meta-lower' : ''}`}
                  aria-label="Session details"
                >
                  <DashboardSessionMeta lastSignIn={data.lastSignIn} />
                </div>
                <div className="dash-header-actions">
                  {profileMenu}
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
                  onOpenDocument={(documentId, title) => openDocumentPreview(documentId, title)}
                  onDownloadDocument={handleDownloadDocumentById}
                  onOpenFolder={(folderId) => handleOpenArchiveFolder(folderId, studentSearchProfile?.studentNumber)}
                />
              ) : null}
              {selectedAdminOffice ? (
                <div className="admin-office-workspace">
                  <div className="admin-office-panel-bar">
                    <div className="admin-dashboard-tabs">
                      <button
                        type="button"
                        className={`admin-dashboard-tab ${adminOfficePanel === 'tree' ? 'active' : ''}`}
                        onClick={() => setAdminOfficePanel('tree')}
                      >
                        Archive tree
                      </button>
                      <button
                        type="button"
                        className={`admin-dashboard-tab ${adminOfficePanel === 'activity' ? 'active' : ''}`}
                        onClick={() => setAdminOfficePanel('activity')}
                      >
                        Live activity
                      </button>
                    </div>
                    <button
                      type="button"
                      className="ghost-btn admin-office-back"
                      onClick={() => setSelectedAdminOffice(null)}
                    >
                      Back to system dashboard
                    </button>
                  </div>
                  {adminOfficePanel === 'tree' ? (
                    <div className="admin-card admin-office-tree-card admin-office-tree-primary">
                      <div className="admin-activity-head">
                        <div>
                          <h2>{adminArchiveTreeTitle}</h2>
                          <p>Browse archive folders for this office.</p>
                        </div>
                      </div>
                      <ArchiveTreePanel
                        nodes={adminArchiveTree}
                        activeFolderId={activeFolderId}
                        onOpenFolder={openFolder}
                        onDeleteFolder={handleTreeDeleteFolder}
                        onFolderContextMenu={handleFolderContextMenu}
                        allowDeleteFolder={false}
                        embedded
                      />
                    </div>
                  ) : (
                    <AdminOfficeView
                      officeRole={selectedAdminOffice}
                      onNotify={showNotice}
                      onOpenDocument={openDocumentPreview}
                      onOpenFolder={(folderId) => handleOpenArchiveFolder(folderId)}
                      onBack={() => setSelectedAdminOffice(null)}
                      onShowArchiveTree={() => setAdminOfficePanel('tree')}
                    />
                  )}
                </div>
              ) : (
                <AdminDashboard onNotify={showNotice} />
              )}
            </div>
          ) : isLibrarian && dashboardView === 'default' && !isFolderRoute ? (
            <>
              {error ? <div className="banner warning">{error}</div> : null}
              {loading ? (
                <section className="explorer-page explorer-page-loading">
                  <p>Loading library workspace…</p>
                </section>
              ) : (
                <LibrarianDashboard
                  session={session}
                  dashboard={data}
                  onNotify={showNotice}
                  onOpenDocument={(documentId) => openDocumentPreview(documentId)}
                  onOpenFolder={openFolder}
                  onBrowse={() => {
                    const firstFolder = (data.archiveTree || [])[0]
                    if (firstFolder?.id) {
                      openFolder(firstFolder.id)
                    } else {
                      showNotice('No archive folders are available yet.')
                    }
                  }}
                  onReviewTask={(task) => {
                    setApprovalReviewTask(task)
                    setApprovalReviewNote('')
                  }}
                />
              )}
            </>
          ) : isStudent && dashboardView === 'default' && !isFolderRoute ? (
            <>
              {error ? <div className="banner warning student-dashboard-error">{error}</div> : null}
              {loading ? (
                <section className="explorer-page explorer-page-loading">
                  <p>Loading your student workspace…</p>
                </section>
              ) : (
            <StudentDashboard
              session={session}
              dashboard={data}
              onNotify={showNotice}
              reservationRefreshToken={reservationRefreshToken}
              fypCounts={studentFypCounts}
              fypTab={studentFypTab}
              onFypTabChange={setStudentFypTab}
              onEditFinalYearProject={(documentId) => {
                setStudentFypEditId(documentId)
                setStudentFypWizardOpen(true)
              }}
              onStartProject={() => {
                setStudentFypEditId(null)
                setStudentFypWizardOpen(true)
              }}
              onOpenDocument={(documentId, title) => openDocumentPreview(documentId, title)}
              profileMenu={profileMenu}
            />
              )}
            </>
          ) : (
            <div className="dashboard-workspace">
              <header className="dash-header dash-header-staff">
                <div className="dash-header-copy">
                  <nav className="dash-crumbs" aria-label="Breadcrumb">
                    <span>Archive</span>
                    <ChevronRightIcon className="icon small" />
                    <strong>{showOfficeDashboardFormat ? dashboardLabel : (selectedCategoryMeta?.label || dashboardLabel)}</strong>
                  </nav>
                  <h1>{dashboardLabel}</h1>
                </div>
                <div
                  className={`dash-header-meta-center${showOfficeDashboardFormat ? ' dash-header-meta-lower' : ''}`}
                  aria-label="Session details"
                >
                  <DashboardSessionMeta lastSignIn={data.lastSignIn} />
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
                  {!showOfficeDashboardFormat && !isHod && !isStudent ? (
                    <button className="primary-btn dash-action-btn" type="button" onClick={openUploadModal}>
                      <UploadIcon className="icon" />
                      Upload
                    </button>
                  ) : null}
                  {profileMenu}
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
                  query={settledSearchQuery || deferredQuery}
                  busy={searchBusy || (Boolean(searchQuery.trim()) && searchQuery.trim() !== settledSearchQuery)}
                  results={searchResults}
                  studentProfile={studentSearchProfile}
                  mode="registrar"
                  onClear={() => setSearchQuery('')}
                  onOpenDocument={(documentId, title) => openDocumentPreview(documentId, title)}
                  onDownloadDocument={handleDownloadDocumentById}
                  onOpenFolder={(folderId) => handleOpenArchiveFolder(folderId, studentSearchProfile?.studentNumber)}
                />
              ) : null}

              {visibleDocumentCategories.length && !showOfficeDashboardFormat ? (
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

              <section className={`dash-metrics ${showOfficeDashboardFormat ? 'dash-metrics-registrar' : ''}`}>
                <StatCard label="Uploaded this week" value={data.recentlyUploaded} caption="new files" accent="upload" />
                {!showOfficeDashboardFormat && !isLibrarian ? (
                  <StatCard label="Pending approvals" value={data.pendingApprovals} caption="in your queue" accent="approvals" />
                ) : null}
                <StatCard label="Department files" value={data.departmentFiles} caption={departmentLabel || 'All departments'} accent="department" />
                <StatCard label="Storage" value={formatBytes(data.storageUsedBytes)} caption={`of ${formatBytes(data.storageLimitBytes)}`} accent="storage" />
              </section>

              <section className={`dash-grid ${showOfficeDashboardFormat || dashboardView === 'shared' || dashboardView === 'recent' ? 'dash-grid-single' : ''}`}>
                <div className="dash-panel dash-panel-main">
                  <div className="dash-panel-head">
                    <div>
                      <h2>
                        {dashboardView === 'archive'
                          ? 'Removed archive'
                          : dashboardView === 'shared'
                            ? 'Shared with me'
                            : dashboardView === 'recent'
                              ? 'Recent activity'
                              : 'Department activity'}
                      </h2>
                      <p>
                        {dashboardView === 'archive'
                          ? session.role === 'ADMIN'
                            ? 'Files awaiting permanent deletion confirmation. Only administrators can confirm removal.'
                            : `Files moved to archive by ${roleConfig.roleLabel || 'your role'}. An administrator must confirm permanent deletion.`
                          : dashboardView === 'shared'
                            ? 'Folders and files shared with your role. Open an item to view it with the granted permission.'
                            : dashboardView === 'recent'
                              ? 'Actions recorded today. Older activity stays in Department activity.'
                              : selectedCategoryMeta
                                ? `Recent actions for ${selectedCategoryMeta.label.toLowerCase()}, including earlier days.`
                                : 'Full activity history for your department, including items that leave Recent activity after today.'}
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
                          ) : dashboardView === 'shared' ? (
                            <>
                              <th>Item</th>
                              <th>Type</th>
                              <th>Permission</th>
                              <th>Shared by</th>
                              <th>Expires</th>
                              <th>Date</th>
                              <th>Open</th>
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
                                    {resolveCategoryChipLabel(fileRow.category)}
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
                        ) : dashboardView === 'shared' ? (
                          sharedBusy ? (
                            <tr>
                              <td colSpan="7" className="empty-state">Loading shared items...</td>
                            </tr>
                          ) : sharedItems.length ? (
                            sharedItems.map((item) => (
                              <tr key={`shared-${item.shareId}`}>
                                <td>
                                  <div className="file-cell">
                                    {item.itemType === 'FOLDER' ? (
                                      <FolderIcon className="icon" />
                                    ) : (
                                      <DocumentIcon className="icon doc" />
                                    )}
                                    <div>
                                      <strong>{item.name}</strong>
                                    </div>
                                  </div>
                                </td>
                                <td>{item.itemType === 'FOLDER' ? 'Folder' : 'File'}</td>
                                <td>
                                  <span className="document-chip">{item.permissionLabel || item.permission}</span>
                                </td>
                                <td>{item.sharedBy || '-'}</td>
                                <td>{item.expiresAt ? formatDateTime(item.expiresAt) : 'No expiry'}</td>
                                <td>{formatDateTime(item.sharedAt)}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="dash-text-btn"
                                    onClick={() => {
                                      if (item.itemType === 'DOCUMENT' && item.documentId) {
                                        openDocumentPreview(
                                          item.documentId,
                                          item.title || item.name,
                                          {
                                            sharedAccess: true,
                                            allowDownload: item.allowDownload !== false,
                                            sharePermission: item.permission,
                                            sharePermissionLabel: item.permissionLabel || item.permission
                                          }
                                        )
                                        return
                                      }
                                      if (item.folderId) {
                                        openFolder(item.folderId)
                                      } else {
                                        showNotice('This shared item is no longer available.')
                                      }
                                    }}
                                  >
                                    Open
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="7" className="empty-state">
                                Nothing has been shared with you yet.
                              </td>
                            </tr>
                          )
                        ) : loading || activitiesBusy ? (
                          <tr>
                            <td colSpan="4" className="empty-state">Loading activity...</td>
                          </tr>
                        ) : dashboardActivities.length ? (
                          dashboardView === 'recent' ? (
                            dashboardActivities.map((entry) => (
                              <DashboardActivityRow key={entry.id} entry={entry} />
                            ))
                          ) : (
                            <>
                              <DashboardActivityGroup label="Today" entries={groupedDashboardActivities.today} />
                              <DashboardActivityGroup label="Earlier" entries={groupedDashboardActivities.earlier} />
                            </>
                          )
                        ) : (
                          <tr>
                            <td colSpan="4" className="empty-state">
                              {dashboardView === 'recent'
                                ? 'No activity recorded today. Older actions remain in Department activity.'
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

                {!showOfficeDashboardFormat && !isLibrarian && dashboardView !== 'shared' && dashboardView !== 'recent' ? (
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
                          <span>{task.requestedBy}{task.studentNumber ? ` · ${task.studentNumber}` : ''}</span>
                          <p>{task.note || 'Awaiting review'}</p>
                        </div>
                        <div className="approval-meta">
                          <span className={`priority ${String(task.priority || '').toLowerCase()}`}>{task.priority}</span>
                          <div className="approval-actions">
                            {isLibrarian ? (
                              <button
                                type="button"
                                className="tiny-btn"
                                onClick={() => {
                                  setApprovalReviewTask(task)
                                  setApprovalReviewNote('')
                                }}
                              >
                                Review
                              </button>
                            ) : (
                              <>
                                <button type="button" className="tiny-btn approve" onClick={() => handleDecision(task.id, 'approve')}>
                                  <CheckIcon className="icon" /> Approve
                                </button>
                                <button type="button" className="tiny-btn reject" onClick={() => handleDecision(task.id, 'reject')}>
                                  <XIcon className="icon" /> Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )) : (
                      <p className="dash-side-empty">Nothing waiting for approval.</p>
                    )}
                  </div>
                </aside>
                ) : null}
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
        hideConfirmButton={Boolean(appConfirm?.hideConfirmButton)}
        onSelectChange={(value) => {
          setAppConfirmSelect(value)
          if (!appConfirm?.autoConfirmOnSelect || !value || appConfirmBusy) {
            return
          }
          setAppConfirmBusy(true)
          Promise.resolve()
            .then(() => appConfirm.onConfirm?.(value))
            .then(() => {
              setAppConfirm(null)
              setAppConfirmInput('')
              setAppConfirmSelect('')
            })
            .catch((err) => {
              showNotice(err.message || 'Unable to move folder.')
            })
            .finally(() => {
              setAppConfirmBusy(false)
            })
        }}
        onConfirm={runAppConfirmAction}
        onCancel={closeAppConfirm}
        busy={appConfirmBusy}
      />

      {isStudent && studentFypWizardOpen ? (
        <StudentFypWizard
          session={session}
          existingDocumentId={studentFypEditId}
          onClose={() => {
            setStudentFypWizardOpen(false)
            setStudentFypEditId(null)
          }}
          onNotify={showNotice}
          onSubmitted={async () => {
            setStudentFypWizardOpen(false)
            setStudentFypEditId(null)
            await refreshExplorerData?.()
            try {
              const fresh = await getDashboard()
              setDashboard(fresh)
            } catch {
              // Dashboard refresh is best-effort after submit.
            }
          }}
        />
      ) : null}

      {modalOpen ? (
        <div className="modal-backdrop" onClick={closeUploadModal} role="presentation">
          <div className={`modal upload-modal${usesPlacementUpload ? ' upload-modal-compact' : ''}`} onClick={(event) => event.stopPropagation()} role="presentation">
            <div className="modal-head upload-modal-head">
              <div className="upload-modal-intro">
                {!usesPlacementUpload ? (
                  <div className="upload-modal-icon" aria-hidden="true">
                    <UploadIcon className="icon" />
                  </div>
                ) : null}
                <div>
                  {!usesPlacementUpload ? <p className="eyebrow">Upload Document</p> : null}
                  <h2>Add a new record to the archive</h2>
                  {!usesPlacementUpload ? (
                    <p className="upload-modal-subtitle">
                      {isStudent
                        ? 'Submit your final year project for librarian review. Every file is scanned for malware before upload.'
                        : 'Complete the form and attach a PDF to store it in the archive. Every file is scanned for malware before upload.'}
                    </p>
                  ) : null}
                </div>
              </div>
              <button className="ghost-icon" type="button" onClick={closeUploadModal} aria-label="Close upload dialog">
                <XIcon className="icon" />
              </button>
            </div>

            <form className="upload-form" onSubmit={handleUpload}>

              {usesPlacementUpload ? (
                <section className="upload-student-panel">
                  <label className="lookup-field">
                    <span>Student ID</span>
                    <div className="lookup-input-row">
                      <input
                        value={form.studentNumber}
                        onChange={(event) => {
                          const nextNumber = normalizeStudentId(event.target.value)
                          setForm(applyUploadPlacementContext({ ...form, studentNumber: nextNumber }, uploadPlacement))
                          setStudentLookupError('')
                          setStudentLookupInfo('')
                          setStudentLookupResult(null)
                          setStudentEntryMode('idle')
                        }}
                        onBlur={() => {
                          if (form.studentNumber.trim()) {
                            lookupStudentArchive(form.studentNumber, { populateForm: true })
                          }
                        }}
                        placeholder="e.g. 25883, 25678965 or 20251SEN001"
                        autoFocus
                      />
                      <button
                        type="button"
                        className="ghost-btn lookup-action"
                        onClick={() => lookupStudentArchive(form.studentNumber, { populateForm: true })}
                        disabled={studentLookupBusy}
                      >
                        {studentLookupBusy ? 'Checking...' : 'Find'}
                      </button>
                    </div>
                    {studentLookupError && form.studentNumber.trim() ? <small className="lookup-hint error">{studentLookupError}</small> : null}
                    {studentLookupInfo && form.studentNumber.trim() ? <small className="lookup-hint info">{studentLookupInfo}</small> : null}
                  </label>

                  {studentLookupResult?.studentNumber === String(form.studentNumber || '').trim() ? (
                    <div className="upload-student-found">
                      <div>
                        <strong>{studentLookupResult.studentName}</strong>
                        <span>
                          {studentLookupResult.studentNumber}
                          {formatExistingStudentPlacement(studentLookupResult)
                            ? ` · ${formatExistingStudentPlacement(studentLookupResult)}`
                            : form.department
                              ? ` · ${form.department}`
                              : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="ghost-btn tiny-btn"
                        onClick={() => handleOpenArchiveFolder(studentLookupResult.folderId, studentLookupResult.studentNumber)}
                      >
                        Open folder
                      </button>
                    </div>
                  ) : studentEntryMode === 'new' && form.studentNumber.trim() ? (
                    <>
                      <label>
                        <span>Student name (link this ID)</span>
                        <input
                          value={form.studentName}
                          onChange={(event) => setForm({ ...form, studentName: event.target.value })}
                          placeholder="Full name for this student ID"
                        />
                      </label>
                      {!form.faculty || !form.department ? (
                        <p className="inline-note">
                          {uploadPlacementSummary
                            ? `This student will be linked under ${uploadPlacementSummary}.`
                            : 'Faculty and department follow the folder you opened for upload.'}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </section>
              ) : null}

              {usesPlacementUpload ? (
                <section className="exam-details-panel">
                  <div className="exam-details-head">
                    <div>
                      <p className="eyebrow">Upload Details</p>
                      {effectiveUploadPlacementSummary ? (
                        <strong className="upload-placement-summary">{effectiveUploadPlacementSummary}</strong>
                      ) : null}
                    </div>
                  </div>

                  <div className="exam-details-grid upload-context-grid">
                    <div className="upload-context-field">
                      <span>Faculty</span>
                      <strong>{form.faculty || '—'}</strong>
                    </div>
                    <div className="upload-context-field">
                      <span>Department</span>
                      <strong>{form.department || '—'}</strong>
                    </div>
                    <div className="upload-context-field">
                      <span>Academic year</span>
                      <strong>{form.academicYear || '—'}</strong>
                    </div>
                    <div className="upload-context-field">
                      <span>Semester</span>
                      <strong>{form.semester || '—'}</strong>
                    </div>
                    <div className="upload-context-field">
                      <span>Date</span>
                      <strong>{formatDisplayDate(form.issueDate)}</strong>
                    </div>
                  </div>

                  <p className="inline-note">
                    The PDF is stored inside a folder named with the student ID under this semester.
                    If that folder does not exist yet, it is created automatically on upload.
                  </p>
                </section>
              ) : null}

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

              {studentLookupResult && !isStudent && !usesPlacementUpload ? (
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

              {!isStudent && !usesPlacementUpload ? (
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
                    <AcademicYearField
                      value={form.academicYear}
                      onChange={(year) => setForm((current) => ({
                        ...current,
                        academicYear: year,
                        semester: ''
                      }))}
                    />
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

              <div className={`form-grid${usesPlacementUpload ? ' form-grid-compact' : ''}`}>
                {!isStudent && !usesPlacementUpload ? (
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
                        placeholder="e.g. 20251SEN001, 25883 or 25678965"
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
                {!isStudent && !usesPlacementUpload ? (
                  <label>
                    <span>Student name</span>
                    <input
                      value={form.studentName}
                      onChange={(event) => setForm({ ...form, studentName: event.target.value })}
                      placeholder="Will be linked to the student ID"
                    />
                  </label>
                ) : null}
                {!usesPlacementUpload ? (
                  <label>
                    <span>Page count</span>
                    <input
                      type="number"
                      min="1"
                      value={form.pageCount}
                      onChange={(event) => setForm({ ...form, pageCount: event.target.value })}
                    />
                  </label>
                ) : null}
                {!usesPlacementUpload ? (
                  <label>
                    <span>Issue date</span>
                    <input
                      type="date"
                      value={form.issueDate}
                      onChange={(event) => setForm({ ...form, issueDate: event.target.value })}
                    />
                  </label>
                ) : null}
                <label>
                  <span>Uploaded by</span>
                  <input
                    value={form.uploadedBy}
                    onChange={(event) => setForm({ ...form, uploadedBy: event.target.value })}
                    placeholder="Will default from your account"
                    readOnly={isStudent || usesPlacementUpload}
                  />
                </label>
                {!usesPlacementUpload ? (
                  <label>
                    <span>Tags</span>
                    <input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="Optional" />
                  </label>
                ) : null}
              </div>

              {studentNeedsProfile && !usesPlacementUpload ? (
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

              {studentLookupResult && !studentNeedsProfile && !usesPlacementUpload ? (
                <p className="inline-note">
                  Stored faculty and department will be reused automatically for this student.
                </p>
              ) : null}

              {!usesPlacementUpload ? (
                <label className="full-width">
                  <span>Description</span>
                  <textarea rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </label>
              ) : null}

              <section className="upload-source-tabs" aria-label="Upload source">
                <button
                  type="button"
                  className={`upload-source-tab ${uploadSourceMode === 'file' ? 'active' : ''}`}
                  onClick={() => setUploadSourceMode('file')}
                >
                  Upload PDF
                </button>
                <button
                  type="button"
                  className={`upload-source-tab ${uploadSourceMode === 'phone' ? 'active' : ''}`}
                  onClick={() => setUploadSourceMode('phone')}
                >
                  Phone scanner
                </button>
              </section>

              {uploadSourceMode === 'phone' ? (
                <UploadPhoneScanPanel
                  onNotify={showNotice}
                  onImport={(importedFile, pageCount) => {
                    setUploadSourceMode('file')
                    appendPhoneImportToQueue(importedFile, pageCount)
                  }}
                />
              ) : null}

              {uploadSourceMode === 'file' ? (
                <UploadFileDropzone
                  queue={uploadQueue}
                  onQueueChange={setUploadQueue}
                  scanContext={uploadScanContext}
                  maxFileSizeBytes={uploadMaxFileSizeBytes}
                  disabled={uploadQueueRequiresStudentId}
                  disabledReason={uploadQueueRequiresStudentId ? 'Enter a student ID before adding files.' : ''}
                  onNotify={showNotice}
                />
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={closeUploadModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={!verifiedUploadItems.length || uploadBusy || uploadQueueScanning}
                >
                  <UploadIcon className="icon" />
                  {uploadBusy && uploadBatchProgress.total > 1
                    ? `Uploading ${uploadBatchProgress.current} of ${uploadBatchProgress.total}…`
                    : uploadBusy
                      ? 'Uploading...'
                      : verifiedUploadItems.length > 1
                        ? `Upload ${verifiedUploadItems.length} documents`
                        : 'Upload to archive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {approvalReviewTask ? (
        <div className="modal-backdrop" onClick={approvalReviewBusy ? undefined : () => setApprovalReviewTask(null)} role="presentation">
          <div
            className="modal student-fyp-wizard"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="librarian-review-title"
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">Librarian review</p>
                <h2 id="librarian-review-title">{approvalReviewTask.documentTitle}</h2>
                <p>
                  {approvalReviewTask.requestedBy}
                  {approvalReviewTask.studentNumber ? ` · ${approvalReviewTask.studentNumber}` : ''}
                </p>
              </div>
              <button
                type="button"
                className="ghost-icon"
                onClick={() => setApprovalReviewTask(null)}
                disabled={approvalReviewBusy}
                aria-label="Close"
              >
                <XIcon className="icon" />
              </button>
            </div>
            <div className="fyp-review">
              <dl>
                <div><dt>Description</dt><dd>{approvalReviewTask.description || 'No description provided'}</dd></div>
                <div><dt>GitHub</dt><dd>{approvalReviewTask.githubUrl || 'Not provided'}</dd></div>
                <div><dt>External links</dt><dd>{approvalReviewTask.externalLinks || 'Not provided'}</dd></div>
                <div><dt>File</dt><dd>{approvalReviewTask.fileName || 'Project ZIP'}</dd></div>
              </dl>
              {approvalReviewTask.documentId ? (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => openDocumentPreview(approvalReviewTask.documentId, approvalReviewTask.documentTitle)}
                >
                  <DownloadIcon className="icon" />
                  Open submitted file
                </button>
              ) : null}
              <label className="fyp-review-note-field">
                <span>Decision note {approvalReviewTask ? '(required when rejecting)' : ''}</span>
                <textarea
                  rows={4}
                  value={approvalReviewNote}
                  onChange={(event) => setApprovalReviewNote(event.target.value)}
                  placeholder="Explain why the project is rejected, or add approval notes for the student record."
                  required={false}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setApprovalReviewTask(null)} disabled={approvalReviewBusy}>
                Cancel
              </button>
              <button
                type="button"
                className="tiny-btn reject"
                disabled={approvalReviewBusy}
                onClick={() => handleDecision(approvalReviewTask.id, 'reject', approvalReviewNote)}
              >
                <XIcon className="icon" />
                Reject
              </button>
              <button
                type="button"
                className="tiny-btn approve"
                disabled={approvalReviewBusy}
                onClick={() => handleDecision(approvalReviewTask.id, 'approve', approvalReviewNote)}
              >
                <CheckIcon className="icon" />
                Accept
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {documentViewer ? (
        <DocumentPdfViewer
          documentId={documentViewer.documentId}
          title={documentViewer.title}
          sharedAccess={documentViewer.sharedAccess}
          sharePermission={documentViewer.sharePermission}
          sharePermissionLabel={documentViewer.sharePermissionLabel}
          allowDownload={documentViewer.allowDownload}
          onClose={() => setDocumentViewer(null)}
          onNotify={showNotice}
        />
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
