import React, { useCallback, useEffect, useRef, useState, useDeferredValue } from 'react'
import { useResizable, useResizableFromRight } from './hooks/useResizable'
import { createSubfolder, decideApproval, deleteDocument, deleteFolder, downloadDocument, downloadFolderZip, formatLoginError, getActivities, getAdminDashboard, getAdminOffices, getArchivedDocuments, getDashboard, getFolder, getPublishedArchiveTree, getSessionProfile, getSharedWithMe, getSharedWithMeCount, getStudentArchive, login, lookupStudent, moveFolder, copyFolder, openDocument, permanentlyDeleteDocument, previewFolderImport, renameFolder, replaceDocumentFile, restoreDocument, scanDocument, searchDocuments, shareItems, submitUpload, addDepartmentAcademicYear } from './api'
import AdminDashboard from './components/AdminDashboard'
import AdminOfficeView from './components/AdminOfficeView'
import { buildAdminOffices, filterArchiveTreeForOffice } from './adminOfficeUtils'
import AcademicYearField from './components/AcademicYearField'
import MobileScanPage from './components/MobileScanPage'
import UploadPhoneScanPanel from './components/UploadPhoneScanPanel'
import ImportPreviewWizard from './components/ImportPreviewWizard'
import DocumentTypePicker from './components/DocumentTypePicker'
import StaffStudentFolderBuilder from './components/StaffStudentFolderBuilder'
import ExplorerDetailsPane from './components/ExplorerDetailsPane'
import UserAppearanceSettings, { applyFolderColorMode } from './components/UserAppearanceSettings'
import LibrarianDashboard from './components/LibrarianDashboard'
import StudentDashboard from './components/StudentDashboard'
import StudentBookReservationControls from './components/StudentBookReservationControls'
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
import { countPdfPages } from './documentScan'
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
  { label: 'Recent activity', icon: ClockIcon, count: null, action: 'recent' },
  { label: 'Dashboard', icon: HomeIcon, count: null, action: 'dashboard' },
  { label: 'Department Archive', icon: FolderIcon, count: null, action: 'dept-archive' },
  { label: 'Shared with me', icon: BellIcon, count: null, action: 'shared' },
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
  { value: 'READ_ONLY', label: 'Read only', hint: 'View and download only' },
  { value: 'WRITE', label: 'Write', hint: 'Upload files and create folders' },
  { value: 'EDIT', label: 'Edit', hint: 'Replace, rename, and modify items' }
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

/** Office used for document category/type catalog (not academic department). */
function resolveCatalogOffice(role) {
  switch (role) {
    case 'REGISTRAR':
      return 'Registrar Office'
    case 'EXAMINATION_OFFICER':
      return 'Examination Office'
    case 'LIBRARIAN':
    case 'STUDENT':
      return 'University Library'
    case 'HOD':
    case 'ADMIN':
      return ''
    default:
      return getRoleDashboardConfig(role).department || ''
  }
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
    placementAcademicYear: placement?.academicYear || form.placementAcademicYear,
    placementSemester: placement?.semester || form.placementSemester,
    // Default document term from browse context only when not already chosen.
    academicYear: form.academicYear || placement?.academicYear || '',
    semester: form.semester || placement?.semester || ''
  }
}

