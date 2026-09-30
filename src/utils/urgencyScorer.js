/**
 * Urgency Scorer - Rule-based urgency, used when the AI is unavailable.
 * Scores business impact from what the message says, not from tone,
 * punctuation, message length or the time of day.
 */

const HIGH_IMPACT = [
  'down', 'outage', 'offline', 'crash', 'crashed', 'crashing', 'data loss', 'lost data', 'deleted',
  'connection lost', 'security', 'breach', 'hacked', 'compromised',
  "can't access", 'cannot access', "can't log in", 'cannot log in', 'locked out',
  'charged twice', 'double charged', 'overcharged', 'unauthorized charge',
  'production', 'urgent', 'asap', 'emergency', 'critical',
]

const MEDIUM_IMPACT = [
  'error', 'bug', 'broken', 'not working', "doesn't work", "won't load",
  'loading', 'timing out', 'timeout', 'slow', 'failed', 'fails',
  'payment', 'refund', 'invoice', 'cancel',
]

const matches = (text, phrases) =>
  phrases.some(phrase => new RegExp(`\\b${phrase}\\b`).test(text))

export function calculateUrgency(message) {
  const text = message.toLowerCase()

  if (matches(text, HIGH_IMPACT)) return "High"
  if (matches(text, MEDIUM_IMPACT)) return "Medium"
  return "Low"
}
