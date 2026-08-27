---
name: ai-prompt-evaluator
description: Evaluate, red-team, and optimize LLM system prompts for structured JSON outputs, hallucination prevention, and prompt injection defense.
---

# AI System Prompt Engineering & Evaluator

Use this skill when designing LLM system prompts, tool-use agents, and conversational bots.

## Optimization Guidelines
1. **Role & Constraint Definition**: Clearly state persona, allowed tool boundaries, and forbidden actions.
2. **Few-Shot Demonstrations**: Include 2-3 input/output examples of edge cases.
3. **Defensive Instructions**: Treat user input within explicit boundary delimiters (`<user_query>...</user_query>`) to thwart prompt injection.
