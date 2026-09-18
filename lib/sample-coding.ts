// TARGET PATH: lib/sample-coding.ts
//
// The three problems behind the public /sample-coding demo page.
//
// Hardcoded rather than AI-generated on request, unlike the real round
// (app/api/coding-question/[id]/route.ts, which derives a problem from the job
// description). A demo has to be identical for every visitor and free to open,
// so there's nothing to gain from a Groq call here — and a generated problem
// with a subtly wrong expected output would break the one page whose whole job
// is making a good first impression.
//
// The shape deliberately matches what the generator is prompted to produce, so
// the demo page can reuse the real round's components and /api/run-code
// unchanged: stdin-driven input in a format the prompt spells out, stdout
// carrying only the answer, and a Java class named `Main` (Piston compiles the
// submitted file as-is).

export type SampleLanguage = "javascript" | "python" | "java" | "cpp";

export interface SampleTestCase {
  input: string;
  expectedOutput: string;
}

export interface SampleProblem {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium";
  /** The pattern an interviewer would say this problem is testing. */
  topic: string;
  prompt: string;
  testCases: SampleTestCase[];
  /** Reads stdin correctly, deliberately does not solve — same as the real round. */
  starterCode: Record<SampleLanguage, string>;
  /**
   * A correct reference solution per language, loaded by the page's "Load a
   * working solution" button. The real round has no such button; here it exists
   * so a visitor who just wants to see what a passing run and real AI feedback
   * look like can get there in one click instead of leaving on a red 0/3.
   */
  solutionCode: Record<SampleLanguage, string>;
}

