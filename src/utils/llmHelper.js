import Groq from 'groq-sdk';
import { calculateUrgency } from './urgencyScorer';

/**
 * LLM Helper for triaging customer support messages
 * Using Groq API for AI-powered categorization and urgency assessment
 */

export const CATEGORIES = [
  "Billing Issue",
  "Technical Problem",
  "Feature Request",
  "General Inquiry",
  "Feedback",
];

export const URGENCY_LEVELS = ["High", "Medium", "Low"];

// Groq client is created lazily so a missing API key falls back to rules instead of crashing the page
let groq;
function getClient() {
  if (!groq) {
    groq = new Groq({
      apiKey: import.meta.env.VITE_GROQ_API_KEY,
      dangerouslyAllowBrowser: true // Required for browser-based calls (not recommended for production!)
    });
  }
  return groq;
}

const SYSTEM_PROMPT = `You are a support triage assistant for a SaaS company. Classify each customer message.

Categories (pick exactly one):
- "Billing Issue": payments, charges, invoices, refunds, subscriptions, plan changes, payment methods.
- "Technical Problem": outages, errors, bugs, things not loading or not working, access/login problems, data issues.
- "Feature Request": asking for new functionality or improvements to the product.
- "General Inquiry": questions about the product, company, policies or how to do something, with nothing broken.
- "Feedback": praise, thanks, complaints or opinions that do not ask for any action.
If a message mixes billing and technical symptoms, choose the one that is blocking the customer (the root cause).

Urgency (pick exactly one), based on business impact, not on tone, punctuation or message length:
- "High": service outage, production/system down, data loss, security concern, customer fully blocked from using the product, being charged incorrectly.
- "Medium": something is broken or degraded but there is a workaround, or a billing/account request that needs action soon.
- "Low": questions, feature requests, feedback, thanks, anything with no impact on the customer's ability to work.

Respond with JSON only, in this exact shape:
{"category": "<one of the categories>", "urgency": "<High|Medium|Low>", "reasoning": "<1-2 sentences explaining both choices>"}`;

/**
 * Validate and normalize the model's JSON output.
 * Returns null if the output can't be trusted.
 */
export function parseTriageResponse(content) {
  let data;
  try {
    data = JSON.parse(content);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;

  const category = CATEGORIES.find(
    c => c.toLowerCase() === String(data.category || '').trim().toLowerCase()
  );
  const urgency = URGENCY_LEVELS.find(
    u => u.toLowerCase() === String(data.urgency || '').trim().toLowerCase()
  );
  if (!category || !urgency) return null;

  return {
    category,
    urgency,
    reasoning: String(data.reasoning || '').trim() || 'No reasoning provided.',
  };
}

/**
 * Triage a customer support message using Groq AI.
 * Falls back to deterministic rules if the API is unavailable or returns invalid output.
 *
 * @param {string} message - The customer support message
 * @returns {Promise<{category: string, urgency: string, reasoning: string, source: 'ai'|'rules'}>}
 */
export async function categorizeMessage(message) {
  try {
    const response = await getClient().chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message }
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const parsed = parseTriageResponse(response.choices[0].message.content);
    if (!parsed) throw new Error('Model returned invalid triage JSON');

    return { ...parsed, source: 'ai' };
  } catch (error) {
    console.warn('Groq API failed, using rule-based fallback:', error.message);
    return getRuleBasedTriage(message);
  }
}

const includesAny = (text, words) => words.some(word => text.includes(word));

/**
 * Deterministic rule-based triage for when the API is unavailable
 */
export function getRuleBasedTriage(message) {
  const lowerMessage = message.toLowerCase();
  const urgency = calculateUrgency(message);
  const result = (category, reasoning) => ({
    category,
    urgency,
    reasoning: `${reasoning} (Rule-based fallback: AI was unavailable, please verify.)`,
    source: 'rules',
  });

  if (includesAny(lowerMessage, ['bill', 'payment', 'charge', 'invoice', 'credit card',
    'subscription', 'refund', 'plan', 'pricing', 'upgrade', 'downgrade'])) {
    return result("Billing Issue", "The message mentions payments, charges or subscription details.");
  }

  if (includesAny(lowerMessage, ['bug', 'error', 'broken', 'not working', "doesn't work", "won't load",
    'crash', ' down', 'outage', 'server', 'database', 'loading', 'timing out', 'timeout', 'slow',
    "can't access", 'cannot access', "can't log", 'cannot log', 'locked out', 'login', 'log in',
    'connection lost'])) {
    return result("Technical Problem", "The message describes something in the product not working.");
  }

  if (includesAny(lowerMessage, ['feature', 'would love to see', 'would like to see', 'suggestion',
    'wish', 'enhancement', 'would be great', 'would be useful', 'could you add', 'please add', 'option to'])) {
    return result("Feature Request", "The customer is asking for new or improved functionality.");
  }

  if (includesAny(lowerMessage, ['thank', 'appreciate', 'love', 'great', 'awesome', 'feedback']) &&
      !lowerMessage.includes('?')) {
    return result("Feedback", "The customer is sharing feedback without asking for action.");
  }

  return result("General Inquiry", "The message is a general question or doesn't match a specific issue type.");
}
