// TARGET PATH: app/api/run-code/route.ts
import { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Execution is delegated to JDoodle's Compiler API. The free plan is capped at
// a small number of credits per day and every /execute call costs one credit,
// so a run of N test cases costs N credits. Unbounded traffic here doesn't just
// cost us, it uses up the day's credits and makes real interview rounds start
// failing. That became a live concern once the unauthenticated /sample-coding
// page began calling this route.
//
// Sized to be invisible to a genuine candidate: a round involves a handful of
// runs over many minutes, and each click costs one token, not one per test case.
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(15, "60 s"),
  prefix: "ratelimit:run-code",
});

// JDoodle identifies a runtime by a language code plus a versionIndex. These
// values must match JDoodle's published language/version table; if a language
// starts failing with an invalid-request error, check its versionIndex first.
const LANGUAGE_CONFIG: Record<string, { language: string; versionIndex: string }> = {
  javascript: { language: "nodejs", versionIndex: "4" },
  python: { language: "python3", versionIndex: "4" },
  java: { language: "java", versionIndex: "4" },
  cpp: { language: "cpp17", versionIndex: "1" },
};

const EXECUTE_URL = "https://api.jdoodle.com/v1/execute";

// Server-side only — never prefix these with NEXT_PUBLIC_.
const JDOODLE_CLIENT_ID = process.env.JDOODLE_CLIENT_ID;
const JDOODLE_CLIENT_SECRET = process.env.JDOODLE_CLIENT_SECRET;

// A hung upstream call should surface as "service unavailable", not hang the
// candidate's Run button indefinitely.
const REQUEST_TIMEOUT_MS = 20_000;

interface TestCase {
  input: string;
  expectedOutput: string;
}

interface RunResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  stderr: string;
  passed: boolean;
  serviceError: boolean;
}

const normalize = (s: string) => s.trim().replace(/\r\n/g, "\n");

function serviceErrorResult(tc: TestCase, message: string): RunResult {
  return {
    input: tc.input,
    expectedOutput: tc.expectedOutput,
    actualOutput: "",
    stderr: message,
    passed: false,
    serviceError: true,
  };
}

async function runOne(
  config: { language: string; versionIndex: string },
  code: string,
  tc: TestCase
): Promise<RunResult> {
  try {
    const res = await fetch(EXECUTE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: JDOODLE_CLIENT_ID,
        clientSecret: JDOODLE_CLIENT_SECRET,
        script: code,
        stdin: tc.input,
        language: config.language,
        versionIndex: config.versionIndex,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const data = await res.json().catch(() => null);

    // JDoodle reports auth failures, an exhausted daily quota and invalid
    // language/version combinations as an HTTP error and/or a non-200
    // `statusCode` in the body, with no usable `output`. That is the execution
    // service refusing us — NOT the candidate's code failing. Reading it as an
    // empty output would report a correct solution as "expected 15, got
    // nothing" with no hint that the service was the problem. Surface it as an
    // infrastructure error instead.
    const rejected =
      !res.ok ||
      !data ||
      typeof data.output !== "string" ||
      (typeof data.statusCode === "number" && data.statusCode !== 200);

    if (rejected) {
      const quotaExhausted = res.status === 429 || data?.statusCode === 429;
      const upstream = quotaExhausted
        ? "Daily code execution limit reached. Try again tomorrow."
        : typeof data?.error === "string"
          ? data.error
          : typeof data?.message === "string"
            ? data.message
            : `HTTP ${res.status}`;
      console.error("JDoodle rejected execution:", res.status, data?.statusCode, upstream);
      return serviceErrorResult(
        tc,
        quotaExhausted ? upstream : `Execution service error: ${upstream}`
      );
    }

    // JDoodle returns stdout, compile errors and runtime errors all in one
    // `output` string, so an error simply shows up in the "actual" column and
    // fails the comparison against the expected output.
    const actualOutput: string = data.output;

    return {
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      actualOutput: actualOutput.trim(),
      stderr: "",
      passed: normalize(actualOutput) === normalize(tc.expectedOutput),
      serviceError: false,
    };
  } catch (err) {
    console.error("JDoodle execution error:", err);
    return serviceErrorResult(tc, "Execution service unavailable. Please try again.");
  }
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

    if (!JDOODLE_CLIENT_ID || !JDOODLE_CLIENT_SECRET) {
      console.error("JDOODLE_CLIENT_ID / JDOODLE_CLIENT_SECRET are not set.");
      return Response.json(
        { error: "Code execution is not configured on the server." },
        { status: 503 }
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

    // Test cases run one after another rather than with Promise.all: JDoodle's
    // free plan has limited concurrency, and once the service has rejected us
    // (bad credentials, exhausted daily credits) there is no point spending
    // more credits on the remaining cases — they're marked as service errors
    // without being sent.
    const results: RunResult[] = [];
    let serviceDownMessage: string | null = null;

    for (const tc of testCases as TestCase[]) {
      if (serviceDownMessage) {
        results.push(serviceErrorResult(tc, serviceDownMessage));
        continue;
      }
      const result = await runOne(config, code, tc);
      if (result.serviceError) serviceDownMessage = result.stderr;
      results.push(result);
    }

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