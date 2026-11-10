# Week 8 improvements to Customer Inbox Triage

Three problems were found by testing the sample messages and reading the code. Each is fixed and tested (`npm test`, 32 tests).

## 1. Urgency scoring (`src/utils/urgencyScorer.js`)
**Problem:** the score depended on message length, "!" count, "?" and the day and hour, so a short outage report ("Database connection lost") scored Low and the same message scored differently on a weekend.
**Fix:** urgency comes only from the words in the message.
- One critical phrase (outage, locked out, data loss, charged twice...) is High.
- A failure ("error", "broken"), lost access ("can't access") or urgent wording is Medium on its own; two kinds together are High.
- No signals is Low, so Medium keeps its meaning.
- Matching is by whole word with common endings (crashing, errors, urgently) and ignores negated mentions within 3 words ("not urgent", "no longer locked out"). Matching lives in `src/utils/textMatch.js`.

## 2. Actions and escalation (`src/utils/templates.js`)
**Problem:** Feature Request returned "check billing portal", urgency was ignored, and any message over 100 characters was escalated.
**Fix:** each category has its own action, High urgency adds "Reply within the hour.", and escalation is High urgency or a risk word (security, breach, hacked, data loss, unauthorized, outage, charged twice). The word list is the author's own policy choice, not agreed with a support team, and is meant to be edited.

## 3. Categorisation (`src/utils/llmHelper.js`, `categorize.js`, `parseCategory.js`)
**Problem:** a free-text prompt at temperature 0.7, then the reply was searched for "billing", "technical", "feature" or "inquiry" anywhere, so "this is not a billing issue" became Billing and runs disagreed.
**Fix:** the model is asked for JSON with a category from a fixed list, at temperature 0 (much more repeatable, not guaranteed identical). Anything that is not a known category becomes "Unknown" (manual review).

## Before and after on `sample-messages.json` (urgency)
| # | Message | Before | After |
|---|---------|--------|-------|
| 1 | Production emergency | Low | High |
| 2 | Friendly thank you | Medium | Low |
| 3 | Feature request | Low | Low |
| 4 | Billing + technical hybrid | Low | High |
| 5 | "hi" | Low | Low |
| 6 | "Server down now" | Low | High |
| 7 | Long rambling, non-urgent | High | Low |
| 8 | "What are your business hours?" | Low | Low |

"Before" was run on the original code on a Tuesday daytime; it varies with the time. The tests also include messages that were not used while tuning.

## Limits
- Keyword matching misses paraphrases ("everything is on fire") and can't tell a resolved problem from a current one ("I was locked out earlier but I'm fine now" is High). "production" in an unrelated sentence ("our production team") would also count.
- The model prompt was tested with a stubbed client (prompt, temperature, JSON, JSON inside prose, garbage, API error), not against the live Groq API, because no key was available.
- Empty or one-word messages are scored Low but are not validated in the UI. That is a named follow-up.
- The category fallback (when the API fails) is still the original keyword mock.
