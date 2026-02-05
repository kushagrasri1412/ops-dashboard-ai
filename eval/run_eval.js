const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { z } = require("zod");

const RESULTS_DIR = path.join(__dirname, "results");
const TEST_CASES_PATH = path.join(__dirname, "test_cases.jsonl");

const CopilotResponseSchema = z.object({
  summary: z.string().min(1),
  key_drivers: z.array(z.string().min(1)).min(3).max(6),
  recommended_actions: z
    .array(
      z.object({
        action: z.string().min(1),
        reason: z.string().min(1),
        priority: z.enum(["high", "medium", "low"]),
      })
    )
    .min(3)
    .max(6),
  confidence: z.number().min(0).max(1),
  used_data_points: z.array(z.string().min(1)).min(1),
});

function readJsonl(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForServer(baseUrl, timeoutMs) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/revenue`, {}, 3000);
      if (response.ok) return;
    } catch (error) {
      // keep polling
    }

    await sleep(500);
  }

  throw new Error(
    `Timed out waiting for server at ${baseUrl}. Start it with \"npm run dev\" or set EVAL_BASE_URL.`
  );
}

async function findRunningServer(candidates) {
  const unique = Array.from(new Set(candidates.filter(Boolean)));

  for (const candidate of unique) {
    try {
      await waitForServer(candidate, 2500);
      return candidate;
    } catch (error) {
      // keep trying
    }
  }

  return null;
}

function scoreActionability(output) {
  const actions = Array.isArray(output?.recommended_actions)
    ? output.recommended_actions
    : [];

  let score = Math.min(5, actions.length);

  const hasOwners = actions.some((item) =>
    typeof item?.action === "string" ? item.action.includes("[Owner:") : false
  );

  if (hasOwners) score = Math.min(5, score + 1);
  return score;
}

function scoreSpecificity(output) {
  const used = Array.isArray(output?.used_data_points) ? output.used_data_points : [];
  let score = Math.min(5, used.length);

  const hasDate = used.some((point) => /\b\d{4}-\d{2}-\d{2}\b/.test(point));
  if (!hasDate && score > 0) score -= 1;

  return Math.max(0, score);
}

function scoreHallucinationPenalty(output) {
  const used = Array.isArray(output?.used_data_points) ? output.used_data_points : [];
  const usedText = used.join("\n");

  const text = [
    output?.summary,
    ...(Array.isArray(output?.key_drivers) ? output.key_drivers : []),
    ...(Array.isArray(output?.recommended_actions)
      ? output.recommended_actions.flatMap((item) => [item.action, item.reason])
      : []),
  ]
    .filter(Boolean)
    .join("\n");

  let score = 5;

  const channelWords = ["DoorDash", "Uber Eats", "Website", "Google", "Catering"];
  const storeWords = [
    "Downtown",
    "River North",
    "West Loop",
    "South Market",
    "Lakeside",
    "Uptown",
    "Old Town",
    "Mission",
    "SoMa",
    "Capitol Hill",
  ];

  for (const word of channelWords) {
    if (text.includes(word) && !usedText.includes(word)) score -= 1;
  }

  for (const word of storeWords) {
    if (text.includes(word) && !usedText.includes(word)) score -= 1;
  }

  // Penalize numeric claims not present in used_data_points.
  const numericClaims = text.match(/\b\d+(?:\.\d+)?%?\b/g) || [];
  const uniqueNumbers = Array.from(new Set(numericClaims)).slice(0, 8);
  for (const token of uniqueNumbers) {
    if (usedText.includes(token)) continue;
    score -= 0.5;
  }

  return Math.max(0, Math.min(5, Number(score.toFixed(1))));
}

function toMarkdown(results, summary) {
  const lines = [];

  lines.push("# Copilot Eval Results");
  lines.push("");
  lines.push(`Run at: ${summary.ran_at}`);
  lines.push(`Base URL: ${summary.base_url}`);
  lines.push(`Cases: ${summary.case_count}`);
  lines.push("");

  lines.push("## Score Summary");
  lines.push("");
  lines.push(`- Schema pass rate: ${(summary.schema_pass_rate * 100).toFixed(1)}%`);
  lines.push(`- Avg actionability: ${summary.avg_actionability.toFixed(2)}`);
  lines.push(`- Avg specificity: ${summary.avg_specificity.toFixed(2)}`);
  lines.push(`- Avg hallucination penalty: ${summary.avg_hallucination_penalty.toFixed(2)}`);
  lines.push("");

  lines.push("## Per-Case");
  lines.push("");
  lines.push(
    "| id | version | schema | actionability | specificity | hallucination |"
  );
  lines.push("| --- | --- | --- | --- | --- | --- |");

  results.forEach((row) => {
    lines.push(
      `| ${row.id} | ${row.prompt_version} | ${row.schema_pass ? "pass" : "fail"} | ${row.scores.actionability} | ${row.scores.specificity_to_data} | ${row.scores.hallucination_penalty} |`
    );
  });

  const failures = results.filter((row) => !row.schema_pass);
  if (failures.length) {
    lines.push("");
    lines.push("## Failures");
    lines.push("");
    failures.forEach((row) => {
      lines.push(`- ${row.id}: ${row.error || "schema validation failed"}`);
    });
  }

  return lines.join("\n");
}

