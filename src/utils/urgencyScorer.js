/**
 * Urgency Scorer - rule-based urgency calculation.
 *
 * Urgency comes only from what the message says. The earlier version also used
 * message length, exclamation marks, question marks, the day of the week and
 * the hour, so "Database connection lost" scored Low and the same message
 * scored differently on a Saturday.
 */

const CRITICAL = [
  'outage', 'server down', 'servers down', 'down now', 'is down', 'are down', 'went down', 'site down', 'connection lost', 'data loss',
  'lost all', 'lost my data', 'security', 'breach', 'hacked', 'unauthorized', 'cannot log in',
  "can't log in", 'locked out', 'production', 'crash', 'charged twice', 'double charged',
]
const URGENT = ['urgent', 'asap', 'immediately', 'right now', 'emergency', 'deadline', 'blocked', 'critical']
const BLOCKED = [
  "can't access", 'cannot access', "can't use", "isn't working", 'not working', 'stopped working',
  'broken', 'error', 'failed', 'fails', 'unable to',
]
const GRATITUDE = ['thank', 'thanks', 'appreciate', 'kudos', 'great job']
const FEATURE = ['feature request', 'would be great', 'would be nice', 'would like to see', 'could you add', 'please add', 'suggestion']

const has = (text, list) => list.some((w) => text.includes(w))

/**
 * @param {string} message
 * @returns {"High" | "Medium" | "Low"}
 */
export function calculateUrgency(message) {
  const text = String(message ?? '').toLowerCase()
  let score = 50

  if (has(text, CRITICAL)) score += 40
  if (has(text, URGENT)) score += 25
  if (has(text, BLOCKED)) score += 20

  const isProblem = has(text, CRITICAL) || has(text, URGENT) || has(text, BLOCKED)
  // Thanks only lowers urgency when nothing is wrong: "thanks, but it's still broken" stays urgent.
  if (has(text, GRATITUDE) && !isProblem) score -= 30
  if (has(text, FEATURE) && !isProblem) score -= 20

  if (score >= 70) return 'High'
  if (score <= 30) return 'Low'
  return 'Medium'
}
