export const studentFacultyOptions = [
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

export const facultyOptions = studentFacultyOptions.map(({ value, label }) => ({ value, label }))

export const academicDepartmentOptions = studentFacultyOptions.flatMap((faculty) =>
  faculty.departments.map((department) => ({
    faculty: faculty.label,
    value: department,
    label: department
  }))
)

/** Faculty that owns an academic department (e.g. Software Engineering → Faculty of Information Technology). */
export function facultyForAcademicDepartment(department) {
  const needle = String(department || '').trim().toLowerCase()
  if (!needle) {
    return null
  }
  const match = studentFacultyOptions.find((faculty) =>
    (faculty.departments || []).some((entry) => String(entry).trim().toLowerCase() === needle)
  )
  return match?.value || null
}
