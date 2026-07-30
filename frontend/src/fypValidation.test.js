import test from 'node:test'
import assert from 'node:assert/strict'
import { validateFypStep1Selection, validateFacePhotoRequirements, validateGithubRepositoryUrl } from './fypValidation.js'

test('accepts faculty and department from the configured AUCA catalog', () => {
  assert.equal(validateFypStep1Selection('Faculty of Business Administration', 'Accounting'), '')
})

test('rejects a department that does not belong to the selected faculty', () => {
  const message = validateFypStep1Selection('Faculty of Information Technology', 'Accounting')
  assert.match(message, /department/i)
})

test('rejects a logo-like image with weak face features', () => {
  const message = validateFacePhotoRequirements({ width: 600, height: 300, colorVariance: 0.01, edgeDensity: 0.01 })
  assert.match(message, /face|portrait|logo/i)
})

test('accepts a portrait-style photo with enough detail', () => {
  const message = validateFacePhotoRequirements({ width: 800, height: 1000, colorVariance: 0.18, edgeDensity: 0.12 })
  assert.equal(message, '')
})

test('accepts a standard GitHub repository URL', () => {
  const result = validateGithubRepositoryUrl('https://github.com/auca/archive')
  assert.equal(result.ok, true)
  assert.equal(result.normalized, 'https://github.com/auca/archive')
})

test('rejects non-repository GitHub links', () => {
  const result = validateGithubRepositoryUrl('https://github.com/auca')
  assert.equal(result.ok, false)
})
