/**
 * Phrase matching shared by the urgency scorer and the escalation rule.
 *
 * - Whole words only: "production" does not match "reproduction".
 * - Common endings are allowed: "crash" also matches crashes, crashed, crashing.
 * - Negated mentions are ignored: "this is not urgent" or "no longer locked out"
 *   do not count as urgent or locked out. A negator within the 3 words before the
 *   phrase cancels it.
 *
 * Limits: this is keyword matching, so it will miss paraphrases ("everything is
 * on fire") and can still be fooled by unusual wording.
 */

const NEGATOR = /\b(?:not|no|never|without|none)\b|n't\b/

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const patternFor = (phrase) => new RegExp(`(?<![a-z])${escape(phrase)}(?:s|es|ed|ing|ly)?(?![a-z])`, 'g')

/** The distinct phrases from `list` that appear in `text` and are not negated. */
export function mentioned(text, list) {
  const lower = String(text ?? '').toLowerCase()
  return list.filter((phrase) => {
    for (const m of lower.matchAll(patternFor(phrase))) {
      const before = lower.slice(0, m.index).split(/\s+/).filter(Boolean).slice(-3).join(' ')
      if (!NEGATOR.test(before)) return true
    }
    return false
  })
}

export const mentions = (text, list) => mentioned(text, list).length > 0
