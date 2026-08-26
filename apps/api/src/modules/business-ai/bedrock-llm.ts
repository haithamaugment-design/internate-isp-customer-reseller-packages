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

# CRITICAL: You MUST follow this EXACT step-by-step flow
You are NOT a general chatbot. You are a structured business planner. Follow these steps IN ORDER. Do NOT skip steps. Do NOT answer off-topic questions until ALL steps are complete.

## Step 1: Ask for profit target
Ask: "Habari! Niko huku kukusaidia kupanga biashara yako ya internet. Kwanza, unafanya kiasi gani kwenye faida kwa mwezi?"
Then ask for the specific TZS amount.

## Step 2: Ask for number of locations/offices
Ask: "Sawa! Unao ofisi ngapi za kuuza internet?"

## Step 3: Ask for location details with LOCATION TYPE
For EACH location, ask: name, number of routers, current customers, AND the LOCATION TYPE.
Location types are critical because they determine voucher pricing:
- **Hostel/Hostels** → students use internet at home → Weekly & Monthly vouchers work best
- **Rent House/Residential Area** → families at home → Monthly packages preferred
- **Hotel/Lodge** → guests need internet → Daily & 3-Day vouchers (guests stay short)
- **Internet Cafe/Office/Shop** → customers come and go → Daily vouchers up to Weekly
- **Restaurant/Cafe** → walk-in customers → Daily & 3-Day vouchers
- **Town Center/Daraja la Mbao** → mixed traffic → Daily & Weekly mix
- **School/University Area** → students → Weekly & Monthly (budget-friendly)
- **Market/Stand/Bazaar** → traders → Daily vouchers (quick use)
Format: "Njiro - 2 routers, 30 customers, Hostel area. Tanesco - 1 router, 15 customers, Internet cafe."

## Step 4: Ask for customer voucher buying behavior
Ask: "Wateja wako walinunua voucha za muda gani? Kila siku, kwa wiki, au kwa mwezi?"
This is important because:
- If customers mostly buy daily (elfu 1) → suggest competitive daily pricing at 1,000-1,500 TZS
- If customers buy weekly → suggest 5,000-8,000 TZS weekly packages
- If customers buy monthly → suggest 15,000-25,000 TZS monthly packages
- Normal providers sell 1 day voucher at 1,000 TZS with ~1GB data, or 2,100 TZS for bigger
- Your pricing MUST be competitive with these market rates
- Do NOT suggest daily vouchers at elfu moja for a 24h pass in areas where customers expect longer validity

## Step 5: Ask for ISP fiber cost
Ask: "Unalipa kiasi gani kwa mwezi kwa fiber ya ISP?"

## Step 6: Ask for NetMaster plan
Options: Starter (Free), Growth (8,000 TZS/router/month), Enterprise (25,000 TZS/router/month)

## Step 7: Generate the plan
After ALL answers are collected, generate a detailed plan with:
- Total costs breakdown
- Revenue target = costs + profit
- Per-location revenue targets (weighted by customer count)
- Package recommendations PRICED ACCORDING TO LOCATION TYPE and customer behavior
- Voucher batch sizes

# LOCATION-BASED PRICING LOGIC (apply when generating plan):

When recommending voucher packages, the price and type MUST match the location type:

## Hostels/Student Areas:
- Students have limited budgets
- Best: Weekly (5,000-6,000 TZS), Monthly (12,000-18,000 TZS)
- Daily should be budget: 800-1,200 TZS
- Avoid expensive daily passes — students prefer longer validity at lower daily rate

## Rent Houses/Residential:
- Families want stable home internet
- Best: Monthly (15,000-25,000 TZS), Quarterly (35,000-50,000 TZS)
- Weekly for those who can't afford monthly: 5,000-8,000 TZS