export const SAMPLE_PROBLEMS: SampleProblem[] = [
  // ---------------------------------------------------------------------------
  {
    id: "array-sum",
    title: "Sum of an Array",
    difficulty: "Easy",
    topic: "Arrays",
    prompt: `Given a list of integers, print their sum.

Input format:
- Line 1: a single integer n — the count of numbers (1 ≤ n ≤ 1000).
- Line 2: n space-separated integers (each between -1,000,000 and 1,000,000).

Output format:
- A single line containing the sum.

Example:
Input:
5
1 2 3 4 5

Output:
15`,
    testCases: [
      { input: "5\n1 2 3 4 5", expectedOutput: "15" },
      { input: "1\n-7", expectedOutput: "-7" },
      { input: "4\n1000000 2000000 3000000 4000000", expectedOutput: "10000000" },
    ],
    starterCode: {
      javascript: String.raw`const lines = require('fs').readFileSync(0, 'utf8').trim().split('\n');
const n = parseInt(lines[0], 10);
const nums = lines[1].trim().split(/\s+/).map(Number);

// Your code here: add up the first n values in nums and print the total.
`,
      python: String.raw`import sys

data = sys.stdin.read().split()
n = int(data[0])
nums = list(map(int, data[1:1 + n]))

# Your code here: add up the values in nums and print the total.
`,
      java: String.raw`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        long[] nums = new long[n];
        for (int i = 0; i < n; i++) {
            nums[i] = sc.nextLong();
        }

        // Your code here: add up the values in nums and print the total.
    }
}
`,
      cpp: String.raw`#include <iostream>
#include <vector>
using namespace std;

int main() {
    int n;
    cin >> n;
    vector<long long> nums(n);
    for (int i = 0; i < n; i++) {
        cin >> nums[i];
    }

    // Your code here: add up the values in nums and print the total.

    return 0;
}
`,
    },
    solutionCode: {
      javascript: String.raw`const lines = require('fs').readFileSync(0, 'utf8').trim().split('\n');
const n = parseInt(lines[0], 10);
const nums = lines[1].trim().split(/\s+/).map(Number);

let sum = 0;
for (let i = 0; i < n; i++) {
  sum += nums[i];
}
console.log(sum);
`,
      python: String.raw`import sys

data = sys.stdin.read().split()
n = int(data[0])
nums = list(map(int, data[1:1 + n]))

print(sum(nums))
`,
      java: String.raw`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        long sum = 0;
        for (int i = 0; i < n; i++) {
            sum += sc.nextLong();
        }
        System.out.println(sum);
    }
}
`,
      cpp: String.raw`#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    long long sum = 0, x;
    for (int i = 0; i < n; i++) {
        cin >> x;
        sum += x;
    }
    cout << sum << endl;
    return 0;
}
`,
    },
  },

  // ---------------------------------------------------------------------------
  {
    id: "reverse-words",
    title: "Reverse the Words",
    difficulty: "Easy",
    topic: "Strings",
    prompt: `Given a sentence, print its words in reverse order.

Input format:
- A single line containing words separated by one or more spaces.

Output format:
- A single line with the words in reverse order, separated by exactly one space.

Example:
Input:
the sky is blue

Output:
blue is sky the`,
    testCases: [
      { input: "the sky is blue", expectedOutput: "blue is sky the" },
      { input: "hello world", expectedOutput: "world hello" },
      { input: "one", expectedOutput: "one" },
    ],
    starterCode: {
      javascript: String.raw`const line = require('fs').readFileSync(0, 'utf8').trim();
const words = line.split(/\s+/);

// Your code here: print the words in reverse order, separated by single spaces.
`,
      python: String.raw`import sys

line = sys.stdin.readline().strip()
words = line.split()

# Your code here: print the words in reverse order, separated by single spaces.
`,
      java: String.raw`import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String[] words = br.readLine().trim().split("\\s+");

        // Your code here: print the words in reverse order, separated by single spaces.
    }
}
`,
      cpp: String.raw`#include <iostream>
#include <sstream>
#include <string>
#include <vector>
using namespace std;

int main() {
    string line;
    getline(cin, line);

    vector<string> words;
    string w;
    istringstream iss(line);
    while (iss >> w) {
        words.push_back(w);
    }

    // Your code here: print the words in reverse order, separated by single spaces.

    return 0;
}
`,
    },
    solutionCode: {
      javascript: String.raw`const line = require('fs').readFileSync(0, 'utf8').trim();
const words = line.split(/\s+/);

console.log(words.reverse().join(' '));
`,
      python: String.raw`import sys

line = sys.stdin.readline().strip()
words = line.split()

print(' '.join(reversed(words)))
`,
      java: String.raw`import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String[] words = br.readLine().trim().split("\\s+");

        StringBuilder sb = new StringBuilder();
        for (int i = words.length - 1; i >= 0; i--) {
            sb.append(words[i]);
            if (i > 0) sb.append(' ');
        }
        System.out.println(sb.toString());
    }
}
`,
      cpp: String.raw`#include <iostream>
#include <sstream>
#include <string>
#include <vector>
using namespace std;

int main() {
    string line;
    getline(cin, line);

    vector<string> words;
    string w;
    istringstream iss(line);
    while (iss >> w) {
        words.push_back(w);
    }

    for (int i = (int)words.size() - 1; i >= 0; i--) {
        cout << words[i];
        if (i > 0) cout << ' ';
    }
    cout << endl;
    return 0;
}
`,
    },
  },

  // ---------------------------------------------------------------------------
  {
    id: "first-unique-char",
    title: "First Non-Repeating Character",
    difficulty: "Medium",
    topic: "Hash maps",
    prompt: `Given a string, print the first character that appears exactly once.

Input format:
- A single line containing a string of lowercase English letters (1 ≤ length ≤ 100000).

Output format:
- The first character that occurs exactly once in the string.
- If every character repeats, print None

Example:
Input:
leetcode

Output:
l

Note: "swiss" gives w, because s repeats and w is the first character that does not.`,
    testCases: [
      { input: "leetcode", expectedOutput: "l" },
      { input: "aabbcc", expectedOutput: "None" },
      { input: "swiss", expectedOutput: "w" },
    ],
    starterCode: {
      javascript: String.raw`const s = require('fs').readFileSync(0, 'utf8').trim();

// Your code here: print the first character of s that appears exactly once,
// or print None if every character repeats.
`,
      python: String.raw`import sys

s = sys.stdin.readline().strip()

# Your code here: print the first character of s that appears exactly once,
# or print None if every character repeats.
`,
      java: String.raw`import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String s = br.readLine().trim();

        // Your code here: print the first character of s that appears exactly once,
        // or print None if every character repeats.
    }
}
`,
      cpp: String.raw`#include <iostream>
#include <string>
#include <unordered_map>
using namespace std;

int main() {
    string s;
    getline(cin, s);

    // Your code here: print the first character of s that appears exactly once,
    // or print None if every character repeats.

    return 0;
}
`,
    },
    solutionCode: {
      javascript: String.raw`const s = require('fs').readFileSync(0, 'utf8').trim();

const counts = new Map();
for (const ch of s) {
  counts.set(ch, (counts.get(ch) || 0) + 1);
}

let answer = 'None';
for (const ch of s) {
  if (counts.get(ch) === 1) {
    answer = ch;
    break;
  }
}
console.log(answer);
`,
      python: String.raw`import sys
from collections import Counter

s = sys.stdin.readline().strip()
counts = Counter(s)

answer = "None"
for ch in s:
    if counts[ch] == 1:
        answer = ch
        break

print(answer)
`,
      java: String.raw`import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String s = br.readLine().trim();

        Map<Character, Integer> counts = new HashMap<>();
        for (char c : s.toCharArray()) {
            counts.merge(c, 1, Integer::sum);
        }

        String answer = "None";
        for (char c : s.toCharArray()) {
            if (counts.get(c) == 1) {
                answer = String.valueOf(c);
                break;
            }
        }
        System.out.println(answer);
    }
}
`,
      cpp: String.raw`#include <iostream>
#include <string>
#include <unordered_map>
using namespace std;

int main() {
    string s;
    getline(cin, s);

    unordered_map<char, int> counts;
    for (char c : s) {
        counts[c]++;
    }

    string answer = "None";
    for (char c : s) {
        if (counts[c] == 1) {
            answer = string(1, c);
            break;
        }
    }
    cout << answer << endl;
    return 0;
}
`,
    },
  },
];

