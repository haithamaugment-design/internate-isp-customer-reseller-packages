/**
 * Test: Qwen3-Coder-Next via AWS Bedrock
 * Sends a prompt to generate an advanced market structure trading algorithm in Python.
 *
 * Usage:
 *   npx tsx apps/api/src/test-bedrock-qwen3.ts
 *
 * Requires env vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_BEDROCK_REGION
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from the api directory
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const REGION = process.env.AWS_BEDROCK_REGION || "us-east-1";
const MODEL_ID = process.env.AWS_BEDROCK_MODEL_ID || "qwen.qwen3-coder-next";

if (!process.env.AWS_ACCESS_KEY_ID) {
  console.error("❌ AWS_ACCESS_KEY_ID not found in environment.");
  console.error("   Make sure your .env file has the AWS credentials.");
  process.exit(1);
}

async function testQwen3() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Testing Qwen3-Coder-Next on AWS Bedrock");
  console.log(`  Region:  ${REGION}`);
  console.log(`  Model:   ${MODEL_ID}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  const client = new BedrockRuntimeClient({ region: REGION });

  const systemPrompt = `You are an expert quantitative trading developer. You write clean, production-ready Python code with detailed comments. Always include imports, type hints, and docstrings.`;

  const userMessage = `Create an advanced market structure trading algorithm in Python that includes:

1. **Order Flow Analysis** — Track bid/ask imbalance, cumulative delta, and volume profile
2. **Market Structure Detection** — Identify swing highs/lows, breaks of structure (BOS), and changes of character (CHoCH)
3. **Liquidity Zones** — Detect equal highs/lows (liquidity pools), sell-side and buy-side liquidity
4. **Smart Money Concepts (SMC)** — Order blocks, fair value gaps (FVG), and displacement candles
5. **Entry/Exit Logic** — Combine all signals into a confluence-based entry system with dynamic stop-loss based on structure
6. **Risk Management** — Position sizing based on account risk %, maximum drawdown limits
7. **Backtesting Framework** — Simple backtest using historical OHLCV data with performance metrics (Sharpe, win rate, max drawdown)

Requirements:
- Use pandas, numpy, and optionally mplfinance for visualization
- Include a complete working example with sample data generation
- Add proper logging and error handling
- Make it modular so each component can be used independently
- Include type hints throughout

Output the complete Python file with all classes and functions.`;

  const body = JSON.stringify({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: 8192,
    temperature: 0.3,
    top_p: 0.85,
  });

  console.log("⏳ Sending request to Qwen3-Coder-Next...\n");

  const startTime = Date.now();

  try {
    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(body),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Extract text — Qwen3 uses OpenAI-compatible format
    let text = "";
    if (responseBody.choices?.[0]?.message?.content) {
      text = responseBody.choices[0].message.content;
    } else if (responseBody.content?.[0]?.text) {
      text = responseBody.content[0].text;
    } else {
      text = JSON.stringify(responseBody, null, 2);
    }

    // Token usage
    const usage = responseBody.usage || {};

    console.log("═══════════════════════════════════════════════════════════");
    console.log("  ✅ SUCCESS — Response received");
    console.log(`  ⏱  Time: ${elapsed}s`);
    console.log(`  📊 Tokens: ${usage.prompt_tokens || "?"} in / ${usage.completion_tokens || "?"} out / ${usage.total_tokens || "?"} total`);
    console.log("═══════════════════════════════════════════════════════════\n");
    console.log(text);

    // Save to file for review
    const fs = await import("fs");
    const outputPath = "test-output-market-structure.py";
    // Extract code block if present
    const codeMatch = text.match(/```python\s*([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1] : text;
    fs.writeFileSync(outputPath, code, "utf-8");
    console.log(`\n📁 Code saved to: ${outputPath}`);

  } catch (err: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error("═══════════════════════════════════════════════════════════");
    console.error("  ❌ FAILED");
    console.error(`  ⏱  Time: ${elapsed}s`);
    console.error(`  🔴 Error: ${err.name}: ${err.message}`);
    console.error("═══════════════════════════════════════════════════════════");

    if (err.name === "ResourceNotFoundException") {
      console.error("\n  💡 The model ID is wrong or not available in this region.");
      console.error(`  Current model: ${MODEL_ID}`);
      console.error(`  Current region: ${REGION}`);
      console.error("  Check: https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-qwen-qwen3-coder-next.html");
    }
    if (err.name === "AccessDeniedException") {
      console.error("\n  💡 Your IAM credentials lack bedrock:InvokeModel permission.");
      console.error("  Add this to your IAM policy:");
      console.error(`  "Resource": "arn:aws:bedrock:${REGION}::foundation-model/${MODEL_ID}"`);
    }
    if (err.name === "ThrottlingException") {
      console.error("\n  💡 Rate limited. Wait a moment and try again.");
    }

    process.exit(1);
  }
}

testQwen3();