function applyExistingStudentPlacement(form, profile, { preserveDocumentTerm = false } = {}) {
  if (!profile?.studentNumber) {
    return form
  }
  return {
    ...form,
    studentNumber: profile.studentNumber,
    studentName: profile.studentName || form.studentName,
    faculty: profile.faculty || form.faculty,
    department: profile.department || form.department,
    ...(preserveDocumentTerm
      ? {}
      : {
          academicYear: profile.academicYear || form.academicYear,
          semester: profile.semester || form.semester
        })
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
    categoryDefinitionId: '',
    documentTypeId: '',
    typeName: '',
    categoryName: '',
    examType: 'MID_SEM',
    academicYear: '',
    semester: '',
    placementAcademicYear: '',
    placementSemester: '',
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

function buildPlacementUploadTitle(form, studentNumber) {
  const label = form.typeName || getCategoryMeta(form.category).label
  return [
    label,
    String(studentNumber || '').trim(),
    String(form.academicYear || '').trim(),
    String(form.semester || '').trim()
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

function resolveFolderTone(node) {
  const code = String(node?.code || '').toUpperCase()
  const name = String(node?.name || '').trim()
  if (code === 'AUCA' || (code.startsWith('FAC-') && !code.includes('-DEPT-'))) {
    return 'faculty'
  }
  if (code.includes('-DEPT-')) {
    return 'department'
  }
  if (code.includes('-AY-') || code.includes('-INAY-') || /^\d{4}-\d{4}$/.test(name)) {
    return 'year'
  }
  if (code.includes('-SEM-') || code.includes('-INSEM-') || /^\d{4}\/\d$/.test(name)) {
    return 'semester'
  }
  if (code.includes('-STU-')) {
    return 'student'
  }
  if (code.includes('-TYP-')) {
    return 'document'
  }
  return 'document'
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
                <FolderIcon className={`icon folder tree-folder folder-tone-${resolveFolderTone(node)}`} />
                <span className="tree-label">{node.name}</span>
              </button>
              <span className="tree-count">{node.itemCount ?? 0}</span>
              {canDelete ? (
                <button
                  type="button"
                  className="tree-delete-btn btn-danger"
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

function StudentDepartmentArchiveNav({ onOpenDepartmentArchive, onNotify }) {
  return (
    <div className="sidebar-section student-folders-nav">
      <div className="section-head">
        <p className="eyebrow">Department archive</p>
      </div>
      <button
        type="button"
        className="student-folder-nav-button student-dept-archive-btn"
        onClick={() => onOpenDepartmentArchive?.() || onNotify?.('Department archive is unavailable.')}
      >
        <span className="student-folder-nav-icon" aria-hidden="true">
          <FolderIcon className="icon" />
        </span>
        <span className="student-folder-nav-copy">
          <strong>Published FYP books</strong>
          <em>Reserve &amp; read (20 min slots)</em>
        </span>
      </button>
    </div>
  )
}

function StudentDefaultFoldersNav({ nodes, activeFolderId, onOpenFolder, onNotify }) {
  const defaults = findStudentDefaultFolders(nodes)
  const folders = [
    {
      key: 'official',
      label: 'Official Documents',
      hint: 'From registrar & exams',
      node: defaults.official
    },
    {
      key: 'projects',
      label: 'Final Year Project',
      hint: 'Submit and edit pending work',
      node: defaults.projects
    },
    {
      key: 'archive',
      label: 'Archive project',
      hint: 'Accepted project profiles',
      node: defaults.archive
    }
  ]

  return (
    <div className="sidebar-section student-folders-nav">
      <div className="section-head">
        <p className="eyebrow">My folders</p>
      </div>
      <div className="student-folders-nav-list">
        {folders.map((folder) => {
          const isActive = Boolean(folder.node?.id && Number(activeFolderId) === Number(folder.node.id))
          const childCount = folder.node?.itemCount ?? 0
          return (
            <div key={folder.key} className={`student-folder-nav-item ${isActive ? 'active' : ''}`}>
              <button
                type="button"
                className="student-folder-nav-button"
                onClick={() => {
                  if (folder.node?.id) {
                    onOpenFolder?.(folder.node.id)
                  } else {
                    onNotify?.(`${folder.label} is still being prepared. Refresh the page or open My archive.`)
                  }
                }}
              >
                <span className="student-folder-nav-icon" aria-hidden="true">
                  <FolderIcon className="icon" />
                  <LockIcon className="icon lock" />
                </span>
                <span className="student-folder-nav-copy">
                  <strong>{folder.label}</strong>
                  <em>{folder.hint}</em>
                </span>
                <span className="student-folder-nav-count">{childCount}</span>
              </button>
              {folder.node?.children?.length ? (
                <div className="student-folder-nav-children">
                  {folder.node.children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      className={`student-folder-nav-child ${Number(activeFolderId) === Number(child.id) ? 'active' : ''}`}
                      onClick={() => onOpenFolder?.(child.id)}
                    >
                      <FolderIcon className="icon" />
                      <span>{child.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
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
  formatBytes,
  onNotify
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

          <UserAppearanceSettings onNotify={onNotify} />

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
  folderBuilderPlacement,
  folderBuilderError,
  onFolderBuilderChange,
  hideConfirmButton = false,
  onConfirm,
  onCancel,
  busy
}) {
  if (!open) {
    return null
  }

  const confirmValue = folderBuilderPlacement
    ? inputValue
    : inputLabel
      ? inputValue
      : selectLabel
        ? selectValue
        : undefined
  const confirmDisabled = busy
    || (folderBuilderPlacement ? Boolean(folderBuilderError) || !String(inputValue || '').trim() : false)
    || (!folderBuilderPlacement && inputLabel ? !String(inputValue || '').trim() : false)
    || (selectLabel ? !String(selectValue || '').trim() : false)

  return (
    <div className="modal-backdrop confirm-backdrop" onClick={busy ? undefined : onCancel} role="presentation">
      <div
        className={`modal confirm-modal${folderBuilderPlacement ? ' confirm-modal-wide' : ''}`}
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
        {folderBuilderPlacement ? (
          <StaffStudentFolderBuilder
            placement={folderBuilderPlacement}
            value={inputValue}
            onChange={onFolderBuilderChange}
            disabled={busy}
          />
        ) : null}
        {!folderBuilderPlacement && inputLabel ? (
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
              autoFocus={!inputLabel && !folderBuilderPlacement}
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
              onClick={() => onConfirm?.(confirmValue)}
              disabled={confirmDisabled}
            >
              {busy
                ? (folderBuilderPlacement ? 'Creating…' : confirmLabel === 'Create folder' ? 'Creating…' : 'Working…')
                : confirmLabel}
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
        Open PDF in new window
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
  const [folderBuilderError, setFolderBuilderError] = useState('')
  const [openingDocumentId, setOpeningDocumentId] = useState(null)
  const [documentContextMenu, setDocumentContextMenu] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareTargetRole, setShareTargetRole] = useState('')
  const [sharePermission, setSharePermission] = useState('READ_ONLY')
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
  // Files live under student folders; replace only makes sense below the semester root.
  const canReplace = !isStudent && isSemesterOrDeeperFolder(folder) && !isSemesterFolder(folder)
  const canImport = !isStudent && isSemesterOrDeeperFolder(folder) && isOfficeArchiveRole(userRole)
  const isSemesterRoot = !isStudent && isSemesterFolder(folder)
  const canFilterDocuments = isOfficeArchiveRole(userRole)
    ? isSemesterOrDeeperFolder(folder)
    : !isStudent
  const replaceInputRef = useRef(null)
  const importInputRef = useRef(null)
  const { width: detailsWidth, startResize: startDetailsResize } = useResizableFromRight('auca-details-width', {
    initial: 320,
    min: 260,
    max: 520
  })
  const [importBusy, setImportBusy] = useState(false)
  const [importPreviewOpen, setImportPreviewOpen] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [importPayload, setImportPayload] = useState(null)

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
    setFolderBuilderError('')
  }

  function openConfirm(config) {
    setConfirmState(config)
  }

  function toggleFolderSelection(folderId) {
    setSelectedDocumentIds(new Set())
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
    const id = Number(documentId)
    setSelectedDocumentIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
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
    const id = Number(documentItem.id)
    // Selecting a file always clears folder selection so the Properties pane can open.
    setSelectedFolderIds(new Set())
    if (event.ctrlKey || event.metaKey) {
      toggleDocumentSelection(id)
      return
    }
    setSelectedDocumentIds(new Set([id]))
  }

  function handleDocumentContextMenu(event, documentItem) {
    event.preventDefault()
    event.stopPropagation()
    const id = Number(documentItem.id)
    setSelectedFolderIds(new Set())
    setSelectedDocumentIds(new Set([id]))
    setDocumentContextMenu({
      x: event.clientX,
      y: event.clientY,
      document: documentItem
    })
  }

  function handleDocumentKeyDown(event, documentItem) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const id = Number(documentItem.id)
      setSelectedFolderIds(new Set())
      setSelectedDocumentIds(new Set([id]))
    }
  }

  function getSelectedDocuments(allDocuments) {
    if (selectedDocumentIds.size) {
      return allDocuments.filter((document) => selectedDocumentIds.has(Number(document.id)))
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
  // Properties pane: show for the latest selected file whenever any file is selected.
  const primarySelectedDocumentId = selectedDocumentIds.size
    ? [...selectedDocumentIds][selectedDocumentIds.size - 1]
    : null
  const selectedDetailDocument = primarySelectedDocumentId == null
    ? null
    : documents.find((document) => Number(document.id) === primarySelectedDocumentId)
      || visibleDocumentsForGrid.find((document) => Number(document.id) === primarySelectedDocumentId)
      || null
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
    setFolderBuilderError('')
    const placement = resolveFolderUploadPlacement(folder)
    openConfirm({
      title: 'Create new folder',
      message: isStudent
        ? `Create a personal folder inside "${folder.name}" for your project files?`
        : `Create a student folder inside "${folder.name}". Enter the Student ID — uploaded files for that student go inside this folder.`,
      confirmLabel: 'Create folder',
      inputLabel: isStudent ? 'Folder name' : undefined,
      inputPlaceholder: isStudent ? 'Enter folder name' : undefined,
      folderBuilderPlacement: isStudent ? null : placement,
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
      message: isSemesterRoot
        ? `Upload into semester "${folder.name}". The form will ask for the student ID, document year/semester, and type — then create the student folder and store the file inside it.`
        : `Upload a document under "${folder.name}". For a new student, use Upload with their Student ID, or create their folder first.`,
      confirmLabel: 'Continue to upload',
      onConfirm: async () => {
        onUpload?.()
      }
    })
  }

  async function runFolderImport(payload) {
    setImportBusy(true)
    try {
      const preview = await previewFolderImport(folder.id, payload)
      setImportPayload(payload)
      setImportPreview(preview)
      setImportPreviewOpen(true)
    } catch (err) {
      onNotify?.(err.message || 'Import preview failed.')
    } finally {
      setImportBusy(false)
    }
  }

  async function handleImportCommitted(result) {
    const skippedNote = result.skippedCount
      ? ` ${result.skippedCount} item${result.skippedCount === 1 ? '' : 's'} skipped.`
      : ''
    onNotify?.(
      `Imported ${result.importedCount} document${result.importedCount === 1 ? '' : 's'} into "${folder.name}". `
      + `ZIP archives are unzipped here — open folders below to browse the real content.${skippedNote}`
    )
    setImportPreviewOpen(false)
    setImportPreview(null)
    setImportPayload(null)
    await onDataChange?.()
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
        documentIds
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
        folderBuilderPlacement={confirmState?.folderBuilderPlacement}
        folderBuilderError={folderBuilderError}
        onFolderBuilderChange={(name, error) => {
          setNewFolderName(name || '')
          setFolderBuilderError(error || '')
        }}
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
          Approved final year projects appear here as profiles. Open a profile to view details, links, and the project ZIP.
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
        className={`explorer-layout-with-details ${selectedDetailDocument ? 'has-details' : ''}`}
        style={selectedDetailDocument
          ? { '--explorer-details-width': `${Math.max(260, detailsWidth || 320)}px` }
          : undefined}
      >
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

        {visibleDocumentsForGrid.map((document) => (
          <div
            key={document.id}
            role="button"
            tabIndex={0}
            className={`explorer-item explorer-file ${selectedDocumentIds.has(Number(document.id)) ? 'selected' : ''} ${openingDocumentId === document.id ? 'opening' : ''}`}
            onClick={(event) => handleDocumentClick(event, document)}
            onContextMenu={(event) => handleDocumentContextMenu(event, document)}
            onKeyDown={(event) => handleDocumentKeyDown(event, document)}
            title="Click to select and show Properties. Right-click for open and download."
          >
            <ExplorerStatusBadge status={document.status} userRole={userRole} />
            <div className="explorer-item-icon file">
              <DocumentIcon className="icon" />
            </div>
            <div className="explorer-item-copy">
              <strong>{document.fileName || document.title}</strong>
              <span>{formatBytes(document.sizeBytes)}</span>
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
        ))}

        {isEmpty ? (
          <div className="explorer-empty">
            <FolderIcon className="icon folder" />
            <strong>{filterType === 'all' ? 'This folder is empty' : 'No items match this filter'}</strong>
            <span>
              {showFypSubmit
                ? 'Use Submit final year project to start the guided 5-step upload.'
                : showArchiveGallery || showProfileHeader
                  ? 'Accepted project profiles will appear here after librarian approval.'
                  : isSemesterRoot
                    ? 'Files are not stored directly in the semester. Create a student folder (Student ID), or use Upload to enter the student ID and file together.'
                    : canUpload
                      ? 'Upload a document or create a student folder to get started.'
                      : 'Open a semester folder to manage student documents.'}
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

      {selectedDetailDocument ? (
        <>
          <div
            className="layout-resizer layout-resizer-details"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize details pane"
            onMouseDown={startDetailsResize}
          />
          <ExplorerDetailsPane
            key={selectedDetailDocument.id}
            documentItem={selectedDetailDocument}
            onNotify={onNotify}
            onOpenDocument={handleOpenDocument}
            onDownloadDocument={handleDownloadDocument}
          />
        </>
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

      <ImportPreviewWizard
        open={importPreviewOpen}
        folderId={folder?.id}
        preview={importPreview}
        importPayload={importPayload}
        categoryOptions={getVisibleDocumentCategories(userRole)}
        onClose={() => {
          setImportPreviewOpen(false)
          setImportPreview(null)
          setImportPayload(null)
        }}
        onCommitted={handleImportCommitted}
        onNotify={onNotify}
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

function GlobalSearchResults({
  query,
  busy,
  results,
  studentProfile,
  onOpenDocument,
  onDownloadDocument,
  onOpenFolder,
  onClear,
  mode = 'documents',
  filters = {},
  filterOptions = {},
  onFilterChange
}) {
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
  const filteredResults = (results || []).filter((row) => {
    if (filters.kind === 'documents') {
      return row.kind !== 'folder' && row.kind !== 'project'
    }
    if (filters.kind === 'folders') {
      return row.kind === 'folder' || row.kind === 'project'
    }
    return true
  })
  const documentResults = filteredResults.filter((row) => row.kind !== 'folder' && row.kind !== 'project')
  const locationResults = filteredResults.filter((row) => row.kind === 'folder' || row.kind === 'project')
  const resultCount = filteredResults.length
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
      {onFilterChange ? (
        <div className="global-search-filters" aria-label="Search filters">
          {(filterOptions.categories || []).map((option) => (
            <button
              key={option.value}
              type="button"
              className={`global-search-filter-chip ${filters.category === option.value ? 'active' : ''}`}
              onClick={() => onFilterChange({
                ...filters,
                category: filters.category === option.value ? '' : option.value
              })}
            >
              {option.label}
            </button>
          ))}
          {(filterOptions.offices || []).map((option) => (
            <button
              key={option}
              type="button"
              className={`global-search-filter-chip ${filters.office === option ? 'active' : ''}`}
              onClick={() => onFilterChange({
                ...filters,
                office: filters.office === option ? '' : option
              })}
            >
              {option}
            </button>
          ))}
          {(filterOptions.faculties || []).map((option) => (
            <button
              key={option}
              type="button"
              className={`global-search-filter-chip ${filters.faculty === option ? 'active' : ''}`}
              onClick={() => onFilterChange({
                ...filters,
                faculty: filters.faculty === option ? '' : option
              })}
            >
              {option}
            </button>
          ))}
          {(filterOptions.departments || []).map((option) => (
            <button
              key={option}
              type="button"
              className={`global-search-filter-chip ${filters.department === option ? 'active' : ''}`}
              onClick={() => onFilterChange({
                ...filters,
                department: filters.department === option ? '' : option
              })}
            >
              {option}
            </button>
          ))}
          {(filterOptions.academicYears || []).slice(0, 6).map((option) => (
            <button
              key={option}
              type="button"
              className={`global-search-filter-chip ${filters.academicYear === option ? 'active' : ''}`}
              onClick={() => onFilterChange({
                ...filters,
                academicYear: filters.academicYear === option ? '' : option
              })}
            >
              {option}
            </button>
          ))}
          {(filterOptions.semesters || []).slice(0, 6).map((option) => (
            <button
              key={option}
              type="button"
              className={`global-search-filter-chip ${filters.semester === option ? 'active' : ''}`}
              onClick={() => onFilterChange({
                ...filters,
                semester: filters.semester === option ? '' : option
              })}
            >
              {option}
            </button>
          ))}
          {(filterOptions.excludeCategories || []).map((option) => (
            <button
              key={option.value}
              type="button"
              className={`global-search-filter-chip exclude ${(filters.excludeCategories || []).includes(option.value) ? 'active' : ''}`}
              onClick={() => {
                const current = filters.excludeCategories || []
                const next = current.includes(option.value)
                  ? current.filter((value) => value !== option.value)
                  : [...current, option.value]
                onFilterChange({ ...filters, excludeCategories: next })
              }}
            >
              {option.label}
            </button>
          ))}
          {(filterOptions.kinds || []).map((option) => (
            <button
              key={option.value}
              type="button"
              className={`global-search-filter-chip ${filters.kind === option.value ? 'active' : ''}`}
              onClick={() => onFilterChange({
                ...filters,
                kind: filters.kind === option.value ? '' : option.value
              })}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
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
            ) : filteredResults.length ? (
              filteredResults.map((fileRow) => {
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
                            : getCategoryMeta(fileRow.category).label}
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
  const [searchPopupOpen, setSearchPopupOpen] = useState(false)
  const mainSearchInputRef = useRef(null)
  const deferredQuery = useDeferredValue(searchQuery.trim())
  const [settledSearchQuery, setSettledSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searchBusy, setSearchBusy] = useState(false)
  const { width: sidebarWidth, startResize: startSidebarResize } = useResizable('auca-sidebar-width', {
    initial: 248,
    min: 200,
    max: 420
  })
  const [searchFilters, setSearchFilters] = useState({
    category: '',
    office: '',
    faculty: '',
    department: '',
    documentTypeId: '',
    academicYear: '',
    semester: '',
    kind: '',
    excludeCategories: []
  })
  const [studentSearchProfile, setStudentSearchProfile] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [uploadSourceMode, setUploadSourceMode] = useState('file')
  const [uploadDragOver, setUploadDragOver] = useState(false)
  const [studentFypWizardOpen, setStudentFypWizardOpen] = useState(false)
  const [studentFypEditId, setStudentFypEditId] = useState(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [scanBusy, setScanBusy] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [scanError, setScanError] = useState('')
  const [validationOverride, setValidationOverride] = useState(false)
  const [dashboardView, setDashboardView] = useState('default')
  const [sharedItems, setSharedItems] = useState([])
  const [sharedBusy, setSharedBusy] = useState(false)
  const [sharedCount, setSharedCount] = useState(0)
  const [reservationRefreshToken, setReservationRefreshToken] = useState(0)
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
  const [appFolderBuilderError, setAppFolderBuilderError] = useState('')
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
  const [file, setFile] = useState(null)
  const [uploadQueue, setUploadQueue] = useState([])
  const [filePreviewOpen, setFilePreviewOpen] = useState(false)
  const [filePreviewUrl, setFilePreviewUrl] = useState('')
  const uploadFileInputRef = useRef(null)
  const roleConfig = getRoleDashboardConfig(session?.role)
  const visibleDocumentCategories = getVisibleDocumentCategories(session?.role)
  const documentTypeLocked = visibleDocumentCategories.length === 1

  useEffect(() => {
    applyFolderColorMode()
  }, [])

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
    if (!file) {
      setFilePreviewUrl('')
      setFilePreviewOpen(false)
      return undefined
    }

    const url = URL.createObjectURL(file)
    setFilePreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file])

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
      department: String(form.department || '').trim(),
      office: roleDashboardConfig[session?.role]?.department || '',
      documentSubtypeId: form.documentTypeId ? Number(form.documentTypeId) : null,
      fileName: file.name
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
    form.department,
    session?.role,
    file?.name
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

        const data = await searchDocuments(settledSearchQuery, {
          category: searchFilters.category || undefined,
          office: searchFilters.office || undefined,
          faculty: searchFilters.faculty || undefined,
          department: searchFilters.department || undefined,
          documentTypeId: searchFilters.documentTypeId || undefined,
          academicYear: searchFilters.academicYear || undefined,
          semester: searchFilters.semester || undefined,
          kind: searchFilters.kind || undefined,
          excludeCategories: searchFilters.excludeCategories?.length ? searchFilters.excludeCategories : undefined
        })
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
  }, [settledSearchQuery, session, dashboard, searchFilters])

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
    setFile(null)
    setScanResult(null)
    setScanError('')
    setScanBusy(false)
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
  const searchFilterOptions = {
    categories: visibleDocumentCategories,
    excludeCategories: [
      { value: 'FINAL_YEAR_PROJECT', label: 'Exclude FYP' },
      { value: 'EXAMINATION_DOCUMENTS', label: 'Exclude exams' }
    ],
    offices: [...new Set([roleConfig.department, ...(adminOffices || []).map((office) => office.department || office.label).filter(Boolean)])],
    faculties: [...new Set((data.archiveTree || []).map((node) => node.name).filter(Boolean))],
    departments: [...new Set(flattenFolderNodes(data.archiveTree || []).map((node) => node.name).filter(Boolean))],
    academicYears: [...new Set(flattenFolderNodes(data.archiveTree || [])
      .map((node) => node.name)
      .filter((name) => /^\d{4}-\d{4}$/.test(String(name || ''))))],
    semesters: [...new Set(flattenFolderNodes(data.archiveTree || [])
      .map((node) => node.name)
      .filter((name) => /^\d{4}\/\d$/.test(String(name || ''))))],
    kinds: [
      { value: 'documents', label: 'Documents only' },
      { value: 'folders', label: 'Folders only' }
    ]
  }
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
  const hideHeaderBrowse = usesOfficeDashboardFormat(session.role) || isLibrarian
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
  const effectiveUploadPlacementSummary = formatUploadPlacementSummary({
    faculty: form.faculty || uploadPlacement?.faculty,
    department: form.department || uploadPlacement?.department,
    academicYear: form.placementAcademicYear || uploadPlacement?.academicYear,
    semester: form.placementSemester || uploadPlacement?.semester
  })
  const uploadTitlePreview = usesPlacementUpload
    ? buildPlacementUploadTitle(form, studentLookupResult?.studentNumber || form.studentNumber)
    : getCategoryMeta(form.category).label

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
        ? 'Project approved. It was moved to the student Archive project and appears in Library Accepted.'
        : 'Project rejected. It was moved to Library Rejected (hidden from the student folder tree).')
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
          setForm((current) => applyExistingStudentPlacement(current, profile, { preserveDocumentTerm: true }))
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
    setAppFolderBuilderError('')
    const parentFolder = folderDetail?.id === parentId
      ? folderDetail
      : (parentId ? findFolderNode(data.archiveTree || [], parentId) : null)
    const placement = resolveFolderUploadPlacement(parentFolder || folderDetail)
    setAppConfirm({
      title: 'Create new folder',
      message: isStudent
        ? `Create a subfolder inside "${parentName}". The default folders themselves cannot be renamed or deleted.`
        : `Create a student folder inside "${parentName}". Enter the Student ID — uploaded files for that student go inside this folder.`,
      confirmLabel: 'Create folder',
      inputLabel: isStudent ? 'Folder name' : undefined,
      inputPlaceholder: isStudent ? 'Enter folder name' : undefined,
      folderBuilderPlacement: isStudent ? null : placement,
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
      const submittedValue = appConfirm.folderBuilderPlacement || appConfirm.inputLabel
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
    if (action === 'dept-archive') {
      setDashboardView('default')
      setSelectedAdminOffice(null)
      setSelectedCategory('')
      setSearchQuery('')
      setStudentSearchProfile(null)
      setSearchResults(null)
      getPublishedArchiveTree()
        .then((node) => {
          if (node?.id) {
            openFolder(node.id)
          } else {
            showNotice('Department archive is not ready yet.')
          }
        })
        .catch((err) => showNotice(err.message || 'Unable to open department archive.'))
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
      ? studentQuickAccess.filter((item) => item.action !== 'archive')
      : staffQuickAccess
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

  function clearSelectedUploadFile() {
    setFile(null)
    setScanResult(null)
    setScanError('')
    setFilePreviewOpen(false)
    if (uploadFileInputRef.current) {
      uploadFileInputRef.current.value = ''
    }
  }

  async function handleUploadFileSelect(nextFile, inputElement) {
    setScanResult(null)
    setScanError('')
    setFilePreviewOpen(false)
    if (!nextFile) {
      setFile(null)
      return
    }
    const validation = await validatePdfFile(nextFile)
    if (!validation.ok) {
      setFile(null)
      setScanError(validation.message)
      if (inputElement) {
        inputElement.value = ''
      }
      return
    }
    setFile(nextFile)
    setUploadQueue((current) => [...current, {
      id: `${Date.now()}-${nextFile.name}`,
      file: nextFile,
      status: 'pending',
      documentTypeId: form.documentTypeId,
      categoryDefinitionId: form.categoryDefinitionId,
      academicYear: form.academicYear,
      semester: form.semester,
      category: form.category
    }])
    const pages = await countPdfPages(nextFile)
    if (pages) {
      setForm((current) => ({ ...current, pageCount: pages }))
    }
  }

  function removeQueuedUpload(queueId) {
    setUploadQueue((current) => {
      const next = current.filter((item) => item.id !== queueId)
      if (file && current.find((item) => item.id === queueId)?.file === file) {
        const replacement = next[next.length - 1]?.file || null
        setFile(replacement)
      }
      return next
    })
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
    setScanResult(null)
    setScanError('')
    setScanBusy(false)
    setFilePreviewOpen(false)
    setUploadQueue([])
    clearSelectedUploadFile()
    setStudentLookupResult(null)
    setStudentLookupError('')
    setStudentLookupInfo('')
    setStudentEntryMode('idle')
    setForm({
      ...buildDefaultUploadForm(),
      category: roleConfig.defaultCategory || visibleDocumentCategories[0]?.value || buildDefaultUploadForm().category,
      uploadedBy: session?.fullName || session?.username || '',
      faculty: placement?.faculty || '',
      department: placement?.department || '',
      placementAcademicYear: placement?.academicYear || '',
      placementSemester: placement?.semester || '',
      academicYear: placement?.academicYear || '',
      semester: placement?.semester || '',
      issueDate: todayInputValue()
    })
    setModalOpen(true)
  }

  function closeUploadModal() {
    setModalOpen(false)
    setUploadSourceMode('file')
    setScanResult(null)
    setScanError('')
    setScanBusy(false)
    setValidationOverride(false)
    setFilePreviewOpen(false)
    setUploadQueue([])
    clearSelectedUploadFile()
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
    if (!scanResult?.verified && !validationOverride) {
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
    if (usesPlacementUpload && (!form.faculty || !form.department || !form.placementAcademicYear || !form.placementSemester)) {
      showNotice('Upload placement could not be determined. Open a semester folder under a department and try again.')
      return
    }
    if (usesPlacementUpload && (!form.academicYear || !form.semester)) {
      showNotice('Select the document academic year and semester used to arrange files inside the student folder.')
      return
    }
    if (usesPlacementUpload && !form.documentTypeId) {
      showNotice('Select a document sub-category before uploading.')
      return
    }
    setUploadBusy(true)
    try {
      const studentNumber = normalizeStudentId(form.studentNumber)
      const resolvedPageCount = Number(scanResult?.pageCount || form.pageCount) || 1
      const payload = usesPlacementUpload
        ? {
            studentNumber,
            studentName: form.studentName,
            faculty: form.faculty,
            department: form.department,
            uploadedBy: form.uploadedBy,
            category: form.category,
            categoryDefinitionId: form.categoryDefinitionId ? Number(form.categoryDefinitionId) : null,
            documentTypeId: form.documentTypeId ? Number(form.documentTypeId) : null,
            pageCount: resolvedPageCount,
            academicYear: String(form.academicYear || '').trim() || null,
            semester: String(form.semester || '').trim() || null,
            placementAcademicYear: String(form.placementAcademicYear || '').trim() || null,
            placementSemester: String(form.placementSemester || '').trim() || null,
            issueDate: form.issueDate || todayInputValue(),
            title: buildPlacementUploadTitle(form, studentLookupResult?.studentNumber || studentNumber),
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
            categoryDefinitionId: form.categoryDefinitionId ? Number(form.categoryDefinitionId) : null,
            documentTypeId: form.documentTypeId ? Number(form.documentTypeId) : null,
            title: getCategoryMeta(form.category).label,
            pageCount: resolvedPageCount,
            marks: form.marks === '' ? null : Number(form.marks),
            academicYear: isStudent ? null : String(form.academicYear || '').trim() || null,
            semester: isStudent ? null : String(form.semester || '').trim() || null
          }
      const queueItems = uploadQueue.length ? uploadQueue : [{
        id: 'current',
        file,
        status: 'pending',
        documentTypeId: form.documentTypeId,
        categoryDefinitionId: form.categoryDefinitionId,
        academicYear: form.academicYear,
        semester: form.semester,
        category: form.category
      }]
      for (const item of queueItems) {
        const itemPayload = {
          ...payload,
          category: item.category || payload.category,
          categoryDefinitionId: item.categoryDefinitionId
            ? Number(item.categoryDefinitionId)
            : payload.categoryDefinitionId,
          documentTypeId: item.documentTypeId ? Number(item.documentTypeId) : payload.documentTypeId,
          academicYear: String(item.academicYear || payload.academicYear || '').trim() || null,
          semester: String(item.semester || payload.semester || '').trim() || null
        }
        await submitUpload(itemPayload, item.file, null, { validationOverride })
      }
      showNotice(queueItems.length > 1 ? `Uploaded ${queueItems.length} documents successfully.` : 'Document uploaded successfully.')
      closeUploadModal()
      setFile(null)
      setUploadQueue([])
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
      onNotify={showNotice}
    />
  )

  return (
    <div className="app-shell">
      <div className="workspace" style={{ '--fluent-sidebar-width': `${sidebarWidth}px` }}>
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
                    || (item.action === 'shared' && dashboardView === 'shared')
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
                      {item.action === 'shared' && sharedCount ? <strong>{sharedCount}</strong> : null}
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

          {!isAdmin && isStudent ? (
            <>
              <StudentDefaultFoldersNav
                nodes={data.archiveTree || []}
                activeFolderId={activeFolderId}
                onOpenFolder={openFolder}
                onNotify={showNotice}
              />
              <StudentDepartmentArchiveNav
                onOpenDepartmentArchive={() => {
                  getPublishedArchiveTree()
                    .then((node) => {
                      if (node?.id) {
                        openFolder(node.id)
                      } else {
                        showNotice('Department archive is not ready yet.')
                      }
                    })
                    .catch((err) => showNotice(err.message || 'Unable to open department archive.'))
                }}
                onNotify={showNotice}
              />
            </>
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
        <div
          className="layout-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onMouseDown={startSidebarResize}
        />

        <main className="main-panel">
          {notice ? (
            <div className="toast-notice" role="status" aria-live="polite">
              {notice}
            </div>
          ) : null}
          {searchPopupOpen ? (
            <div className="modal-backdrop search-popup-backdrop" onClick={() => setSearchPopupOpen(false)} role="presentation">
              <div
                className="modal search-popup-modal"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Archive search"
              >
                <div className="modal-head search-popup-head">
                  <div>
                    <p className="eyebrow">Archive search</p>
                    <h2>Find folders and documents</h2>
                  </div>
                  <button
                    type="button"
                    className="ghost-icon"
                    aria-label="Close search"
                    onClick={() => {
                      setSearchPopupOpen(false)
                      setSearchQuery('')
                    }}
                  >
                    <XIcon className="icon" />
                  </button>
                </div>
                <label className="main-search-field search-popup-field">
                  <SearchIcon className="icon search" />
                  <input
                    ref={mainSearchInputRef}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by letter, number, student ID, folder, or file..."
                    aria-label="Archive search"
                    autoFocus
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
                <div className="search-popup-body">
                  {deferredQuery ? (
                    <GlobalSearchResults
                      query={settledSearchQuery || deferredQuery}
                      busy={searchBusy || (Boolean(searchQuery.trim()) && searchQuery.trim() !== settledSearchQuery)}
                      results={searchResults}
                      studentProfile={studentSearchProfile}
                      mode={usesOfficeDashboardFormat(session.role) ? 'registrar' : 'documents'}
                      filters={searchFilters}
                      filterOptions={searchFilterOptions}
                      onFilterChange={setSearchFilters}
                      onClear={() => setSearchQuery('')}
                      onOpenDocument={(documentId) => {
                        setSearchPopupOpen(false)
                        return openDocument(documentId).catch((err) => showNotice(err.message || 'Unable to open document.'))
                      }}
                      onDownloadDocument={handleDownloadDocumentById}
                      onOpenFolder={(folderId) => {
                        setSearchPopupOpen(false)
                        handleOpenArchiveFolder(folderId, studentSearchProfile?.studentNumber)
                      }}
                    />
                  ) : (
                    <p className="inline-note search-popup-hint">
                      Type a student ID, document name, or folder name to search across the archive.
                    </p>
                  )}
                </div>
              </div>
            </div>
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
              onOpenSearch={() => {
                setSearchPopupOpen(true)
                window.setTimeout(() => mainSearchInputRef.current?.focus(), 50)
              }}
              onNotify={showNotice}
              onDataChange={refreshExplorerData}
              onArchivedChange={handleArchivedChange}
              onReservationChange={() => setReservationRefreshToken((value) => value + 1)}
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
                  filters={searchFilters}
                  filterOptions={searchFilterOptions}
                  onFilterChange={setSearchFilters}
                  onClear={() => setSearchQuery('')}
                  onOpenDocument={(documentId) => openDocument(documentId).catch((err) => showNotice(err.message || 'Unable to open document.'))}
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
              onCreateFolder={handleTreeAddFolder}
              onEditFinalYearProject={(documentId) => {
                setStudentFypEditId(documentId)
                setStudentFypWizardOpen(true)
              }}
              onBrowse={() => {
                const defaults = findStudentDefaultFolders(data.archiveTree || [])
                const target = defaults.projects || defaults.official
                if (target?.id) {
                  openFolder(target.id)
                } else {
                  showNotice('Your Official Documents and Final Year Project folders will appear after the workspace is ready.')
                }
              }}
              onBrowseDepartmentArchive={() => {
                getPublishedArchiveTree()
                  .then((node) => {
                    if (node?.id) {
                      openFolder(node.id)
                    } else {
                      showNotice('Department archive is not ready yet.')
                    }
                  })
                  .catch((err) => showNotice(err.message || 'Unable to open department archive.'))
              }}
              onOpenDocument={(documentId) => openDocument(documentId).catch((err) => showNotice(err.message || 'Unable to open document.'))}
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
                  {!showOfficeDashboardFormat && !isHod ? (
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
                  filters={searchFilters}
                  filterOptions={searchFilterOptions}
                  onFilterChange={setSearchFilters}
                  onClear={() => setSearchQuery('')}
                  onOpenDocument={(documentId) => openDocument(documentId).catch((err) => showNotice(err.message || 'Unable to open document.'))}
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
                {!showOfficeDashboardFormat ? (
                  <StatCard label="Pending approvals" value={data.pendingApprovals} caption="in your queue" accent="approvals" />
                ) : null}
                <StatCard label="Department files" value={data.departmentFiles} caption={departmentLabel || 'All departments'} accent="department" />
                <StatCard label="Storage" value={formatBytes(data.storageUsedBytes)} caption={`of ${formatBytes(data.storageLimitBytes)}`} accent="storage" />
              </section>

              <section className={`dash-grid ${showOfficeDashboardFormat ? 'dash-grid-single' : ''}`}>
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
                        ) : dashboardView === 'shared' ? (
                          sharedBusy ? (
                            <tr>
                              <td colSpan="6" className="empty-state">Loading shared items...</td>
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
                                <td>{formatDateTime(item.sharedAt)}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="dash-text-btn"
                                    onClick={() => {
                                      if (item.itemType === 'DOCUMENT' && item.documentId) {
                                        openDocument(item.documentId).catch((err) => {
                                          showNotice(err.message || 'Unable to open document.')
                                        })
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
                              <td colSpan="6" className="empty-state">
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

                {!showOfficeDashboardFormat ? (
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
        folderBuilderPlacement={appConfirm?.folderBuilderPlacement}
        folderBuilderError={appFolderBuilderError}
        onFolderBuilderChange={(name, error) => {
          setAppConfirmInput(name || '')
          setAppFolderBuilderError(error || '')
        }}
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
              setAppFolderBuilderError('')
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
                        ? 'Submit your final year project for librarian review.'
                        : 'Complete the form and attach a PDF to store it in the archive.'}
                    </p>
                  ) : null}
                </div>
              </div>
              <button className="ghost-icon" type="button" onClick={closeUploadModal} aria-label="Close upload dialog">
                <XIcon className="icon" />
              </button>
            </div>

            <form className="upload-form" onSubmit={handleUpload}>
              <section className="upload-doc-type-sticky">
                <DocumentTypePicker
                  categoryDefinitionId={form.categoryDefinitionId}
                  documentTypeId={form.documentTypeId}
                  onChange={({ categoryDefinitionId, documentTypeId, category, categoryName, typeName }) => {
                    setForm((current) => ({
                      ...current,
                      categoryDefinitionId: categoryDefinitionId || '',
                      documentTypeId: documentTypeId || '',
                      category: category || current.category,
                      categoryName: categoryName || '',
                      typeName: typeName || ''
                    }))
                  }}
                  category={form.category}
                  office={resolveCatalogOffice(session?.role)}
                  onNotify={showNotice}
                />
              </section>

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
                      <span>Student folder year</span>
                      <strong>{form.placementAcademicYear || '—'}</strong>
                    </div>
                    <div className="upload-context-field">
                      <span>Student folder semester</span>
                      <strong>{form.placementSemester || '—'}</strong>
                    </div>
                    <AcademicYearField
                      label="Document academic year"
                      value={form.academicYear}
                      onChange={(year) => setForm((current) => ({
                        ...current,
                        academicYear: year,
                        semester: current.semester && semesterOptionsForAcademicYear(year).some((option) => option.value === current.semester)
                          ? current.semester
                          : ''
                      }))}
                    />
                    <label>
                      <span>Document semester</span>
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
                      <small className="lookup-hint">
                        Arranges the file inside the student ID folder: Student / Year / Semester / Category / Type.
                      </small>
                    </label>
                    <label>
                      <span>Issue date</span>
                      <input
                        type="date"
                        value={form.issueDate}
                        onChange={(event) => setForm({ ...form, issueDate: event.target.value })}
                      />
                    </label>
                  </div>

                  {form.academicYear && form.semester && (form.studentNumber?.trim() || studentLookupResult?.studentNumber) ? (
                    <p className="upload-generated-title">
                      Generated title: <strong>{uploadTitlePreview}</strong>
                    </p>
                  ) : null}
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
                  documentTypeLocked ? (
                    <div className="upload-role-note">
                      <div>
                        <p className="eyebrow">Document type</p>
                        <strong>{getCategoryMeta(form.category).label}</strong>
                        <span>
                          {isStudent
                            ? 'Students can only upload final year project documents.'
                            : 'This role only uploads this document category.'}
                        </span>
                      </div>
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
                        {`Title will default to ${getCategoryMeta(form.category).label}.`}
                      </small>
                    </label>
                  )
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
                <div className="phone-qr-modal-backdrop" onClick={() => setUploadSourceMode('file')} role="presentation">
                  <div className="phone-qr-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Phone scanner">
                    <UploadPhoneScanPanel
                      variant="modal"
                      onClose={() => setUploadSourceMode('file')}
                      onNotify={showNotice}
                      category={form.category}
                      office={resolveCatalogOffice(session?.role)}
                      documentTypeId={form.documentTypeId}
                      onDocumentTypeChange={(documentTypeId) => setForm((current) => ({ ...current, documentTypeId: documentTypeId || '' }))}
                      studentNumber={form.studentNumber}
                      studentName={form.studentName}
                      onImport={(importedFile, pageCount, reviewMeta = {}) => {
                        setUploadSourceMode('file')
                        setFile(importedFile)
                        setScanResult(reviewMeta.scanResult || null)
                        setScanError('')
                        setForm((current) => ({
                          ...current,
                          pageCount: pageCount || current.pageCount
                        }))
                        if (reviewMeta.files?.length) {
                          setUploadQueue(reviewMeta.files.map((queuedFile, index) => ({
                            id: `${Date.now()}-${index}-${queuedFile.name}`,
                            file: queuedFile,
                            status: 'pending'
                          })))
                        }
                      }}
                    />
                  </div>
                </div>
              ) : null}

              {uploadSourceMode === 'file' ? (
              <div
                className={`upload-file-section full-width upload-drop-zone${uploadDragOver ? ' is-drag-over' : ''}`}
                onDragEnter={(event) => {
                  event.preventDefault()
                  setUploadDragOver(true)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  setUploadDragOver(true)
                }}
                onDragLeave={(event) => {
                  event.preventDefault()
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setUploadDragOver(false)
                  }
                }}
                onDrop={async (event) => {
                  event.preventDefault()
                  setUploadDragOver(false)
                  const droppedFile = event.dataTransfer?.files?.[0] || null
                  if (droppedFile) {
                    await handleUploadFileSelect(droppedFile)
                  }
                }}
              >
                <span className="upload-file-label">File</span>
                <input
                  ref={uploadFileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="upload-file-input-hidden"
                  onChange={async (event) => {
                    const nextFile = event.target.files?.[0] || null
                    await handleUploadFileSelect(nextFile, event.target)
                  }}
                />
                {!file ? (
                  <button
                    type="button"
                    className="upload-file-choose"
                    onClick={() => uploadFileInputRef.current?.click()}
                  >
                    Choose PDF
                  </button>
                ) : (
                  <div className="upload-file-card">
                    <div className="upload-file-card-copy">
                      <strong>{file.name}</strong>
                      <span>
                        {formatBytes(file.size)}
                        {form.pageCount ? ` · ${form.pageCount} page${Number(form.pageCount) === 1 ? '' : 's'}` : ''}
                      </span>
                    </div>
                    <div className="upload-file-card-actions">
                      <button
                        type="button"
                        className="ghost-btn tiny-btn"
                        onClick={() => setFilePreviewOpen((current) => !current)}
                      >
                        {filePreviewOpen ? 'Hide preview' : 'Preview'}
                      </button>
                      <button
                        type="button"
                        className="ghost-btn tiny-btn"
                        onClick={() => uploadFileInputRef.current?.click()}
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        className="ghost-btn tiny-btn"
                        onClick={clearSelectedUploadFile}
                      >
                        Remove
                      </button>
                    </div>
                    {filePreviewOpen && filePreviewUrl ? (
                      <iframe
                        className="upload-file-preview"
                        src={filePreviewUrl}
                        title={`Preview ${file.name}`}
                      />
                    ) : null}
                  </div>
                )}
              </div>
              ) : null}

              {uploadSourceMode === 'file' && uploadQueue.length ? (
                <div className="upload-batch-queue">
                  <p className="eyebrow">Upload queue ({uploadQueue.length})</p>
                  {uploadQueue.map((item) => (
                    <div key={item.id} className="upload-batch-queue-item">
                      <div className="upload-batch-queue-copy">
                        <strong>{item.file.name}</strong>
                        <span>{item.academicYear || '—'} · {item.semester || '—'} · {item.documentTypeId ? `Type #${item.documentTypeId}` : 'Default type'}</span>
                      </div>
                      <button type="button" className="ghost-btn tiny-btn btn-danger" onClick={() => removeQueuedUpload(item.id)}>Remove</button>
                    </div>
                  ))}
                </div>
              ) : null}

              {uploadSourceMode === 'file' && file ? (
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
                      {scanResult.similarityScore != null ? (
                        <p className="upload-scan-similarity">
                          Similarity: {scanResult.similarityScore}%
                          {scanResult.templateTitle ? ` · ${scanResult.templateTitle}` : ''}
                        </p>
                      ) : null}
                      {scanResult.failedRules?.length ? (
                        <ul className="upload-scan-failed-rules">
                          {scanResult.failedRules.map((rule) => <li key={rule}>{rule}</li>)}
                        </ul>
                      ) : null}
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

              {!isStudent && (session?.role === 'ADMIN' || session?.role === 'REGISTRAR') && scanResult && !scanResult.verified ? (
                <label className="upload-override-field">
                  <input
                    type="checkbox"
                    checked={validationOverride}
                    onChange={(event) => setValidationOverride(event.target.checked)}
                  />
                  <span>Override validation (audit logged)</span>
                </label>
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
                  disabled={!file || uploadBusy || scanBusy || (!scanResult?.verified && !validationOverride)}
                >
                  <UploadIcon className="icon" />
                  {uploadBusy ? 'Uploading...' : 'Upload to archive'}
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
                  onClick={() => openDocument(approvalReviewTask.documentId).catch((err) => showNotice(err.message || 'Unable to open file.'))}
                >
                  <DownloadIcon className="icon" />
                  Open submitted file
                </button>
              ) : null}
              <label style={{ display: 'grid', gap: 8, marginTop: 16 }}>
                <span>Decision note</span>
                <textarea
                  rows={4}
                  value={approvalReviewNote}
                  onChange={(event) => setApprovalReviewNote(event.target.value)}
                  placeholder="Required for rejection. Optional for approval."
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