export function getSampleProblem(id: string): SampleProblem | undefined {
  return SAMPLE_PROBLEMS.find((p) => p.id === id);
}

/**
 * What actually separates candidates who do well in this round from ones who
 * don't — written from the failure modes that show up in real submissions, not
 * from generic "practice more" advice.
 */
export const CODING_ROUND_TIPS: { title: string; body: string }[] = [
  {
    title: "Read the input format twice",
    body:
      "More failed runs come from misreading the input format than from bad logic. Check how many lines there are and what's on each one before you write anything.",
  },
  {
    title: "Run before you submit",
    body:
      "Running costs you nothing and catches the silly mistakes — a stray print statement, a missing newline, reading one number too few. Submitting untested code is the most common self-inflicted wound.",
  },
  {
    title: "Get something working, then improve it",
    body:
      "A brute-force solution that passes beats an elegant one that doesn't compile. Say out loud that you're starting simple and will optimise after — interviewers read that as good judgement, not weakness.",
  },
  {
    title: "State your complexity without being asked",
    body:
      "Finish with one sentence: \"this is O(n) time and O(n) space because...\". It's the single fastest way to signal that you understand your own solution.",
  },
  {
    title: "Check the edges",
    body:
      "Empty input, one element, all duplicates, negative numbers, the answer not existing at all. Walk through at least one edge case before you submit.",
  },
  {
    title: "Never go silent",
    body:
      "In the real round an interviewer is listening. If you're stuck, say what you're considering and why you're unsure — a reasoned dead end scores far better than two minutes of nothing.",
  },
];