async function run() {
  ensureDir(RESULTS_DIR);

  const testCases = readJsonl(TEST_CASES_PATH);

  const startServer = process.env.EVAL_START_SERVER !== "0";
  const port = process.env.EVAL_PORT || "3100";
  let baseUrl = process.env.EVAL_BASE_URL || `http://127.0.0.1:${port}`;

  const copilotApiKey = process.env.COPILOT_API_KEY || "dev_local_key";

  /** @type {import('child_process').ChildProcess | null} */
  let serverProcess = null;

  const repoRoot = path.join(__dirname, "..");
  const lockPath = path.join(repoRoot, ".next", "dev", "lock");

  if (startServer) {
    if (fs.existsSync(lockPath)) {
      console.log(
        "Detected a Next dev lock file. Looking for an already-running dev server…"
      );

      const candidates = process.env.EVAL_BASE_URL
        ? [baseUrl]
        : [
            baseUrl,
            "http://127.0.0.1:3000",
            "http://localhost:3000",
            "http://127.0.0.1:3001",
          ];

      const running = await findRunningServer(candidates);

      if (running) {
        baseUrl = running;
        console.log(`Using existing server at ${baseUrl} (set EVAL_BASE_URL to override).`);
      } else {
        console.log(
          "No running server detected on common ports. Removing stale dev lock and starting a new server…"
        );
        try {
          fs.unlinkSync(lockPath);
        } catch (error) {
          // ignore
        }
      }
    }

    if (!fs.existsSync(lockPath)) {
      console.log(`Starting Next dev server for eval on ${baseUrl}…`);
      serverProcess = spawn(
        process.platform === "win32" ? "npm.cmd" : "npm",
        ["run", "dev", "--", "--port", port, "--hostname", "127.0.0.1"],
        {
          cwd: repoRoot,
          stdio: "inherit",
          env: {
            ...process.env,
            PORT: port,
          },
        }
      );
    }

    await waitForServer(baseUrl, 45_000);
  } else {
    await waitForServer(baseUrl, 5_000);
  }

  const results = [];

  for (const testCase of testCases) {
    const startedAt = Date.now();
    const body = {
      query: testCase.query,
      prompt_version: testCase.prompt_version,
    };

    try {
      let response = null;
      let payload = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        response = await fetchWithTimeout(
          `${baseUrl}/api/copilot`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": copilotApiKey,
            },
            body: JSON.stringify(body),
          },
          30_000
        );

        payload = await response.json().catch(() => ({}));

        if (response.status !== 429) break;

        const resetAt = Number(response.headers.get("x-ratelimit-reset"));
        const waitMs =
          Number.isFinite(resetAt) && resetAt > Date.now()
            ? resetAt - Date.now() + 250
            : 6500;

        console.log(`Rate limited (429). Waiting ${Math.ceil(waitMs / 1000)}s…`);
        await sleep(waitMs);
      }

      if (!response.ok) {
        results.push({
          id: testCase.id,
          prompt_version: testCase.prompt_version,
          query: testCase.query,
          schema_pass: false,
          error: payload.error || `HTTP ${response.status}`,
          latency_ms: Date.now() - startedAt,
          scores: {
            schema_pass: 0,
            actionability: 0,
            specificity_to_data: 0,
            hallucination_penalty: 0,
          },
          output: payload,
        });
        continue;
      }

      const validation = CopilotResponseSchema.safeParse(payload);
      const schemaPass = validation.success;

      const scores = {
        schema_pass: schemaPass ? 1 : 0,
        actionability: schemaPass ? scoreActionability(payload) : 0,
        specificity_to_data: schemaPass ? scoreSpecificity(payload) : 0,
        hallucination_penalty: schemaPass ? scoreHallucinationPenalty(payload) : 0,
      };

      results.push({
        id: testCase.id,
        prompt_version: testCase.prompt_version,
        query: testCase.query,
        schema_pass: schemaPass,
        error: schemaPass ? null : validation.error.message,
        latency_ms: Date.now() - startedAt,
        scores,
        output: payload,
      });
    } catch (error) {
      results.push({
        id: testCase.id,
        prompt_version: testCase.prompt_version,
        query: testCase.query,
        schema_pass: false,
        error: error instanceof Error ? error.message : "Unknown error",
        latency_ms: Date.now() - startedAt,
        scores: {
          schema_pass: 0,
          actionability: 0,
          specificity_to_data: 0,
          hallucination_penalty: 0,
        },
        output: null,
      });
    }

    // Respect the copilot rate limit: 10 requests/minute/IP (~6s between calls).
    await sleep(6500);
  }

  const caseCount = results.length;
  const schemaPassCount = results.filter((row) => row.schema_pass).length;

  const avg = (key) => {
    const values = results.map((row) => row.scores[key]);
    if (!values.length) return 0;
    return values.reduce((acc, value) => acc + value, 0) / values.length;
  };

  const summary = {
    ran_at: new Date().toISOString(),
    base_url: baseUrl,
    case_count: caseCount,
    schema_pass_rate: caseCount ? schemaPassCount / caseCount : 0,
    avg_actionability: avg("actionability"),
    avg_specificity: avg("specificity_to_data"),
    avg_hallucination_penalty: avg("hallucination_penalty"),
  };

  const outputJson = {
    summary,
    results,
  };

  const jsonPath = path.join(RESULTS_DIR, "latest.json");
  fs.writeFileSync(jsonPath, JSON.stringify(outputJson, null, 2));

  const mdPath = path.join(RESULTS_DIR, "latest.md");
  fs.writeFileSync(mdPath, toMarkdown(results, summary));

  console.log(`\nWrote: ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`Wrote: ${path.relative(process.cwd(), mdPath)}`);

  if (serverProcess) {
    console.log("Stopping eval server…");
    serverProcess.kill("SIGTERM");
  }

  if (schemaPassCount !== caseCount) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
