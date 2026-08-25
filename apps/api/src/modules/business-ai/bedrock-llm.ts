/**
 * AWS Bedrock LLM Engine
 * Uses DeepSeek V3.2 (or configurable model) via AWS Bedrock
 * for intelligent, conversational business planning.
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

// --- Configuration from environment (lazy-loaded) ---
//
// We read process.env at CALL TIME rather than module-init time so
// that dotenv has loaded regardless of import order.

function getBedrockRegion(): string {
  return process.env.AWS_BEDROCK_REGION || "us-east-1";
}

function getBedrockModelId(): string {
  return process.env.AWS_BEDROCK_MODEL_ID || "deepseek.v3.2";
}

// The AWS SDK will pick up credentials from:
//   1. AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY env vars
//   2. AWS_PROFILE / ~/.aws/credentials
//   3. IAM role on EC2/ECS/Lambda
// No manual credential wiring needed if any of the above is configured.

let client: BedrockRuntimeClient | null = null;
let cachedRegion: string = "";

function getClient(): BedrockRuntimeClient {
  const region = getBedrockRegion();
  // Recreate client if region changed (e.g. env vars loaded late)
  if (!client || cachedRegion !== region) {
    client = new BedrockRuntimeClient({ region });
    cachedRegion = region;
  }
  return client;
}

// --- System prompt ---

const SYSTEM_PROMPT = `You are NetMaster AI Business Partner — an expert ISP reseller business advisor for Tanzania.

Your role:
- Help resellers plan their internet business: pricing, packages, voucher strategy, expansion
- All monetary amounts must be in TZS (Tanzanian Shillings)
- Be practical, concise, and encouraging
- Mix Swahili and English naturally (Kiswahili + English)
- When asked to generate a business plan, respond with a structured JSON plan

NetMaster Subscription Plans:
- Starter (Free): max 2 routers, 5% commission on sales
- Growth: 8,000 TZS/router/month, no commission
- Enterprise: 25,000 TZS/router/month, API access, custom SLA

When generating a business plan, wrap the plan data in a JSON block:
\`\`\`json
{
  "plan": true,
  "profitTarget": <number in TZS>,
  "revenueTarget": <costs + profit>,
  "totalCosts": <number>,
  "costs": { "ispFiber": <number>, "netmasterSubscription": <number>, "other": 0 },
  "locationPlans": [
    {
      "name": "<location name>",
      "routers": <number>,
      "currentCustomers": <number>,
      "monthlyRevenueTarget": <number>,
      "packages": [
        { "name": "Daily Pass", "price": 1500, "durationHours": 24 },
        { "name": "3-Day Pass", "price": 3750, "durationHours": 72 },
        { "name": "Weekly Pass", "price": 7500, "durationHours": 168 }
      ],
      "recommendedVoucherBatchSize": 50,
      "voucherExpiryDays": 3
    }
  ]
}
\`\`\`

Always be helpful and professional. If the user asks something unrelated to ISP business, politely guide them back.`;

// --- Public API ---

export interface BedrockMessage {
  role: "user" | "assistant";
  content: string;
}

export interface BedrockResponse {
  text: string;
  /** If the AI generated a plan, parsed from JSON block */
  planData?: Record<string, unknown>;
}

/**
 * Send a message to AWS Bedrock and get a response.
 * Maintains conversation context via the messages array.
 */
export async function bedrockChat(
  messages: BedrockMessage[]
): Promise<BedrockResponse> {
  const bedrock = getClient();

  // Build messages array for chat models (DeepSeek, Claude, etc.)
  const chatMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const inputBody = JSON.stringify({
    messages: chatMessages,
    max_tokens: 2048,
    temperature: 0.7,
    top_p: 0.9,
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
  // DeepSeek/Chat: { choices: [{ message: { content: "..." } }] }
  // Anthropic:     { content: [{ text: "..." }] }
  // Legacy:        { generation: "..." } or { completions: [{ data: { text: "..." } }] }
  // Bedrock output: { output: { text: "..." } } or { output: "..." }
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
    text = responseBody.generation;
  } else if (responseBody.completions?.[0]?.data?.text) {
    text = responseBody.completions[0].data.text;
  } else if (typeof responseBody.output === "string") {
    text = responseBody.output;
  } else if (responseBody.output?.text) {
    text = responseBody.output.text;
  } else {
    // Fallback: stringify whatever we got
    text = JSON.stringify(responseBody);
  }

  // Try to extract a plan JSON block from the response
  let planData: Record<string, unknown> | undefined;
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.plan) {
        planData = parsed;
      }
    } catch {
      // Not valid JSON — ignore
    }
  }

  return { text: text.trim(), planData };
}

/**
 * Check if Bedrock is configured (env vars present).
 * Reads process.env at call time so it always reflects the current state.
 */
export function isBedrockConfigured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.AWS_PROFILE ||
    process.env.AWS_BEDROCK_REGION
  );
}

/**
 * Get current Bedrock configuration (non-sensitive).
 */
export function getBedrockConfig() {
  return {
    region: getBedrockRegion(),
    modelId: getBedrockModelId(),
    configured: isBedrockConfigured(),
  };
}
