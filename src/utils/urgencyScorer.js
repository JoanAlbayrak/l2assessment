/**
 * Urgency Scorer - rule-based urgency calculation.
 *
 * Urgency comes only from what the message says. The earlier version also used
 * message length, exclamation marks, question marks, the day of the week and
 * the hour, so "Database connection lost" scored Low and the same message
 * scored differently on a Saturday.
 *
 * A message with no problem signals is Low. Medium means there is a real but
 * limited problem signal, so it stays meaningful for the support queue.
 */

import { mentioned } from './textMatch.js'

export const CRITICAL = [
  'outage', 'server down', 'servers down', 'down now', 'is down', 'are down', 'went down', 'site down',
  'connection lost', 'data loss', 'lost all', 'lost my data', 'security', 'breach', 'hacked', 'unauthorized',
  'cannot log in', "can't log in", 'locked out', 'production', 'crash', 'charged twice', 'double charged',
]
const URGENT = ['urgent', 'asap', 'immediately', 'right now', 'emergency', 'deadline', 'blocked', 'critical']
// Two kinds of "blocked" signal, counted once each so that "fails with an error" is one problem, not two.
const FAILURE = ["isn't working", 'not working', 'stopped working', 'broken', 'error', 'failed', 'fails']
const ACCESS = ["can't access", 'cannot access', "can't use", 'unable to']

/**
 * Points: one critical phrase = High on its own (70). Urgent wording, a failure
 * or lost access = 40 each (Medium); a failure together with lost access, or
 * urgent wording together with either, reaches High.
 * @param {string} message
 * @returns {"High" | "Medium" | "Low"}
 */
export function calculateUrgency(message) {
  let score = 0
  if (mentioned(message, CRITICAL).length) score += 70
  if (mentioned(message, URGENT).length) score += 40
  if (mentioned(message, FAILURE).length) score += 40
  if (mentioned(message, ACCESS).length) score += 40

  if (score >= 70) return 'High'
  if (score >= 30) return 'Medium'
  return 'Low'
}
