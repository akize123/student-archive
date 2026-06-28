import React from 'react'

function SvgIcon({ children, className = '' }) {
  return (
    <svg className={`icon ${className}`.trim()} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export function SearchIcon(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5" />
    </SvgIcon>
  )
}

export function BellIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M15 17H5l1.5-2.5V10a5.5 5.5 0 0 1 11 0v4.5L19 17h-2" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </SvgIcon>
  )
}

export function UploadIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </SvgIcon>
  )
}

export function FolderIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </SvgIcon>
  )
}

export function DocumentIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5" />
    </SvgIcon>
  )
}

export function ClockIcon(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </SvgIcon>
  )
}

export function StarIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="m12 3 2.9 6.1 6.7.9-4.8 4.7 1.1 6.7L12 18.9 6.1 21.4l1.1-6.7L2.4 10l6.7-.9z" />
    </SvgIcon>
  )
}

export function ShareIcon(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="18" cy="5" r="2" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="18" cy="19" r="2" />
      <path d="m8 11 8-4" />
      <path d="m8 13 8 4" />
    </SvgIcon>
  )
}

export function TrashIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M9 7V4h6v3" />
    </SvgIcon>
  )
}

export function ChevronLeftIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="m15 6-6 6 6 6" />
    </SvgIcon>
  )
}

export function ChevronRightIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="m9 6 6 6-6 6" />
    </SvgIcon>
  )
}

export function ArrowRightIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </SvgIcon>
  )
}

export function CheckIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="m5 13 4 4L19 7" />
    </SvgIcon>
  )
}

export function XIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </SvgIcon>
  )
}

export function GridIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
    </SvgIcon>
  )
}

export function FolderPlusIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v3" />
      <path d="M12 11v6" />
      <path d="M9 14h6" />
      <path d="M3 13v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
    </SvgIcon>
  )
}

export function ArrowUpIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </SvgIcon>
  )
}

export function RefreshIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </SvgIcon>
  )
}

export function DownloadIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M12 16V4" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 20h14" />
    </SvgIcon>
  )
}

export function ListIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </SvgIcon>
  )
}

export function FilterIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M4 5h16l-6 7v5l-4 2v-7z" />
    </SvgIcon>
  )
}

export function HomeIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </SvgIcon>
  )
}

export function EyeIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2.5" />
    </SvgIcon>
  )
}

export function EyeOffIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6A2.5 2.5 0 0 0 12 15a2.5 2.5 0 0 0 1.4-.4" />
      <path d="M6.7 6.7C4.6 8.1 3 10 2 12s3.5 6 10 6c1.8 0 3.4-.4 4.8-1.1" />
      <path d="M14.1 14.1c-.8.8-1.9 1.3-3.1 1.3-2.5 0-4.5-2-4.5-4.5 0-1.2.5-2.3 1.3-3.1" />
      <path d="M17.4 9.6C18.5 10.4 19.4 11.3 20 12c0 0-3.5 6-10 6-1.1 0-2.1-.2-3-.5" />
    </SvgIcon>
  )
}