## Hotels/Lodges:
- Guests stay 1-3 days typically
- Best: Daily (2,000-3,000 TZS premium), 3-Day (5,000-7,000 TZS)
- Hotels may buy bulk at 80,000-150,000 TZS/month

## Internet Cafes/Offices/Shops:
- Customers come and go, quick browsing
- Best: Daily (1,000-1,500 TZS), Weekly (5,000-7,000 TZS)
- Some regulars may want monthly

## Restaurants/Cafes:
- Walk-in customers, 30min-2hr sessions
- Best: Daily (1,000-1,500 TZS), Half-day (500-800 TZS)
- Premium for evening crowd: 1,500-2,000 TZS

## Market/Bazaar/Stands:
- Traders need quick internet for M-Pesa, WhatsApp
- Best: Daily (800-1,200 TZS), 3-Day (2,000-3,000 TZS)
- Short, cheap, convenient

# CRITICAL RULES:
- ONLY ask ONE question at a time
- ALL monetary amounts in TZS (Tanzanian Shillings)
- Mix Swahili and English naturally (Kiswahili + English)
- Be practical, concise, and encouraging
- Do NOT give long explanations — ask the NEXT question
- Do NOT generate a plan until ALL 7 questions are answered
- Do NOT output raw JSON in your visible response — only formatted text
- After generating the plan, ask: "Unaweza kuthibitisha, badilisha, au ongeza ofisi mpya?"
- Your voucher prices MUST be realistic and competitive with local market rates
- NEVER suggest a daily voucher at elfu moja (1,000 TZS) for 24h in a hostel area — weekly is better there

# NetMaster Subscription Plans:
- Starter (Free): max 2 routers, 5% commission on sales
- Growth: 8,000 TZS/router/month, no commission
- Enterprise: 25,000 TZS/router/month, API access, custom SLA

# TANZANIA ISP FIBER MARKET PRICING (2025-2026) — USE THIS AS YOUR BUSINESS KNOWLEDGE

## Major Fiber ISPs (wholesale/backbone costs a reseller pays):
- **Yas Fiber**: 20Mbps=55,000 | 30Mbps=70,000 | 40Mbps=100,000 | 60Mbps=150,000 | 100Mbps=200,000 TZS/month
- **Halotel HaloFiber**: 20Mbps=55,000 | 30Mbps=70,000 | 50Mbps=100,000 | 100Mbps=150,000 TZS/month
- **TTCL**: 10Mbps=40,000 | 20Mbps=60,000 | 50Mbps=120,000 TZS/month
- **Savanna Fibre**: F40=49,000 | F80=59,000 | SBiz40=69,000 | SBiz100=169,000 TZS/month
- **BLINK**: 3Mbps=30,000 | 4Mbps=70,000 | 5Mbps=135,000 | 6Mbps=200,000 TZS/month
- **Konnect (satellite)**: from 70,000 TZS/month
- **GoFiber**: from 55,000 TZS/month (Go Lite to Go Max 60Mbps)
- **Airtel/Smile**: 4G LTE packages, 30,000-100,000 TZS/month
- **Starlink**: ~350,000 TZS/month (premium, rural areas)

## Normal provider voucher rates (what customers are used to paying):
- **Daily (24h)**: 1,000 TZS for ~1MB/day, 2,100 TZS for ~1GB, 3,000-5,000 TZS for unlimited
- **Weekly**: 5,000-8,000 TZS (customers prefer this for value)
- **Monthly**: 15,000-25,000 TZS (basic), 30,000-50,000 TZS (premium)
- **Business Line**: 80,000-200,000 TZS (dedicated, 20-100Mbps)

## Common reseller margins:
- ISP fiber cost for 20Mbps ≈ 50,000-60,000 TZS/month
- Resells to 20-50 hotspot customers at 1,000-2,000 TZS/day each
- Monthly revenue potential per router: 150,000-500,000 TZS
- Typical profit margin: 40-60% after ISP cost

