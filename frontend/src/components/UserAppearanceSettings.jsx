import React, { useEffect, useState } from 'react'
import { getUserPreferences, updateUserPreferences } from '../api'

export default function UserAppearanceSettings({ onNotify }) {
  const [preferences, setPreferences] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getUserPreferences()
      .then((response) => {
        setPreferences({
          uiDensity: response.uiDensity || 'compact'
        })
      })
      .catch(() => {
        setPreferences({
          uiDensity: 'compact'
        })
      })
  }, [])

  async function persist(nextPreferences) {
    setPreferences(nextPreferences)
    setBusy(true)
    try {
      const saved = await updateUserPreferences({
        uiDensity: nextPreferences.uiDensity
      })
      setPreferences({
        uiDensity: saved.uiDensity || nextPreferences.uiDensity
      })
      onNotify?.('Appearance settings saved.')
    } catch (err) {
      onNotify?.(err.message || 'Unable to save appearance settings.')
    } finally {
      setBusy(false)
    }
  }

  if (!preferences) {
    return <p className="inline-note">Loading appearance settings…</p>
  }

  return (
    <section className="user-appearance-settings">
      <p className="eyebrow">Appearance</p>
      <label className="user-appearance-mode">
        <span>Layout density</span>
        <select
          value={preferences.uiDensity}
          onChange={(event) => persist({
            ...preferences,
            uiDensity: event.target.value
          })}
          disabled={busy}
        >
          <option value="compact">Compact</option>
          <option value="comfortable">Comfortable</option>
        </select>
      </label>
    </section>
  )
}

export function applyFolderColorMode() {
  document.documentElement.dataset.folderColorMode = 'off'
}
