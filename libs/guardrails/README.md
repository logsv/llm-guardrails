# @llm-governance/guardrails

The core engine for enforcing security, compliance, and reliability policies on LLM inputs and outputs. This library implements a "Policy-as-Code" approach, allowing you to define rules in YAML and enforce them in-process with zero network latency (unless using external validators).

## 🚀 Features

- **Policy-as-Code**: Define guardrails in simple YAML configuration files.
- **Input & Output Validation**: Validate prompts before they reach the LLM and responses before they reach the user.
- **Robust Validators**:
  - **PII Detection**: Detect and mask sensitive data (Email, Phone, Credit Cards, etc.).
  - **Secrets Detection**: Block API keys and private tokens.
  - **Toxicity Detection**: Filter harmful content using local models (BERT) or OpenAI Moderation API.
  - **Schema Validation**: Ensure JSON outputs match a schema, with **automatic JSON repair** for malformed responses.
  - **Prompt Injection**: Detect common jailbreak attempts.
- **Flexible Actions**:
  - `reject`: Block the request immediately.
  - `flag`: Log the violation but allow the request.
  - `mask`: Redact sensitive information (for PII).
  - `retry`: Automatically retry the LLM call if validation fails (requires SDK integration).

## 📦 Installation

```bash
npm install @llm-governance/guardrails
```

## 🛠️ Usage

### 1. Define your Policy (`guardrails.yml`)

```yaml
version: "1.0"

input:
  secrets_detection:
    enabled: true
    action: reject
  
  pii_detection:
    enabled: true
    action: mask
    categories: [email, phone]

output:
  toxicity_detection:
    enabled: true
    provider: 'openai' # or 'local'
    action: reject
    threshold: 0.01

  schema_validation:
    enabled: true
    action: retry # Retry if JSON is invalid
```

### 2. Run the Engine

```javascript
import { GuardrailsEngine, loadPolicy } from '@llm-governance/guardrails';

// 1. Load configuration
const policy = loadPolicy('./guardrails.yml');

// 2. Initialize Engine
const engine = new GuardrailsEngine(policy);

// 3. Validate Input (Pre-LLM)
try {
  const result = await engine.executeInput({
    input: "User prompt here with potential secrets...",
    context: { /* extra metadata */ }
  });
  
  if (result.violations.length > 0) {
    console.log("Input violations:", result.violations);
  }
} catch (error) {
  console.error("Input blocked:", error.message);
}

// 4. Validate Output (Post-LLM)
try {
  const result = await engine.executeOutput({
    output: '{"key": "value"}',
    context: { 
      schema: myJsonSchema // Pass dynamic schema for validation
    }
  });

  // Access the potentially modified/repaired output
  const finalOutput = result.output; 
} catch (error) {
  console.error("Output blocked:", error.message);
}
```

## 🛡️ Validators Reference

### Toxicity Detection (`toxicity_detection`)
Detects hate speech, harassment, and self-harm content.

- **Providers**:
  - `local`: Uses an embedded BERT model (zero cost, runs locally).
  - `openai`: Uses OpenAI's free Moderation API (requires `OPENAI_API_KEY`).

**Configuration:**
```yaml
toxicity_detection:
  provider: 'openai'
  apiKey: 'sk-...' # Optional if OPENAI_API_KEY env var is set
  action: reject
```

### Schema Validation (`schema_validation`)
Ensures LLM output is valid JSON and matches a specific schema. 

- **Features**: 
  - Validates against JSON Schema.
  - **Auto-Repair**: Automatically fixes common JSON syntax errors (e.g., missing quotes, trailing commas) using `jsonrepair`.

**Configuration:**
```yaml
schema_validation:
  enabled: true
  action: retry
```

### PII Detection (`pii_detection`)
Identifies Personally Identifiable Information.

- **Categories**: `email`, `phone`, `credit_card`, `ssn`, `api_key`, etc.
- **Actions**: Commonly used with `mask` to redact data.

## 🔄 Retry Logic

When used with `@llm-governance/sdk`, the guardrails engine supports a `retry` action. If an output validator (like Schema or Toxicity) fails, the SDK can automatically re-prompt the LLM, potentially with error context, to get a valid response.

## 🤝 Integration

This library is designed to be used via the **@llm-governance/sdk** for seamless integration, but can be used standalone for custom implementations.
