#!/usr/bin/env tsx
/**
 * AWS Bedrock Connection Test Script
 *
 * Usage:
 *   npx tsx scripts/test-bedrock-connection.ts
 *
 * This script verifies:
 *   1. Required environment variables are set
 *   2. AWS credentials are valid (can authenticate)
 *   3. Bedrock model is accessible in the configured region
 *   4. A simple inference call succeeds
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env from multiple possible locations (order matters — first wins)
const envPaths = [
  resolve(__dirname, "../../.env"),          // apps/api/.env
  resolve(__dirname, "../../../.env"),        // project root .env
  resolve(__dirname, "../.env"),              // scripts/.env (unlikely)
  resolve(__dirname, "../../.env.local"),     // apps/api/.env.local
  resolve(__dirname, "../../../.env.local"),  // project root .env.local
];
for (const p of envPaths) {
  config({ path: p });
}

const COLORS = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

function log(emoji: string, msg: string) {
  console.log(`${emoji} ${msg}`);
}

function pass(msg: string) {
  log(`${COLORS.green}✓${COLORS.reset}`, `${COLORS.bold}${msg}${COLORS.reset}`);
}

function fail(msg: string) {
  log(`${COLORS.red}✗${COLORS.reset}`, `${COLORS.red}${msg}${COLORS.reset}`);
}

function info(msg: string) {
  log(`${COLORS.cyan}ℹ${COLORS.reset}`, `${COLORS.dim}${msg}${COLORS.reset}`);
}

function warn(msg: string) {
  log(`${COLORS.yellow}⚠${COLORS.reset}`, `${COLORS.yellow}${msg}${COLORS.reset}`);
}

async function main() {
  console.log(
    `\n${COLORS.bold}═══ AWS Bedrock Connection Test ═══${COLORS.reset}\n`
  );

  // ── Step 1: Check environment variables ──
  info("Step 1: Checking environment variables...");

  const region = process.env.AWS_BEDROCK_REGION || "us-east-1";
  const modelId = process.env.AWS_BEDROCK_MODEL_ID || "deepseek.v3.2";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const profile = process.env.AWS_PROFILE;

  const hasIAMKeys = !!(accessKeyId && secretAccessKey);
  const hasProfile = !!profile;

  if (!hasIAMKeys && !hasProfile) {
    fail("No AWS credentials found!");
    console.log(`
  You need to set one of these in your .env file or environment:

  ${COLORS.bold}Option 1: IAM credentials${COLORS.reset}
    AWS_ACCESS_KEY_ID=your-access-key-id
    AWS_SECRET_ACCESS_KEY=your-secret-access-key

  ${COLORS.bold}Option 2: Named profile${COLORS.reset}
    AWS_PROFILE=your-profile-name

  ${COLORS.bold}Region and model:${COLORS.reset}
    AWS_BEDROCK_REGION=us-east-1
    AWS_BEDROCK_MODEL_ID=deepseek.v3.2
`);
    process.exit(1);
  }

  pass(`Region: ${region}`);
  pass(`Model ID: ${modelId}`);
  if (hasIAMKeys) {
    pass(`Credentials: IAM keys (${accessKeyId!.slice(0, 4)}****)`);
  } else {
    pass(`Credentials: AWS Profile "${profile}"`);
  }

  console.log("");

  // ── Step 2: Test AWS SDK client creation ──
  info("Step 2: Testing AWS SDK client creation...");

  try {
    const {
      BedrockRuntimeClient,
      InvokeModelCommand,
    } = await import("@aws-sdk/client-bedrock-runtime");

    const client = new BedrockRuntimeClient({ region });
    pass("BedrockRuntimeClient created successfully");
    console.log("");

    // ── Step 3: Test actual inference call ──
    info("Step 3: Testing inference call (sending a simple prompt)...");

    const testPrompt = JSON.stringify({
      messages: [
        { role: "user", content: "Respond with just: Bedrock connection successful!" },
      ],
      max_tokens: 100,
      temperature: 0.1,
    });

    const invokeCmd = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(testPrompt),
    });

    const startTime = Date.now();
    const response = await client.send(invokeCmd);
    const elapsed = Date.now() - startTime;

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Extract text from various response formats
    let responseText = "";
    if (responseBody.choices?.[0]?.message?.content) {
      responseText = responseBody.choices[0].message.content;
    } else if (responseBody.choices?.[0]?.text) {
      responseText = responseBody.choices[0].text;
    } else if (responseBody.content?.[0]?.text) {
      responseText = responseBody.content[0].text;
    } else if (responseBody.generation) {
      responseText = responseBody.generation;
    } else if (responseBody.output?.text) {
      responseText = responseBody.output.text;
    } else if (typeof responseBody.output === "string") {
      responseText = responseBody.output;
    } else {
      responseText = JSON.stringify(responseBody).slice(0, 500);
    }

    pass(`Inference call succeeded in ${elapsed}ms`);
    info(`Model response: "${responseText.trim().slice(0, 200)}"`);
    console.log("");

    // ── Summary ──
    console.log(`${COLORS.green}${COLORS.bold}═══ All Tests Passed! ═══${COLORS.reset}\n`);
    console.log(`  AWS Bedrock is configured and working with:`);
    console.log(`  Region:  ${COLORS.cyan}${region}${COLORS.reset}`);
    console.log(`  Model:   ${COLORS.cyan}${modelId}${COLORS.reset}`);
    console.log(`  Latency: ${COLORS.cyan}${elapsed}ms${COLORS.reset}\n`);
  } catch (err: any) {
    fail(`Failed to import @aws-sdk/client-bedrock-runtime`);
    console.log(`\n  ${COLORS.dim}Error: ${err.message}`);
    console.log(`  Run: npm install @aws-sdk/client-bedrock-runtime${COLORS.reset}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  fail(`Unexpected error: ${err.message}`);
  process.exit(1);
});
