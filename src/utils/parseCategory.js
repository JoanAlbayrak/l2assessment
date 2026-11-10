/**
 * Reads the model's answer into one of the known categories.
 *
 * The earlier code looked for the word "billing", "technical", "feature" or
 * "inquiry" anywhere in a free-text answer, so "This is not a billing issue, it
 * is a technical problem" became Billing. The model is now asked for JSON with a
 * category from a fixed list, and anything else is "Unknown" (sent to manual
 * review) rather than a guess.
 */

export const CATEGORIES = ["Billing Issue", "Technical Problem", "General Inquiry", "Feature Request"]

export function parseCategoryResponse(content) {
  const text = String(content ?? "")
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      const data = JSON.parse(match[0])
      const category = CATEGORIES.find((c) => c.toLowerCase() === String(data.category ?? "").trim().toLowerCase())
      if (category) return { category, reasoning: String(data.reasoning ?? "").trim() || text }
    } catch {
      // fall through to Unknown
    }
  }
  return { category: "Unknown", reasoning: text }
}
