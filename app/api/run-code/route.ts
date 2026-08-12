import { NextRequest } from "next/server";

const LANGUAGE_CONFIG: Record<string, { language: string; version: string }> = {
  javascript: { language: "javascript", version: "18.15.0" },
  python: { language: "python", version: "3.10.0" },
  java: { language: "java", version: "15.0.2" },
  cpp: { language: "cpp", version: "10.2.0" },
};

interface TestCase {
  input: string;
  expectedOutput: string;
}

export async function POST(req: NextRequest) {
  try {
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
          const res = await fetch("https://emkc.org/api/v2/piston/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              language: config.language,
              version: config.version,
              files: [{ content: code }],
              stdin: tc.input,
            }),
          });

          const data = await res.json();
          const actualOutput = (data?.run?.output ?? "").toString();
          const stderr = (data?.run?.stderr ?? "").toString();

          const normalize = (s: string) => s.trim().replace(/\r\n/g, "\n");
          const passed =
            !stderr && normalize(actualOutput) === normalize(tc.expectedOutput);

          return {
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: actualOutput.trim(),
            stderr: stderr.trim(),
            passed,
          };
        } catch (err) {
          console.error("Piston execution error:", err);
          return {
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: "",
            stderr: "Execution service unavailable. Please try again.",
            passed: false,
          };
        }
      })
    );

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
