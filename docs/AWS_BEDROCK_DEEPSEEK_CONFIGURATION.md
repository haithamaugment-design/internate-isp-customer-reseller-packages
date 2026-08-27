# AWS Bedrock Qwen3-Coder-Next — Complete Configuration Guide

> **Purpose:** Copy-paste reference for setting up AWS Bedrock with Qwen3-Coder-Next (or any chat model) in a new Node.js/TypeScript project. Extracted from the NetMaster platform's production configuration.

---

## Table of Contents

1. [Environment Variables](#1-environment-variables)
2. [Install Dependencies](#2-install-dependencies)
3. [Core Bedrock LLM Module](#3-core-bedrock-llm-module)
4. [Usage Patterns](#4-usage-patterns)
5. [System Prompt Engineering](#5-system-prompt-engineering)
6. [Multi-Feature AI Service Pattern](#6-multi-feature-ai-service-pattern)
7. [Fallback Strategy (Rule-Based Engine)](#7-fallback-strategy)
8. [Error Handling & Recovery](#8-error-handling--recovery)
9. [Response Parsing](#9-response-parsing)
10. [Tuning Parameters](#10-tuning-parameters)
11. [Model Options on Bedrock](#11-model-options-on-bedrock)
12. [Things to Avoid](#12-things-to-avoid)
13. [Cost Optimization](#13-cost-optimization)
14. [Testing Checklist](#14-testing-checklist)
15. [Quick Start Copy-Paste](#15-quick-start-copy-paste)

---

## 1. Environment Variables

```bash
# Required — AWS Credentials
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Required — Bedrock Configuration
AWS_BEDROCK_REGION=us-east-1
AWS_BEDROCK_MODEL_ID=qwen.qwen3-coder-next

# Optional — If using AWS Profile instead of env vars
# AWS_PROFILE=your-profile-name
```

### Important Notes on Credentials

- **Three ways** AWS SDK picks up credentials (in priority order):
  1. `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` environment variables
  2. `AWS_PROFILE` env var pointing to `~/.aws/credentials`
  3. IAM role (if running on EC2/ECS/Lambda)

- **Never hardcode credentials** in source files. Always use env vars or IAM roles.

- **For Lambda/EC2/ECS**: Use IAM task roles instead of access keys. The SDK auto-discovers them.

---

## 2. Install Dependencies

```bash
# Core dependency — AWS Bedrock Runtime Client
npm install @aws-sdk/client-bedrock-runtime

# That's it. No other AI SDK needed.
# The Bedrock client handles all communication with the model.
```

### Package.json entry:
```json
{
  "dependencies": {
    "@aws-sdk/client-bedrock-runtime": "^3.x"
  }
}
```

---

## 3. Core Bedrock LLM Module

Create this file as `lib/bedrock-llm.ts` (or wherever your AI utilities live):

```typescript
/**
 * AWS Bedrock LLM Engine
 * Generic — works with DeepSeek, Claude, Llama, Mistral, or any Bedrock model.
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

// --- Configuration from environment (lazy-loaded) ---
// Read process.env at CALL TIME, not module-init time.
// This ensures dotenv / env loading happens before reads.

function getBedrockRegion(): string {
  return process.env.AWS_BEDROCK_REGION || "us-east-1";
}

function getBedrockModelId(): string {
  return process.env.AWS_BEDROCK_MODEL_ID || "qwen.qwen3-coder-next";
}

let client: BedrockRuntimeClient | null = null;
let cachedRegion: string = "";

function getClient(): BedrockRuntimeClient {
  const region = getBedrockRegion();
  // Recreate client if region changed (handles late env loading)
  if (!client || cachedRegion !== region) {
    client = new BedrockRuntimeClient({ region });
    cachedRegion = region;
  }
  return client;
}

// --- Types ---

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  /** Cleaned text (JSON blocks stripped by default) */
  text: string;
  /** Raw response before any stripping */
  rawText: string;
  /** If the model generated a JSON block with structured data */
  jsonData?: Record<string, unknown>;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  /** Custom system prompt — overrides the default */
  systemPrompt?: string;
  /** If true, keep JSON code blocks in the returned text */
  keepJson?: boolean;
}

// --- Main Chat Function ---

export async function bedrockChat(
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<ChatResponse> {
  const bedrock = getClient();

  const systemContent = options?.systemPrompt || "You are a helpful assistant.";

  // Build messages array for the model.
  // Qwen3-Coder-Next supports the 'system' role natively.
  const chatMessages = [
    { role: "system" as const, content: systemContent },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const inputBody = JSON.stringify({
    messages: chatMessages,
    max_tokens: options?.maxTokens || 4096,
    temperature: options?.temperature ?? 0.3,
    top_p: options?.topP ?? 0.85,
  });

  const command = new InvokeModelCommand({
    modelId: getBedrockModelId(),
    contentType: "application/json",
    accept: "application/json",
    body: new TextEncoder().encode(inputBody),
  });

  const response = await bedrock.send(command);
  const responseBody = JSON.parse(
    new TextDecoder().decode(response.body)
  );

  // Extract text from various model response formats:
  let text = "";

  if (responseBody.choices?.[0]?.message?.content) {
    // DeepSeek / OpenAI-style chat response
    text = responseBody.choices[0].message.content;
  } else if (responseBody.choices?.[0]?.text) {
    // Older completion-style response
    text = responseBody.choices[0].text;
  } else if (responseBody.content?.[0]?.text) {
    // Anthropic Claude response
    text = responseBody.content[0].text;
  } else if (responseBody.generation) {
    // Legacy generation format
    text = responseBody.generation;
  } else if (responseBody.completions?.[0]?.data?.text) {
    // Older completions format
    text = responseBody.completions[0].data.text;
  } else if (typeof responseBody.output === "string") {
    text = responseBody.output;
  } else if (responseBody.output?.text) {
    text = responseBody.output.text;
  } else {
    // Fallback: stringify whatever we got
    text = JSON.stringify(responseBody);
  }

  const rawText = text;

  // Try to extract a JSON block from the response
  let jsonData: Record<string, unknown> | undefined;
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      jsonData = JSON.parse(jsonMatch[1]);
    } catch {
      // Not valid JSON — ignore
    }
  }

  // Strip JSON blocks from visible text (unless keepJson is set)
  let visibleText = text;
  if (!options?.keepJson) {
    visibleText = text.replace(/```json[\s\S]*?```/g, "").trim();
    visibleText = visibleText.replace(/\n{3,}/g, "\n\n").trim();
  }

  return { text: visibleText, rawText, jsonData };
}

// --- Helpers ---

/** Check if Bedrock is configured */
export function isBedrockConfigured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.AWS_PROFILE ||
    process.env.AWS_BEDROCK_REGION
  );
}

/** Get current config (non-sensitive) */
export function getBedrockConfig() {
  return {
    region: getBedrockRegion(),
    modelId: getBedrockModelId(),
    configured: isBedrockConfigured(),
  };
}
```

---

## 4. Usage Patterns

### Pattern A: Simple Chat (Conversational AI)

```typescript
import { bedrockChat, type ChatMessage } from "./bedrock-llm";

// Build conversation context from your database
const dbMessages = await getConversationHistory(userId); // your DB query

const messages: ChatMessage[] = dbMessages.map((m) => ({
  role: m.role, // "user" or "assistant"
  content: m.content,
}));

const response = await bedrockChat(messages, {
  systemPrompt: "You are a business advisor for Tanzanian ISPs...",
  maxTokens: 4096,
  temperature: 0.3,
});

// response.text = cleaned text for the user
// response.rawText = full model output
// response.jsonData = parsed JSON block (if any)
```

### Pattern B: Data Analysis (Structured JSON Output)

```typescript
const response = await bedrockChat([
  {
    role: "user",
    content: `Analyze this customer data:\n${JSON.stringify(customerData)}\n\nRespond in JSON format.`,
  },
], {
  systemPrompt: `You are a data analyst. Respond ONLY in JSON:
{
  "customers": [
    {
      "name": "customer name",
      "risk": "high|medium|low",
      "reason": "brief reason",
      "action": "recommended action"
    }
  ],
  "summary": "overall summary"
}`,
  temperature: 0.1, // Lower for structured output
});

// Parse the structured response
let analysis;
try {
  const jsonMatch = response.rawText.match(/\{[\s\S]*\}/);
  analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
} catch {
  analysis = null;
}
```

### Pattern C: Content Generation (Blog Posts, Long-Form)

```typescript
const response = await bedrockChat([
  {
    role: "user",
    content: "Write a 3000-word detailed guide about setting up MikroTik routers for WiFi hotspot...",
  },
], {
  systemPrompt: "You are a technical writer. Write detailed, well-formatted content with headers, code blocks, and step-by-step instructions.",
  maxTokens: 8192, // Higher for long content
  temperature: 0.7, // Higher for creative content
  keepJson: true, // Preserve formatting
});
```

---

## 5. System Prompt Engineering

The system prompt is **critical** for controlling model behavior. Key principles:

### DO:
```
- Be explicit about the role: "You are X, an expert in Y"
- Define the exact flow/sequence: "Follow these steps IN ORDER: Step 1, Step 2..."
- Set constraints: "Only ask ONE question at a time"
- Specify output format: "Respond in JSON: { ... }"
- Include domain knowledge: "Tanzania ISP fiber pricing: Yas=55,000 TZS/month..."
- Mix languages if needed: "Use Swahili and English naturally"
- Set boundaries: "Do NOT answer off-topic questions until ALL steps are complete"
```

### DON'T:
```
- Be vague: "You are a helpful assistant" ← Too generic, model will wander
- Overload with too many rules at once
- Forget to specify output format when you need structured data
- Skip the "stop condition" — tell the model when to stop or when a task is done
```

### Example: Controlling an AI Business Partner

```typescript
const SYSTEM_PROMPT = `You are NetMaster AI Business Partner — an expert ISP reseller business advisor for Tanzania.

# CRITICAL: You MUST follow this EXACT step-by-step flow
You are NOT a general chatbot. You are a structured business planner. Follow these steps IN ORDER.

## Step 1: Ask for profit target
Ask: "Habari! What is your monthly profit target in TZS?"
Then wait for the answer.

## Step 2: Ask for number of locations
Ask: "How many locations do you sell internet from?"
Then wait for the answer.

## Step 3: Ask for location details
For EACH location, ask: name, routers, current customers, AND location type.
Location types determine pricing:
- Hostel → Weekly & Monthly vouchers
- Hotel → Daily & 3-Day vouchers
- Internet Cafe → Daily vouchers

## Step 4-7: Continue collecting data...

## After ALL 7 questions answered, generate the plan with JSON block.

# CRITICAL RULES:
- ONLY ask ONE question at a time
- Do NOT generate a plan until ALL 7 questions are answered
- ALL monetary amounts in TZS
- Mix Swahili and English naturally
- Keep responses SHORT (2-4 sentences max)
`;
```

---

## 6. Multi-Feature AI Service Pattern

When building multiple AI features sharing the same Bedrock connection, use a service layer:

```typescript
import { bedrockChat, isBedrockConfigured, type ChatMessage } from "./bedrock-llm";

/** Safe wrapper — returns fallback if Bedrock is down */
async function askAI(messages: ChatMessage[], fallbackContext: string): Promise<string> {
  if (!isBedrockConfigured()) {
    return `[AI unavailable — not configured] ${fallbackContext}`;
  }
  try {
    const response = await bedrockChat(
      messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
    );
    return response.text;
  } catch (err) {
    console.error("AI call failed:", err);
    return `[AI analysis failed] ${fallbackContext}`;
  }
}

// Then use in each feature:
export class MyAIService {
  async analyzeCustomers(data: CustomerData[]) {
    const aiResponse = await askAI([
      { role: "system", content: "You are a customer churn expert..." },
      { role: "user", content: `Customer data:\n${JSON.stringify(data)}` },
    ], `Found ${data.length} customers.`);

    // Parse response...
    let analysis;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      analysis = null;
    }

    return { aiAnalysis: analysis, rawResponse: aiResponse };
  }

  async generateRevenueForecast(data: SalesData[]) {
    const aiResponse = await askAI([
      { role: "system", content: "You are a revenue forecasting expert..." },
      { role: "user", content: `Sales data:\n${JSON.stringify(data)}` },
    ], "Insufficient data for forecast.");
    return aiResponse;
  }
}
```

---

## 7. Fallback Strategy

**Always build a non-AI fallback.** Bedrock can be unavailable (rate limits, region issues, AWS outages).

```typescript
// Check before using AI
if (isBedrockConfigured()) {
  // Use AI path
  const aiResponse = await bedrockChat(messages);
  return aiResponse;
} else {
  // Fallback to rule-based engine
  const ruleResponse = ruleBasedEngine.process(input);
  return ruleResponse;
}
```

### In your service:
```typescript
// Always return engine type so frontend can display appropriately
return {
  message: response.text,
  engine: isBedrockConfigured() ? "bedrock" : "rule-based",
};
```

---

## 8. Error Handling & Recovery

### Common Errors:

| Error | Cause | Fix |
|-------|-------|-----|
| `AccessDeniedException` | IAM role/key lacks Bedrock permissions | Add `bedrock:InvokeModel` permission to IAM policy |
| `ResourceNotFoundException` | Wrong model ID or region | Check `AWS_BEDROCK_MODEL_ID` and `AWS_BEDROCK_REGION` |
| `ThrottlingException` | Rate limit hit | Add retry with exponential backoff |
| `ValidationException` | Bad request body | Check message format matches model expectations |
| `ModelNotReadyException` | Model cold starting | Retry after a few seconds |

### Retry Strategy:

```typescript
import { ThrottlingException } from "@aws-sdk/client-bedrock-runtime";

async function callWithRetry(fn: () => Promise<any>, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ThrottlingException && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

// Usage:
const response = await callWithRetry(() => bedrockChat(messages));
```

---

## 9. Response Parsing

Models return different formats. Always handle multiple patterns:

```typescript
// DeepSeek / OpenAI-style: { choices: [{ message: { content: "..." } }] }
// Claude: { content: [{ text: "..." }] }
// Legacy: { generation: "..." }
// Bedrock: { output: { text: "..." } } or { output: "..." }

function extractText(responseBody: any): string {
  return (
    responseBody.choices?.[0]?.message?.content ||
    responseBody.choices?.[0]?.text ||
    responseBody.content?.[0]?.text ||
    responseBody.generation ||
    responseBody.completions?.[0]?.data?.text ||
    (typeof responseBody.output === "string" ? responseBody.output : null) ||
    responseBody.output?.text ||
    JSON.stringify(responseBody)
  );
}
```

### Parsing JSON from AI responses:

```typescript
// Always look for JSON in ```json ... ``` blocks first, then raw JSON
function parseAIJson(text: string): Record<string, unknown> | null {
  // Try code block first
  const blockMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (blockMatch) {
    try { return JSON.parse(blockMatch[1]); } catch {}
  }
  // Try raw JSON
  const rawMatch = text.match(/\{[\s\S]*\}/);
  if (rawMatch) {
    try { return JSON.parse(rawMatch[0]); } catch {}
  }
  return null;
}
```

---

## 10. Tuning Parameters

| Parameter | Value | When to Use |
|-----------|-------|-------------|
| `temperature: 0.1` | Near-deterministic | JSON extraction, data analysis, classification |
| `temperature: 0.3` | Low creativity | Business planning, recommendations (our default) |
| `temperature: 0.5` | Balanced | General conversation, mixed tasks |
| `temperature: 0.7` | Creative | Blog writing, content generation, brainstorming |
| `temperature: 0.9` | Very creative | Marketing copy, storytelling |
| `maxTokens: 2048` | Short responses | Q&A, classification, simple analysis |
| `maxTokens: 4096` | Medium responses | Business plans, recommendations (our default) |
| `maxTokens: 8192` | Long responses | Blog posts, detailed guides, reports |
| `topP: 0.85` | Focused | Most use cases (our default) |
| `topP: 0.95` | Diverse | Creative writing, brainstorming |

### Rule of Thumb:
- **Structured output** (JSON, data) → low temperature (0.1–0.3), low topP (0.8–0.9)
- **Conversational** (chat, Q&A) → medium temperature (0.3–0.5), medium topP (0.85–0.9)
- **Creative** (content, writing) → high temperature (0.7–0.9), high topP (0.9–0.95)

---

## 11. Model Options on Bedrock

### Available Models (as of 2026):

| Model ID | Best For | Cost Tier | Max Tokens |
|----------|----------|-----------|------------|
| `qwen.qwen3-coder-next` | Coding, business planning, agentic workflows, multilingual | Low | 256K |
| `anthropic.claude-sonnet-4-20250514-v1:0` | Analysis, coding, complex reasoning | Medium | 200K |
| `anthropic.claude-3-5-haiku-20241022-v1:0` | Fast responses, classification, simple tasks | Low | 200K |
| `meta.llama3-70b-instruct-v1:0` | General purpose, good value | Low | 8K |
| `meta.llama3.1-8b-instruct-v1:0` | Fast, cheap, simple tasks | Very Low | 8K |
| `amazon.titan-text-express-v1` | Amazon's own model | Medium | 8K |
| `mistral.mistral-large-2402-v1:0` | Complex reasoning, multilingual | Medium | 32K |
| `cohere.command-r-plus-v1:0` | RAG, tool use | Medium | 128K |

### Our Configuration:
- **Model:** `qwen.qwen3-coder-next` (best price/performance for Tanzanian ISP use case)
- **Region:** `us-east-1` (us-east-1 has the widest model availability)
- **Why Qwen3-Coder-Next:** 256K context window, excellent coding & agentic capabilities, supports Swahili+English mixed prompts, handles structured JSON output well, very low cost per token

### Switching Models:
Just change the env var:
```bash
# Switch to Claude for complex analysis
AWS_BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-20250514-v1:0

# Switch to Llama for faster, cheaper responses
AWS_BEDROCK_MODEL_ID=meta.llama3-70b-instruct-v1:0

# Switch to DeepSeek for multilingual conversational
AWS_BEDROCK_MODEL_ID=deepseek.v3.2
```

---

## 12. Things to Avoid

### ❌ DON'T:

1. **Don't read env vars at module import time**
   ```typescript
   // BAD — env might not be loaded yet
   const region = process.env.AWS_BEDROCK_REGION;
   
   // GOOD — read at call time
   function getRegion() { return process.env.AWS_BEDROCK_REGION || "us-east-1"; }
   ```

2. **Qwen3 supports the system role natively**
   ```typescript
   // GOOD — Qwen3 handles system role directly
   messages: [
     { role: "system", content: "You are..." },
     { role: "user", content: "Hello" }
   ]
   ```

3. **Don't skip error handling**
   ```typescript
   // BAD — will crash on any API error
   const response = await bedrockChat(messages);
   
   // GOOD — always handle errors
   try {
     const response = await bedrockChat(messages);
   } catch (err) {
     console.error("AI failed:", err);
     return fallbackResponse;
   }
   ```

4. **Don't assume JSON output**
   ```typescript
   // BAD — will crash if AI doesn't output JSON
   const data = JSON.parse(response.rawText);
   
   // GOOD — try to extract, fall back gracefully
   const data = parseAIJson(response.rawText);
   ```

5. **Don't send entire conversation history every time**
   ```typescript
   // BAD — grows unbounded, hits token limits
   const allMessages = await db.findAll();
   
   // GOOD — cap at recent messages
   const allMessages = await db.find({ take: 20, orderBy: "asc" });
   ```

6. **Don't hardcode the model ID in service files**
   ```typescript
   // BAD
   modelId: "deepseek.v3.2"
   
   // GOOD — always read from config
   modelId: getBedrockModelId()
   ```

7. **Don't forget the `body` must be a Uint8Array**
   ```typescript
   // BAD — sends a string
   body: JSON.stringify(input)
   
   // GOOD — encode to bytes
   body: new TextEncoder().encode(JSON.stringify(input))
   ```

8. **Don't block your event loop with AI calls**
   ```typescript
   // BAD — synchronous, blocks other requests
   const response = bedrockChat(messages); // no await
   
   // GOOD — async, other requests can proceed
   const response = await bedrockChat(messages);
   ```

---

## 13. Cost Optimization

### Pricing Reference (Bedrock, approximate):
- Qwen3-Coder-Next: ~$0.22/1M input tokens (256K context, 16K output)
- DeepSeek V3.2: ~$0.27/1M input tokens, ~$1.10/1M output tokens
- Claude Sonnet: ~$3/1M input, ~$15/1M output
- Llama 70B: ~$0.65/1M input, ~$2.75/1M output

### Cost Saving Strategies:

1. **Limit context window**: Only send last 10-20 messages, not entire history
2. **Use lower max_tokens**: Set appropriate limits per use case
3. **Cache repeated prompts**: If you analyze the same data type, cache the prompt structure
4. **Batch similar requests**: Process multiple customers in one prompt instead of one-by-one
5. **Use cheaper models for simple tasks**: Classification → Llama 8B; Analysis → DeepSeek/Claude
6. **Pre-filter data**: Send only relevant data to the AI, not your entire database

### Example: Batching
```typescript
// BAD — N API calls for N customers
for (const customer of customers) {
  const analysis = await askAI([{ role: "user", content: `Analyze ${customer.name}...` }]);
}

// GOOD — 1 API call for all customers
const analysis = await askAI([{
  role: "user", 
  content: `Analyze these ${customers.length} customers:\n${customers.map(c => `- ${c.name}: ...`).join("\n")}`
}]);
```

---

## 14. Testing Checklist

Before deploying to production:

- [ ] **Env vars are set** in production (not just `.env.local`)
- [ ] **IAM policy** includes `bedrock:InvokeModel` for the model ARN
- [ ] **Region is correct** — model must exist in that region
- [ ] **Model ID is exact** — `deepseek.v3.2` not `deepseek-v3.2`
- [ ] **Error handling works** — what happens when Bedrock is down?
- [ ] **Fallback engine works** — rule-based engine still functions
- [ ] **Response parsing handles all formats** — not just one model's format
- [ ] **Token limits are set** — prevent runaway costs
- [ ] **System prompt produces desired behavior** — tested with 5+ scenarios
- [ ] **JSON extraction works** — tested with valid and invalid JSON
- [ ] **Conversation history is capped** — doesn't grow beyond 20 messages
- [ ] **Rate limiting is handled** — retries with backoff
- [ ] **Health check endpoint** — `/bedrock-test` endpoint confirms connectivity

### Quick Test Endpoint:
```typescript
router.get("/bedrock-test", async (_req, res) => {
  const config = getBedrockConfig();
  if (!config.configured) {
    return res.json({ ok: false, error: "Bedrock not configured", config });
  }
  try {
    const response = await bedrockChat([
      { role: "user", content: "Reply with exactly: OK" }
    ]);
    res.json({ ok: true, config, response: response.text.slice(0, 200) });
  } catch (err: any) {
    res.json({ ok: false, error: err.message, config });
  }
});
```

---

## 15. Quick Start Copy-Paste

### Step 1: Create `lib/bedrock-llm.ts` (copy from Section 3 above)

### Step 2: Create your AI service:

```typescript
// services/ai.service.ts
import { bedrockChat, isBedrockConfigured, type ChatMessage } from "../lib/bedrock-llm";

async function askAI(messages: ChatMessage[], fallback: string): Promise<string> {
  if (!isBedrockConfigured()) return `[AI not configured] ${fallback}`;
  try {
    const systemMsg = messages.find((m) => m.role === "system");
    const userMsgs = messages.filter((m) => m.role !== "system");
    if (systemMsg && userMsgs[0]) {
      userMsgs[0] = { role: "user", content: `${systemMsg.content}\n\n---\n\n${userMsgs[0].content}` };
    }
    const res = await bedrockChat(userMsgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    return res.text;
  } catch (err) {
    console.error("AI failed:", err);
    return `[AI error] ${fallback}`;
  }
}

export { askAI };
```

### Step 3: Set environment variables:
```bash
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_BEDROCK_REGION=us-east-1
AWS_BEDROCK_MODEL_ID=qwen.qwen3-coder-next
```

### Step 4: Use in your feature:
```typescript
import { askAI } from "../services/ai.service";

async function analyzeData(data: any[]) {
  const response = await askAI([
    { role: "system", content: "You are a data analyst. Respond in JSON." },
    { role: "user", content: `Analyze: ${JSON.stringify(data)}` },
  ], "Cannot analyze data right now.");
  return response;
}
```

---

## Summary — Key Takeaways

| Concept | Decision |
|---------|----------|
| **SDK** | `@aws-sdk/client-bedrock-runtime` only |
| **Model** | `qwen.qwen3-coder-next` (cheap, 256K context, excellent coding & multilingual) |
| **Region** | `us-east-1` |
| **Default temperature** | 0.3 (business use), 0.7 (content generation) |
| **Default max_tokens** | 4096 (adjust per use case) |
| **System prompt** | Use `system` role (Qwen3 supports it natively) |
| **Error handling** | Always wrap in try/catch, return fallback |
| **Response parsing** | Handle multiple formats (DeepSeek, Claude, legacy) |
| **JSON extraction** | Try ` ```json ``` ` blocks first, then raw JSON |
| **Context limit** | Cap at last 20 messages |
| **Cost control** | Set max_tokens, batch requests, cache repeated prompts |
| **Health check** | `/bedrock-test` endpoint |
| **Fallback** | Rule-based engine when Bedrock unavailable |
