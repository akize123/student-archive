import React from 'react'

export default function ArchiveLandingVisual() {
  return (
    <div className="auth-visual" aria-label="University document archive system">
      <svg className="auth-visual-svg" viewBox="0 0 520 340" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
        <defs>
          <linearGradient id="authGlow" x1="60" y1="20" x2="460" y2="300" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0054a6" stopOpacity="0.16" />
            <stop offset="1" stopColor="#0054a6" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="authFolder" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#0062b8" />
            <stop offset="1" stopColor="#003d7a" />
          </linearGradient>
          <linearGradient id="authPanel" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#ffffff" />
            <stop offset="1" stopColor="#eef4fb" />
          </linearGradient>
          <linearGradient id="authShelf" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#f8fbff" />
            <stop offset="1" stopColor="#e3edf7" />
          </linearGradient>
          <filter id="authSoftShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#003d7a" floodOpacity="0.10" />
          </filter>
        </defs>

        <circle cx="260" cy="168" r="150" fill="url(#authGlow)" />
        <circle cx="260" cy="168" r="122" stroke="#0054a6" strokeOpacity="0.07" strokeWidth="1.5" strokeDasharray="5 9" />

        <g filter="url(#authSoftShadow)">
          <rect x="108" y="58" width="304" height="228" rx="24" fill="url(#authPanel)" stroke="#0054a6" strokeOpacity="0.14" />
          <rect x="108" y="58" width="304" height="44" rx="24" fill="#0054a6" fillOpacity="0.07" />
          <circle cx="134" cy="80" r="5" fill="#ef5f6c" fillOpacity="0.7" />
          <circle cx="152" cy="80" r="5" fill="#d9a11c" fillOpacity="0.7" />
          <circle cx="170" cy="80" r="5" fill="#2ebc6b" fillOpacity="0.7" />

          <rect x="132" y="118" width="256" height="148" rx="16" fill="url(#authShelf)" stroke="#0054a6" strokeOpacity="0.08" />

          <path d="M156 228V138a10 10 0 0 1 10-10h38l10 10h58a10 10 0 0 1 10 10v90z" fill="url(#authFolder)" />
          <path d="M204 128h58l10 10v16H166v-16a10 10 0 0 1 10-10z" fill="#ffffff" fillOpacity="0.2" />
          <rect x="172" y="158" width="64" height="7" rx="3.5" fill="#ffffff" fillOpacity="0.55" />
          <rect x="172" y="174" width="82" height="7" rx="3.5" fill="#ffffff" fillOpacity="0.38" />
          <rect x="172" y="190" width="52" height="7" rx="3.5" fill="#ffffff" fillOpacity="0.28" />

          <rect x="278" y="128" width="84" height="108" rx="12" fill="#ffffff" stroke="#0054a6" strokeOpacity="0.12" />
          <rect x="292" y="144" width="56" height="68" rx="8" fill="#e6f0f9" />
          <path d="M304 160h32M304 176h24M304 192h36" stroke="#0054a6" strokeOpacity="0.26" strokeWidth="3.5" strokeLinecap="round" />
          <rect x="314" y="218" width="22" height="7" rx="3.5" fill="#0054a6" fillOpacity="0.7" />

          <rect x="132" y="118" width="256" height="10" rx="4" fill="#0054a6" fillOpacity="0.05" />
          <rect x="132" y="176" width="256" height="8" rx="3" fill="#0054a6" fillOpacity="0.06" />
        </g>

        <g opacity="0.88">
          <rect x="88" y="188" width="52" height="66" rx="10" fill="#ffffff" stroke="#0054a6" strokeOpacity="0.14" transform="rotate(-12 114 221)" />
          <path d="M102 206h28M102 220h20M102 234h30" stroke="#0054a6" strokeOpacity="0.2" strokeWidth="3" strokeLinecap="round" transform="rotate(-12 114 221)" />
        </g>

        <g opacity="0.9">
          <rect x="368" y="96" width="56" height="72" rx="10" fill="#ffffff" stroke="#0054a6" strokeOpacity="0.16" transform="rotate(10 396 132)" />
          <path d="M384 114h28M384 130h22M384 146h32" stroke="#0054a6" strokeOpacity="0.22" strokeWidth="3" strokeLinecap="round" transform="rotate(10 396 132)" />
        </g>

        <g className="auth-visual-tree">
          <path d="M260 286V248" stroke="#0054a6" strokeOpacity="0.22" strokeWidth="2" strokeLinecap="round" />
          <path d="M260 248H218M260 248H302" stroke="#0054a6" strokeOpacity="0.18" strokeWidth="2" strokeLinecap="round" />
          <path d="M218 248V232M302 248V232" stroke="#0054a6" strokeOpacity="0.16" strokeWidth="2" strokeLinecap="round" />
          <rect x="206" y="218" width="24" height="18" rx="5" fill="#0062b8" fillOpacity="0.85" />
          <rect x="248" y="218" width="24" height="18" rx="5" fill="#0054a6" fillOpacity="0.95" />
          <rect x="290" y="218" width="24" height="18" rx="5" fill="#003d7a" fillOpacity="0.85" />
        </g>

        <g className="auth-visual-badge">
          <circle cx="260" cy="302" r="20" fill="#ffffff" stroke="#0054a6" strokeOpacity="0.22" strokeWidth="1.5" />
          <circle cx="260" cy="302" r="14" fill="#0054a6" fillOpacity="0.08" />
          <path d="M254 302l4 4 8-8" stroke="#0054a6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  )
}
