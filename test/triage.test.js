import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateUrgency } from '../src/utils/urgencyScorer.js'
import { getRecommendedAction, shouldEscalate, getAvailableCategories } from '../src/utils/templates.js'
import { parseCategoryResponse } from '../src/utils/parseCategory.js'

test('a short production emergency is High, not Low', () => {
  assert.equal(calculateUrgency('Database connection lost'), 'High')
})

test('a short urgent outage message is High', () => {
  assert.equal(calculateUrgency('Server down now'), 'High')
})

test('a friendly thank-you with exclamation marks is Low, not High', () => {
  assert.equal(calculateUrgency('Thank you so much! Your team has been incredibly helpful and I really appreciate the fast response!'), 'Low')
})

test('thanks does not hide a real problem', () => {
  assert.notEqual(calculateUrgency("Thanks for the reply, but the dashboard is still not working"), 'Low')
})

test('a feature request is Low', () => {
  assert.equal(calculateUrgency('Could you add an export to CSV feature? Would be really useful for my reports.'), 'Low')
})

test('a question mark does not lower a real problem', () => {
  assert.equal(calculateUrgency("Why can't I log in? I'm locked out of my account"), 'High')
})

test('the same message scores the same on any day or hour', () => {
  const RealDate = Date
  const results = new Set()
  for (const iso of ['2026-11-07T03:00:00', '2026-11-09T12:00:00', '2026-11-08T23:00:00']) {
    globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [iso])) } }
    results.add(calculateUrgency('The report page shows an error when I export'))
  }
  globalThis.Date = RealDate
  assert.equal(results.size, 1)
})

test('feature requests no longer get the billing action', () => {
  assert.doesNotMatch(getRecommendedAction('Feature Request', 'Low'), /billing/i)
})

test('every category has its own action', () => {
  const actions = getAvailableCategories().map((c) => getRecommendedAction(c, 'Low'))
  assert.equal(new Set(actions).size, actions.length)
})

test('high urgency changes the recommended action', () => {
  assert.notEqual(getRecommendedAction('Technical Problem', 'High'), getRecommendedAction('Technical Problem', 'Low'))
})

test('escalation follows urgency and risk, not message length', () => {
  const long = 'I wanted to ask how I can change the colour of my dashboard theme because I think the default one is a bit dull for me'
  assert.equal(shouldEscalate('General Inquiry', 'Low', long), false)
  assert.equal(shouldEscalate('Technical Problem', 'High', 'Database connection lost'), true)
  assert.equal(shouldEscalate('Technical Problem', 'Medium', 'I think my account was hacked'), true)
})

test('parses a JSON answer into a known category', () => {
  assert.deepEqual(parseCategoryResponse('{"category": "Billing Issue", "reasoning": "Payment failed."}'), { category: 'Billing Issue', reasoning: 'Payment failed.' })
})

test('parses JSON wrapped in other text', () => {
  assert.equal(parseCategoryResponse('Here you go:\n{"category":"feature request","reasoning":"x"}').category, 'Feature Request')
})

test('a negated mention is not read as the category', () => {
  assert.equal(parseCategoryResponse('This is not a billing issue, it is a technical problem.').category, 'Unknown')
})

test('an unknown category or broken JSON goes to manual review', () => {
  assert.equal(parseCategoryResponse('{"category": "Spam"}').category, 'Unknown')
  assert.equal(parseCategoryResponse('{not json').category, 'Unknown')
  assert.equal(parseCategoryResponse(undefined).category, 'Unknown')
})
