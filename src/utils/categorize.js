/**
 * Asks the model for a category and reads the answer. The client is passed in so
 * the prompt, the response handling and the fallback can be tested without an API key.
 */
import { CATEGORIES, parseCategoryResponse } from './parseCategory.js'

export const SYSTEM_PROMPT = `You triage customer support messages. Reply with only JSON: {"category": one of ${CATEGORIES.map((c) => `"${c}"`).join(', ')}, "reasoning": one short sentence}. Pick Feature Request for suggestions, General Inquiry for questions and thanks, Billing Issue for payments and charges, Technical Problem for errors and outages.`

export async function categorizeWith(client, message, fallback) {
  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
      // Temperature 0 makes answers much more repeatable; it does not guarantee identical output.
      temperature: 0,
    })
    return parseCategoryResponse(response.choices[0].message.content)
  } catch (error) {
    console.warn('Groq API failed, using mock response:', error.message)
    return fallback(message)
  }
}