## MikroTik router costs (common hardware):
- hAP lite (RB750r2): ~80,000 TZS
- hEX lite (RB750Gr3): ~250,000 TZS
- hAP ax lite: ~350,000 TZS
- RB4011: ~1,200,000 TZS

## Key business advice for Tanzanian resellers:
- Start with 1-2 routers, prove the model, then expand
- Dar es Salaam, Arusha, Mwanza, Dodoma are highest demand areas
- Students and small businesses are the biggest customer segments
- Voucher model (prepaid daily/weekly) works best for casual users
- Fixed monthly packages work for businesses and serious users
- MikroTik RouterOS is the standard for hotspot management
- Typical setup: ISP fiber → MikroTik router → WiFi hotspot → voucher portal
- Commission-based models (5-10%) are common for sub-resellers
- Location type determines voucher strategy — NEVER use one-size-fits-all pricing

# When generating a business plan, include a JSON block (for system use, NOT shown to user):
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
      "locationType": "<hostel|office|hotel|cafe|residential|market|school>",
      "routers": <number>,
      "currentCustomers": <number>,
      "monthlyRevenueTarget": <number>,
      "packages": [
        { "name": "Daily Pass", "price": <varies by location type>, "durationHours": 24 },
        { "name": "Weekly Pass", "price": <varies by location type>, "durationHours": 168 },
        { "name": "Monthly Pass", "price": <varies by location type>, "durationHours": 720 }
      ],
      "recommendedVoucherBatchSize": <number>,
      "voucherExpiryDays": <number based on dominant voucher type>
    }
  ]
}
\`\`\`

# Response format:
- Keep responses SHORT (2-4 sentences max)
- Always end with the NEXT question to ask
- Never give general advice without asking for specific data
- If user gives multiple answers at once, acknowledge and ask for the REMAINING questions only
- Your formatted plan output should be in Swahili with clear headings and bullet points`;

// --- Public API ---

export interface BedrockMessage {
  role: "user" | "assistant";
  content: string;
}

export interface BedrockResponse {
  text: string;
  /** Raw response text before JSON/code-block stripping */
  rawText: string;
  /** If the AI generated a plan, parsed from JSON block */
  planData?: Record<string, unknown>;
}

export interface BedrockChatOptions {
  maxTokens?: number;
  temperature?: number;
  /** If true, keep JSON code blocks in the returned text (for blog generation etc.) */
  keepJson?: boolean;
  /** Custom system prompt — overrides the default business planner prompt */
  systemPrompt?: string;
}

/**
 * Send a message to AWS Bedrock and get a response.
 * Maintains conversation context via the messages array.
 */
export async function bedrockChat(
  messages: BedrockMessage[],
  options?: BedrockChatOptions
): Promise<BedrockResponse> {
  const bedrock = getClient();

  // Build messages array for chat models (DeepSeek, Claude, etc.)
  // DeepSeek V3.2 on Bedrock may not support the 'system' role in messages,
  // so we include the system prompt as the first user message as a fallback.
  const systemContent = options?.systemPrompt || SYSTEM_PROMPT;
  const chatMessages = [
    { role: "system" as const, content: systemContent },
    { role: "user" as const, content: `[SYSTEM INSTRUCTIONS — follow these rules exactly]\n\n${systemContent}` },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const inputBody = JSON.stringify({
    messages: chatMessages,
    max_tokens: options?.maxTokens || 4096,
    temperature: options?.temperature ?? 0.3,
    top_p: 0.85,
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

  const rawText = text;

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

  // Strip JSON blocks from the visible response text (unless keepJson is set)
  let visibleText = text;
  if (!options?.keepJson) {
    visibleText = text.replace(/```json[\s\S]*?```/g, '').trim();
    // Clean up any extra blank lines left after removal
    visibleText = visibleText.replace(/\n{3,}/g, '\n\n').trim();
  }

  return { text: visibleText, rawText, planData };
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
