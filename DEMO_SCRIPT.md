# Demo Walkthrough Script (10 Mins)

## Introduction (0:00 - 1:30)
- **Concept**: "Today, I'm showing you the LLM Governance SDK, an in-process instrumentation library to manage, secure, and observe LLM applications."
- **Problem**: "Integrating LLMs isn't just about calling an API. You need to handle costs, PII security, and reliability."
- **Solution**: "This SDK wraps your LLM calls, enforcing policy and tracking everything without a separate gateway."

## 1. Setup & Architecture (1:30 - 3:00)
- **Visual**: Show `libs/sdk` and `libs/guardrails` structure.
- **Action**: Show `examples/sdk-demo.js`.
- **Highlight**: "It's a modular Node.js library. You just import it and wrap your calls with `llm.observe`."

## 2. Guardrails in Action (3:00 - 6:00)
- **Action**: Run `node examples/sdk-demo.js`.
- **Test 1**: Safe Request. "Passes through seamlessly."
- **Test 2**: PII Leak. "The SDK detects PII in the output and automatically masks it before returning to your app."
- **Test 3**: Secret Leak. "The SDK blocks the request entirely if sensitive data like API keys are detected in the input."

## 3. Observability & Cost (6:00 - 8:00)
- **Highlight**: "Every request is logged asynchronously. We use a separate Worker process to persist logs to avoiding blocking your app."
- **Visual**: Show `apps/worker` code.
- **Highlight**: "We track token usage, latency, and estimated cost."

## Conclusion
- **Summary**: "We have a secure, observable, and quality-controlled SDK that fits into your existing Node.js workflow."
