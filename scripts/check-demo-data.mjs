#!/usr/bin/env node
/**
 * Fails the build if a demonstration value can reach a live screen.
 *
 * The portal deliberately runs in two modes: against the API, and against a
 * bundled dataset so it can be shown on a laptop with no backend. That is a
 * feature, and banning the import outright would remove it.
 *
 * What went wrong was subtler and is not visible in a diff. Twelve call sites
 * read the demo dataset *unconditionally* — the sidebar's alert badges, the
 * command palette, four tabs of the vendor page, the zone and vendor filter
 * options on four tables. Against the API those screens showed a city that does
 * not exist: badges counting settlements that were not pending, a search that
 * offered zones which returned "not found", filters whose every option matched
 * nothing. Each was a one-line omission, none of them looked wrong in review,
 * and together they made a working deployment look broken.
 *
 * So the rule this enforces is not "do not import the demo data" but "a demo
 * value must be unreachable when `isLiveApi` is true". A usage satisfies it by
 * being one of:
 *
 *   - the `demoData` argument of `useResource(key, fetcher, DEMO)` — the hook
 *     already discards it in live mode, which is the whole point of the hook;
 *   - inside an expression that tests `isLiveApi`;
 *   - inside a function or block whose body tests `isLiveApi` — this covers the
 *     `if (!isLiveApi) { ...demo... return; }` early-return that the write paths
 *     use;
 *   - a module-level constant that is itself gated, e.g. `isLiveApi ? [] : DEMO`.
 *
 * Anything else is reported with its line, because it is the bug above.
 *
 * Run with `--verbose` to also list `?? DEMO` fallbacks. Those are legal — a
 * screen chooses to fall back rather than show nothing — but they are how a
 * failed request becomes a plausible-looking wrong number, so they are worth
 * reviewing deliberately rather than acquiring by habit.
 *
 * Reports by default and exits zero; `--strict` makes it fail. It is not yet in
 * the build because the remaining entries each need a judgement rather than a
 * fix — a default parameter that every caller overrides is not the same fault
 * as a frozen clock used for live date arithmetic. Work the list down, then
 * turn on `--strict` in CI and it can never grow back.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SEARCH = ["src/frontend/components", "src/frontend/hooks", "src/frontend/lib"];
const MOCK_MODULE = "@/frontend/lib/mock";
const VERBOSE = process.argv.includes("--verbose");

/** Every .ts/.tsx file beneath the search roots. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

/**
 * The identifiers a file pulls in from the demo dataset, resolved through any
 * `as` alias so `DASHBOARD as DEMO_DASHBOARD` is tracked by the name actually
 * used in the body rather than the one at the import.
 */
function importedNames(source) {
  const match = source.match(
    new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${MOCK_MODULE}["']`, "s"),
  );
  if (!match) return [];
  return match[1]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const alias = part.split(/\s+as\s+/);
      return (alias[1] ?? alias[0]).trim();
    })
    .filter((name) => /^[A-Z][A-Z0-9_]*$/.test(name));
}

/** The character range of the innermost `{...}` or `(...)` enclosing `index`. */
function enclosing(source, index, openers) {
  let depth = 0;
  let start = -1;
  for (let i = index; i >= 0; i -= 1) {
    const c = source[i];
    if (c === ")" || c === "}") depth += 1;
    else if (c === "(" || c === "{") {
      if (depth === 0 && openers.includes(c)) {
        start = i;
        break;
      }
      depth -= 1;
    }
  }
  if (start === -1) return null;

  depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const c = source[i];
    if (c === "(" || c === "{") depth += 1;
    else if (c === ")" || c === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return source.slice(start);
}

const problems = [];
const fallbacks = [];

for (const root of SEARCH) {
  for (const file of walk(join(ROOT, root))) {
    const source = readFileSync(file, "utf8");
    const names = importedNames(source);
    if (names.length === 0) continue;

    const rel = relative(ROOT, file);
    // Skip the import statement itself when scanning the body.
    const bodyStart = source.indexOf(`from "${MOCK_MODULE}"`);

    for (const name of names) {
      const usage = new RegExp(`\\b${name}\\b`, "g");
      let hit;
      while ((hit = usage.exec(source)) !== null) {
        if (hit.index < bodyStart) continue;

        const line = source.slice(0, hit.index).split("\n").length;
        const statement = source.slice(
          source.lastIndexOf("\n", source.lastIndexOf("\n", hit.index - 1) - 1) + 1,
          source.indexOf("\n", hit.index) + 1,
        );

        // `useResource(key, fetcher, DEMO)` — the hook discards it when live.
        const call = enclosing(source, hit.index, ["("]) ?? "";
        if (/useResource\s*<?[^(]*\(\s*$/.test(source.slice(Math.max(0, hit.index - 400), hit.index).split(/\)\s*;?\s*$/)[0])) {
          continue;
        }
        if (/\buseResource\b/.test(source.slice(Math.max(0, hit.index - 300), hit.index))) continue;

        // Gated in the expression, the enclosing block, or the statement.
        const block = enclosing(source, hit.index, ["{"]) ?? "";
        if (/\bisLiveApi\b/.test(call) || /\bisLiveApi\b/.test(block) || /\bisLiveApi\b/.test(statement)) {
          if (VERBOSE && /\?\?\s*[A-Z][A-Z0-9_]*/.test(statement)) {
            fallbacks.push(`${rel}:${line}  ${name}  ${statement.trim().slice(0, 90)}`);
          }
          continue;
        }

        // A `?? DEMO` with no gate at all is the silent-wrong-number case.
        problems.push({
          file: rel,
          line,
          name,
          snippet: statement.trim().replace(/\s+/g, " ").slice(0, 110),
        });
      }
    }
  }
}

if (VERBOSE && fallbacks.length) {
  console.log(`\nGated fallbacks (legal, but they hide a failed request):\n`);
  for (const f of fallbacks) console.log(`  ${f}`);
}

const STRICT = process.argv.includes("--strict");

if (problems.length === 0) {
  console.log("✔ no demonstration value is reachable with a live API");
  process.exit(0);
}

console.error(
  `\n✖ ${problems.length} demonstration value${problems.length === 1 ? "" : "s"} reachable with a live API.\n` +
    `  Each of these renders invented data on a real deployment.\n` +
    `  Gate it on \`isLiveApi\`, or pass it as the \`demoData\` argument of \`useResource\`.\n`,
);
for (const p of problems) {
  console.error(`  ${p.file}:${p.line}\n    ${p.name} — ${p.snippet}\n`);
}
process.exit(STRICT ? 1 : 0);
