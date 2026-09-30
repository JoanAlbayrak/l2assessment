/**
 * Triage regression test: runs every message in sample-messages.json plus new
 * examples through the rule-based fallback, and checks the AI response parser.
 * Usage: node scripts/test-triage.mjs
 */
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

const server = await createServer({ logLevel: 'error', appType: 'custom', server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] } })
const { getRuleBasedTriage, parseTriageResponse } = await server.ssrLoadModule('/src/utils/llmHelper.js')
const { getRecommendedAction, shouldEscalate } = await server.ssrLoadModule('/src/utils/templates.js')

const samples = JSON.parse(readFileSync(new URL('../sample-messages.json', import.meta.url))).testMessages
const expected = {
  1: ['Technical Problem', 'High'],
  2: ['Feedback', 'Low'],
  3: ['Feature Request', 'Low'],
  4: ['Billing Issue', 'High'], // customer is blocked from the dashboard
  6: ['Technical Problem', 'High'],
  7: ['Feedback', 'Low'],
  8: ['General Inquiry', 'Low'],
}
const cases = samples.filter(s => expected[s.id]).map(s => ({ message: s.message, expect: expected[s.id] }))
cases.push(
  { message: 'I was charged twice for my subscription this month, please refund one of them.', expect: ['Billing Issue', 'High'] },
  { message: 'URGENT!!! We are locked out of our account and our whole team cannot work', expect: ['Technical Problem', 'High'] },
  { message: 'Reports page is really slow today but eventually loads.', expect: ['Technical Problem', 'Medium'] },
  { message: 'It would be great to have a Slack integration for new tickets.', expect: ['Feature Request', 'Low'] },
  { message: 'How do I add a new teammate to my workspace?', expect: ['General Inquiry', 'Low'] },
)

let failures = 0
for (const { message, expect } of cases) {
  const r = getRuleBasedTriage(message)
  const ok = r.category === expect[0] && r.urgency === expect[1]
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.category.padEnd(17)} ${r.urgency.padEnd(6)} ${shouldEscalate(r.category, r.urgency) ? 'ESCALATE ' : '         '}"${message.slice(0, 60)}"`)
  if (!ok) console.log(`      expected ${expect.join(' / ')}`)
}

// Parser: valid AI output is accepted and normalized, invalid output is rejected (-> fallback)
const parserCases = [
  ['{"category":"technical problem","urgency":"HIGH","reasoning":"Server outage."}', { category: 'Technical Problem', urgency: 'High' }],
  ['{"category":"Feedback","urgency":"Low","reasoning":"Thanks."}', { category: 'Feedback', urgency: 'Low' }],
  ['{"category":"Spam","urgency":"Low"}', null],
  ['{"category":"Billing Issue","urgency":"Critical"}', null],
  ['This message is about billing.', null],
]
for (const [input, want] of parserCases) {
  const got = parseTriageResponse(input)
  const ok = want === null ? got === null : got && got.category === want.category && got.urgency === want.urgency
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  parser: ${input.slice(0, 60)}`)
}

const actionOk = getRecommendedAction('Feature Request', 'Low').includes('feedback tracker')
if (!actionOk) failures++
console.log(`${actionOk ? 'PASS' : 'FAIL'}  feature requests no longer get the billing-portal template`)

await server.close()
console.log(failures ? `\n${failures} failure(s)` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
