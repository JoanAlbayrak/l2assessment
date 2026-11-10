/**
 * Recommendation Templates - maps category (and urgency) to a recommended action
 */

const actionTemplates = {
  "Billing Issue": "Check the customer's billing record and invoices, then reply with the charge details or start a refund review.",
  "Technical Problem": "Ask for the exact error, steps to reproduce and browser or device, then check the status page and open a ticket with engineering.",
  "General Inquiry": "Respond with the relevant FAQ or help-center link.",
  "Feature Request": "Thank the customer, log the request in the product feedback list, and tell them it has been passed to the product team.",
  "Unknown": "Review manually."
}

const HIGH_URGENCY_PREFIX = "Reply within the hour. "

/**
 * Get recommended action for a given category and urgency
 *
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level
 * @returns {string} - Recommended next step
 */
export function getRecommendedAction(category, urgency) {
  const action = actionTemplates[category] || "No recommendation available."
  return urgency === "High" && actionTemplates[category] ? HIGH_URGENCY_PREFIX + action : action
}

/**
 * Get all available categories
 *
 * @returns {string[]} - List of categories
 */
export function getAvailableCategories() {
  return Object.keys(actionTemplates)
}

const ESCALATION_WORDS = ['security', 'breach', 'hacked', 'data loss', 'unauthorized', 'outage', 'charged twice']

/**
 * Escalate high-urgency messages and anything about security, data loss or double charges.
 * (It used to escalate any message over 100 characters, which says nothing about the problem.)
 *
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level
 * @param {string} message - The original message
 * @returns {boolean} - Whether to escalate
 */
export function shouldEscalate(category, urgency, message) {
  const text = String(message ?? '').toLowerCase()
  return urgency === "High" || ESCALATION_WORDS.some((w) => text.includes(w))
}
