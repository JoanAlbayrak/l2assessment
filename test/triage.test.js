import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateUrgency } from '../src/utils/urgencyScorer.js'
import { getRecommendedAction, shouldEscalate, getAvailableCategories } from '../src/utils/templates.js'
import { parseCategoryResponse } from '../src/utils/parseCategory.js'
import { categorizeWith, SYSTEM_PROMPT } from '../src/utils/categorize.js'

// ---- urgency: the 8 original sample messages ----

test('a short production emergency is High, not Low', () => {
  assert.equal(calculateUrgency('Database connection lost'), 'High')
})

test('a short urgent outage message is High', () => {
  assert.equal(calculateUrgency('Server down now'), 'High')
})

test('a friendly thank-you with exclamation marks is Low', () => {
  assert.equal(calculateUrgency('Thank you so much! Your team has been incredibly helpful and I really appreciate the fast response!'), 'Low')
})

test('a feature request is Low', () => {
  assert.equal(calculateUrgency('Could you add an export to CSV feature? Would be really useful for my reports.'), 'Low')
})

test('a message with no problem signals is Low, so Medium keeps its meaning', () => {
  assert.equal(calculateUrgency('hi'), 'Low')
  assert.equal(calculateUrgency('What are your business hours?'), 'Low')
  assert.equal(calculateUrgency(''), 'Low')
  assert.equal(calculateUrgency(undefined), 'Low')
})

test('a payment failure plus lost access is High (two kinds of signal)', () => {
  assert.equal(calculateUrgency("My payment failed and now I can't access the dashboard. Is there a bug or do I need to update my credit card?"), 'High')
})

// ---- urgency: what does not change the score ----

test('thanks does not hide a real problem', () => {
  assert.equal(calculateUrgency('Thanks for the reply, but the dashboard is still not working'), 'Medium')
})

test('a question mark or exclamation marks do not change a real problem', () => {
  assert.equal(calculateUrgency("Why can't I log in? I'm locked out of my account"), 'High')
  assert.equal(calculateUrgency("I'm locked out of my account!!!"), 'High')
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

// ---- urgency: negation and word boundaries ----

test('a negated signal does not count', () => {
  assert.equal(calculateUrgency('This is not urgent, just a question about invoices'), 'Low')
  assert.equal(calculateUrgency("I am no longer locked out, thanks"), 'Low')
  assert.equal(calculateUrgency('No rush at all, the export error is minor'), 'Medium') // "error" is still there
  assert.equal(calculateUrgency("It's not a security issue, I just forgot my nickname"), 'Low')
})

test('known limit: a resolved problem described after the fact still counts', () => {
  assert.equal(calculateUrgency("I was locked out earlier but I'm fine now"), 'High')
})

test('a signal after a negator more than 3 words away still counts', () => {
  assert.equal(calculateUrgency('I do not know why, but yesterday my whole team got locked out'), 'High')
})

test('signals match whole words, with common endings', () => {
  assert.equal(calculateUrgency('Please share the reproduction steps for the colour theme'), 'Low') // "production" inside "reproduction"
  assert.equal(calculateUrgency('The app keeps crashing on startup'), 'High')
  assert.equal(calculateUrgency('I get errors on the export page'), 'Medium')
  assert.equal(calculateUrgency('We need this urgently'), 'Medium')
})

// ---- urgency: messages not used while tuning ----

const unseen = [
  ['Our whole team is locked out of the account and we have a deadline today', 'High'],
  ['I was charged twice for this month', 'High'],
  ['The CSV export fails with an error', 'Medium'],
  ['Loving the new dashboard, great work', 'Low'],
  ['Can you tell me how to change my password?', 'Low'],
  ['Everything is on fire and nobody can work', 'Low'], // known miss: paraphrases are not recognised
]
for (const [message, expected] of unseen) {
  test(`unseen: "${message.slice(0, 40)}" is ${expected}`, () => {
    assert.equal(calculateUrgency(message), expected)
  })
}

// ---- actions and escalation ----

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

test('escalation ignores a negated risk word', () => {
  assert.equal(shouldEscalate('General Inquiry', 'Low', 'This is not a security issue, just a question'), false)
})

// ---- category parsing ----

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

// ---- the model call, with a stubbed client (no API key needed) ----

const stub = (content) => {
  const calls = []
  return { calls, chat: { completions: { create: async (args) => { calls.push(args); return { choices: [{ message: { content } }] } } } } }
}
const fallback = (m) => ({ category: 'Fallback', reasoning: m })

test('model path: sends the system prompt, the raw message and temperature 0', async () => {
  const client = stub('{"category":"Technical Problem","reasoning":"Outage."}')
  const result = await categorizeWith(client, 'Database connection lost', fallback)
  assert.equal(result.category, 'Technical Problem')
  const [call] = client.calls
  assert.equal(call.temperature, 0)
  assert.equal(call.messages[0].content, SYSTEM_PROMPT)
  assert.deepEqual(call.messages[1], { role: 'user', content: 'Database connection lost' })
})

test('model path: JSON wrapped in prose still works', async () => {
  const result = await categorizeWith(stub('Sure!\n{"category":"General Inquiry","reasoning":"A question."}'), 'x', fallback)
  assert.equal(result.category, 'General Inquiry')
})

test('model path: garbage from the model becomes Unknown, not a guess', async () => {
  const result = await categorizeWith(stub('I think it is probably billing, or maybe technical'), 'x', fallback)
  assert.equal(result.category, 'Unknown')
})

test('model path: an API error uses the fallback', async () => {
  const client = { chat: { completions: { create: async () => { throw new Error('network down') } } } }
  const original = console.warn
  console.warn = () => {}
  try {
    assert.deepEqual(await categorizeWith(client, 'hello', fallback), { category: 'Fallback', reasoning: 'hello' })
  } finally {
    console.warn = original
  }
})
