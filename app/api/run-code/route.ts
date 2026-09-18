import { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Execution is delegated to the public Piston demo endpoint, which throttles
// aggressively by origin — so unbounded traffic here doesn't just cost us, it
// makes real interview rounds start failing. That became a live concern once the
// unauthenticated /sample-coding page began calling this route.
//
// Sized to be invisible to a genuine candidate: a round involves a handful of
// runs over many minutes, and each click costs one token, not one per test case.
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(15, "60 s"),
  prefix: "ratelimit:run-code",
});

const LANGUAGE_CONFIG: Record<string, { language: string; version: string }> = {
  javascript: { language: "javascript", version: "18.15.0" },
  python: { language: "python", version: "3.10.0" },
  java: { language: "java", version: "15.0.2" },
  cpp: { language: "cpp", version: "10.2.0" },
};

// The public Piston demo endpoint became whitelist-only on 2026-02-15 and now
// answers 401 for everyone else, which silently broke every coding round. Both
// of these are overridable so the fix is a deploy-config change, not a code
// change: point PISTON_URL at a self-hosted instance, or set PISTON_TOKEN if
// this origin gets whitelisted on the public one.
const EXECUTE_URL =
  process.env.PISTON_URL ?? "https://emkc.org/api/v2/piston/execute";
const PISTON_TOKEN = process.env.PISTON_TOKEN;

interface TestCase {
  input: string;
  expectedOutput: string;
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const { success, remaining, reset } = await ratelimit.limit(ip);

    if (!success) {
      return Response.json(
        {
          error:
            "Too many runs in the last minute. Wait a few seconds and run again.",
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
          },
        }
      );
    }

    const { language, code, testCases } = await req.json();

    const config = LANGUAGE_CONFIG[language];
    if (!config) {
      return Response.json({ error: "Unsupported language." }, { status: 400 });
    }

    if (!code || !code.trim()) {
      return Response.json({ error: "No code submitted." }, { status: 400 });
    }

    if (!Array.isArray(testCases) || testCases.length === 0) {
      return Response.json({ error: "No test cases provided." }, { status: 400 });
    }

    const results = await Promise.all(
      (testCases as TestCase[]).map(async (tc) => {
        try {
          const res = await fetch(EXECUTE_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(PISTON_TOKEN ? { Authorization: PISTON_TOKEN } : {}),
            },
            body: JSON.stringify({
              language: config.language,
              version: config.version,
              files: [{ content: code }],
              stdin: tc.input,
            }),
          });

          const data = await res.json();

          // A response with no `run` block is the execution service refusing us
          // — an auth/quota rejection or an outage — NOT the candidate's code
          // failing. Reading `data?.run?.output` straight into an empty string
          // reported that as a plain failed test, so a correct solution came
          // back as "expected 15, got nothing" with no hint that the service
          // was the problem. Surface it as an infrastructure error instead.
          if (!res.ok || !data?.run) {
            const upstream =
              typeof data?.message === "string" ? data.message : `HTTP ${res.status}`;
            console.error("Piston rejected execution:", res.status, upstream);
            return {
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              actualOutput: "",
              stderr: `Execution service error: ${upstream}`,
              passed: false,
              serviceError: true,
            };
          }

          const actualOutput = (data.run.output ?? "").toString();
          const stderr = (data.run.stderr ?? "").toString();

          const normalize = (s: string) => s.trim().replace(/\r\n/g, "\n");
          const passed =
            !stderr && normalize(actualOutput) === normalize(tc.expectedOutput);

          return {
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: actualOutput.trim(),
            stderr: stderr.trim(),
            passed,
            serviceError: false,
          };
        } catch (err) {
          console.error("Piston execution error:", err);
          return {
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: "",
            stderr: "Execution service unavailable. Please try again.",
            passed: false,
            serviceError: true,
          };
        }
      })
    );

    // If nothing could be executed at all, this was not a 0/N submission — say
    // so with a non-200 so callers show an error rather than a failing score.
    // Scoring a candidate 0 because our execution provider was down would be a
    // silent, permanent injustice on a saved interview record.
    if (results.every((r) => r.serviceError)) {
      return Response.json(
        {
          error:
            results[0]?.stderr ||
            "Could not reach the code execution service. Please try again shortly.",
        },
        { status: 503 }
      );
    }

    const passedCount = results.filter((r) => r.passed).length;

    return Response.json({
      results,
      testsPassed: passedCount,
      testsTotal: results.length,
    });
  } catch (err) {
    console.error("run-code error:", err);
    return Response.json(
      { error: "Something went wrong running the code." },
      { status: 500 }
    );
  }
}
