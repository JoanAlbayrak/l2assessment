/**
 * Recommendation Templates - Maps category and urgency to recommended actions
 */

const actionTemplates = {
  "Billing Issue": {
    High: "Escalate to the billing team immediately; verify the charge or payment failure and reply within 1 hour.",
    default: "Route to the billing team; point the customer to the billing portal for self-service changes.",
  },
  "Technical Problem": {
    High: "Escalate to on-call engineering; check the status page for an active incident and acknowledge the customer right away.",
    default: "Route to technical support; request steps to reproduce, browser/device details and screenshots.",
  },
  "Feature Request": {
    default: "Thank the customer and log the request in the product feedback tracker for the product team.",
  },
  "General Inquiry": {
    default: "Answer directly or share the relevant help-center / FAQ article.",
  },
  "Feedback": {
    default: "Thank the customer and share the feedback with the team. No further action needed.",
  },
}

/**
 * Get recommended action for a given category
 *
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level
 * @returns {string} - Recommended next step
 */
export function getRecommendedAction(category, urgency) {
  const template = actionTemplates[category]
  if (!template) return "Review manually."
  return template[urgency] || template.default
}

/**
 * Get all available categories
 *
 * @returns {string[]} - List of categories
 */
export function getAvailableCategories() {
  return Object.keys(actionTemplates)
}

/**
 * Determines if message should be escalated
 *
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level
 * @returns {boolean} - Whether to escalate
 */
export function shouldEscalate(category, urgency) {
  return urgency === "High" && (category === "Billing Issue" || category === "Technical Problem")
}
