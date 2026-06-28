import React from 'react'

export default function BrandLogo({ variant = 'compact' }) {
  const isLarge = variant === 'full'

  return (
    <div className={`brand ${isLarge ? 'brand-large auth-brand' : ''}`}>
      <img src="/auca-logo.jpg" alt="Adventist University of Central Africa" className="brand-logo" />
      <div className="brand-copy">
        <strong className="brand-title-serif">Adventist University</strong>
        <span className="brand-subtitle">Of Central Africa</span>
      </div>
    </div>
  )
}
