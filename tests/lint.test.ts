import assert from "node:assert/strict";
import type { LintRule, Diagnostic } from "../src/index.ts";
import { lintStructural, applyLintFixes } from "../src/index.ts";

interface TestCase {
  name: string;
  run: () => void | Promise<void>;
}

// ── Example rules ──

const noEmptyInline: LintRule = {
  id: "no-empty-inline",
  severity: "warning",
  check: (ctx) => {
    const empties = ctx.findAll(ctx.tree, (node) =>
      node.type === "inline" && node.children.length === 0,
    );
    for (const node of empties) {
      if (node.position) {
        ctx.report({
          message: `Empty inline tag: ${node.type === "inline" ? node.tag : ""}`,
          span: node.position,
          node,
        });
      }
    }
  },
};

const noTagByName = (tag: string): LintRule => ({
  id: `no-${tag}`,
  severity: "warning",
  check: (ctx) => {
    const found = ctx.findFirst(ctx.tree, (node) =>
      node.type === "inline" && node.tag === tag,
    );
    if (found?.position) {
      ctx.report({
        message: `Tag "${tag}" is not allowed`,
        span: found.position,
        node: found,
      });
    }
  },
});

// ── Cases ──

const cases: TestCase[] = [
  {
    name: "lintStructural: no rules produces no diagnostics",
    run: () => {
      const result = lintStructural("$$bold(hello)$$", { rules: [] });
      assert.deepEqual(result, []);
    },
  },
  {
    name: "lintStructural: rule detects empty inline tag",
    run: () => {
      const result = lintStructural("$$bold()$$", { rules: [noEmptyInline] });
      assert.equal(result.length, 1);
      assert.equal(result[0].ruleId, "no-empty-inline");
      assert.equal(result[0].severity, "warning");
      assert.ok(result[0].message.includes("bold"));
      assert.ok(result[0].span);
    },
  },
  {
    name: "lintStructural: rule passes on non-empty tag",
    run: () => {
      const result = lintStructural("$$bold(hello)$$", { rules: [noEmptyInline] });
      assert.equal(result.length, 0);
    },
  },
  {
    name: "lintStructural: multiple diagnostics sorted by offset",
    run: () => {
      const result = lintStructural("$$bold()$$ then $$italic()$$", { rules: [noEmptyInline] });
      assert.equal(result.length, 2);
      assert.ok(result[0].span.start.offset < result[1].span.start.offset);
    },
  },
  {
    name: "lintStructural: severity override replaces rule default",
    run: () => {
      const result = lintStructural("$$bold()$$", {
        rules: [noEmptyInline],
        overrides: { "no-empty-inline": "error" },
      });
      assert.equal(result.length, 1);
      assert.equal(result[0].severity, "error");
    },
  },
  {
    name: "lintStructural: override 'off' disables rule",
    run: () => {
      const result = lintStructural("$$bold()$$", {
        rules: [noEmptyInline],
        overrides: { "no-empty-inline": "off" },
      });
      assert.equal(result.length, 0);
    },
  },
  {
    name: "lintStructural: report-level severity overrides rule default",
    run: () => {
      const ruleWithReportSeverity: LintRule = {
        id: "custom-severity",
        severity: "warning",
        check: (ctx) => {
          const node = ctx.findFirst(ctx.tree, (n) => n.type === "inline");
          if (node?.position) {
            ctx.report({
              message: "test",
              span: node.position,
              severity: "hint",
            });
          }
        },
      };
      const result = lintStructural("$$bold(x)$$", { rules: [ruleWithReportSeverity] });
      assert.equal(result.length, 1);
      assert.equal(result[0].severity, "hint");
    },
  },
  {
    name: "lintStructural: multiple rules run independently",
    run: () => {
      const result = lintStructural("$$bold()$$", {
        rules: [noEmptyInline, noTagByName("bold")],
      });
      assert.equal(result.length, 2);
      const ruleIds = result.map((d) => d.ruleId).sort();
      assert.deepEqual(ruleIds, ["no-bold", "no-empty-inline"]);
    },
  },
  {
    name: "lintStructural: default severity is 'warning' when rule omits it",
    run: () => {
      const noSeverityRule: LintRule = {
        id: "no-severity",
        check: (ctx) => {
          const node = ctx.findFirst(ctx.tree, (n) => n.type === "text");
          if (node?.position) {
            ctx.report({ message: "test", span: node.position });
          }
        },
      };
      const result = lintStructural("hello", { rules: [noSeverityRule] });
      assert.equal(result.length, 1);
      assert.equal(result[0].severity, "warning");
    },
  },
  {
    name: "lintStructural: empty source produces no diagnostics",
    run: () => {
      const result = lintStructural("", { rules: [noEmptyInline] });
      assert.equal(result.length, 0);
    },
  },
  {
    name: "lintStructural: diagnostic includes node reference",
    run: () => {
      const result = lintStructural("$$bold()$$", { rules: [noEmptyInline] });
      assert.equal(result.length, 1);
      assert.ok(result[0].node);
      assert.equal(result[0].node!.type, "inline");
    },
  },
  {
    name: "lintStructural: findFirst in context works",
    run: () => {
      const firstTextRule: LintRule = {
        id: "first-text",
        check: (ctx) => {
          const node = ctx.findFirst(ctx.tree, (n) => n.type === "text");
          if (node?.position) {
            ctx.report({ message: "found text", span: node.position });
          }
        },
      };
      const result = lintStructural("hello $$bold(world)$$", { rules: [firstTextRule] });
      assert.equal(result.length, 1);
      assert.equal(result[0].message, "found text");
    },
  },
  {
    name: "lintStructural: fix field preserved in diagnostic",
    run: () => {
      const fixRule: LintRule = {
        id: "fix-test",
        check: (ctx) => {
          const node = ctx.findFirst(ctx.tree, (n) => n.type === "inline");
          if (node?.position) {
            ctx.report({
              message: "fixable",
              span: node.position,
              fix: {
                description: "remove tag",
                edits: [{ span: node.position, newText: "" }],
              },
            });
          }
        },
      };
      const result = lintStructural("$$bold(x)$$", { rules: [fixRule] });
      assert.equal(result.length, 1);
      assert.ok(result[0].fix);
      assert.equal(result[0].fix!.description, "remove tag");
      assert.equal(result[0].fix!.edits.length, 1);
    },
  },
  {
    name: "lintStructural: custom syntax forwarded to parser",
    run: () => {
      const syntax = {
        tagPrefix: "@@",
        tagOpen: "[",
        tagClose: "]",
        tagDivider: ";",
        endTag: "]@@",
        rawOpen: "]%",
        blockOpen: "]*",
        rawClose: "%end@@",
        blockClose: "*end@@",
        escapeChar: "~",
      };
      const result = lintStructural("@@bold[]@@", {
        rules: [noEmptyInline],
        parseOptions: { syntax },
      });
      assert.equal(result.length, 1);
      assert.equal(result[0].ruleId, "no-empty-inline");
    },
  },

  // ── Error isolation ──
  {
    name: "lintStructural: rule that throws does not crash other rules",
    run: () => {
      const throwingRule: LintRule = {
        id: "throws",
        check: () => { throw new Error("boom"); },
      };
      const errors: unknown[] = [];
      const result = lintStructural("$$bold()$$", {
        rules: [throwingRule, noEmptyInline],
        onRuleError: ({ error }) => errors.push(error),
      });
      // noEmptyInline still ran
      assert.equal(result.length, 1);
      assert.equal(result[0].ruleId, "no-empty-inline");
      // error was reported
      assert.equal(errors.length, 1);
      assert.ok(errors[0] instanceof Error);
    },
  },
  {
    name: "lintStructural: rule error silently ignored when no onRuleError",
    run: () => {
      const throwingRule: LintRule = {
        id: "throws",
        check: () => { throw new Error("boom"); },
      };
      const result = lintStructural("$$bold()$$", {
        rules: [throwingRule, noEmptyInline],
      });
      assert.equal(result.length, 1);
    },
  },

  // ── walkStructural in context ──
  {
    name: "lintStructural: ctx.walk visits all nodes with context",
    run: () => {
      const depthRule: LintRule = {
        id: "depth-check",
        check: (ctx) => {
          ctx.walk(ctx.tree, (node, visitCtx) => {
            if (visitCtx.depth >= 2 && node.type === "inline" && node.position) {
              ctx.report({
                message: `Too deep at depth ${visitCtx.depth}`,
                span: node.position,
                node,
              });
            }
          });
        },
      };
      const result = lintStructural("$$a($$b($$c(x)$$)$$)$$", { rules: [depthRule] });
      // $$c is at depth 2
      assert.equal(result.length, 1);
      assert.ok(result[0].message.includes("depth 2"));
    },
  },

  // ── applyFixes ──
  {
    name: "applyLintFixes: no fixable diagnostics returns source unchanged",
    run: () => {
      const diagnostics: Diagnostic[] = [{
        ruleId: "test",
        severity: "warning",
        message: "no fix",
        span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 5, line: 1, column: 6 } },
      }];
      assert.equal(applyLintFixes("hello", diagnostics), "hello");
    },
  },
  {
    name: "applyLintFixes: single edit replaces text",
    run: () => {
      const source = "$$bold(hello)$$";
      // not empty, so build a diagnostic manually
      const diagnostics: Diagnostic[] = [{
        ruleId: "test",
        severity: "warning",
        message: "test",
        span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 15, line: 1, column: 16 } },
        fix: {
          description: "unwrap",
          edits: [{
            span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 15, line: 1, column: 16 } },
            newText: "hello",
          }],
        },
      }];
      assert.equal(applyLintFixes(source, diagnostics), "hello");
    },
  },
  {
    name: "applyLintFixes: multiple non-overlapping edits applied correctly",
    run: () => {
      // "AABBCC" — replace AA with X, CC with Y
      const source = "AABBCC";
      const diagnostics: Diagnostic[] = [
        {
          ruleId: "t", severity: "warning", message: "",
          span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 2, line: 1, column: 3 } },
          fix: { description: "", edits: [{ span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 2, line: 1, column: 3 } }, newText: "X" }] },
        },
        {
          ruleId: "t", severity: "warning", message: "",
          span: { start: { offset: 4, line: 1, column: 5 }, end: { offset: 6, line: 1, column: 7 } },
          fix: { description: "", edits: [{ span: { start: { offset: 4, line: 1, column: 5 }, end: { offset: 6, line: 1, column: 7 } }, newText: "Y" }] },
        },
      ];
      assert.equal(applyLintFixes(source, diagnostics), "XBBY");
    },
  },
  {
    name: "applyLintFixes: overlapping edits — first wins",
    run: () => {
      // "ABCDEF" — edit1: [0,4) → "X", edit2: [2,6) → "Y" (overlaps)
      const source = "ABCDEF";
      const diagnostics: Diagnostic[] = [
        {
          ruleId: "t", severity: "warning", message: "",
          span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 4, line: 1, column: 5 } },
          fix: { description: "", edits: [{ span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 4, line: 1, column: 5 } }, newText: "X" }] },
        },
        {
          ruleId: "t", severity: "warning", message: "",
          span: { start: { offset: 2, line: 1, column: 3 }, end: { offset: 6, line: 1, column: 7 } },
          fix: { description: "", edits: [{ span: { start: { offset: 2, line: 1, column: 3 }, end: { offset: 6, line: 1, column: 7 } }, newText: "Y" }] },
        },
      ];
      assert.equal(applyLintFixes(source, diagnostics), "XEF");
    },
  },
  {
    name: "applyLintFixes: delete edit (empty newText)",
    run: () => {
      const source = "hello world";
      const diagnostics: Diagnostic[] = [{
        ruleId: "t", severity: "warning", message: "",
        span: { start: { offset: 5, line: 1, column: 6 }, end: { offset: 6, line: 1, column: 7 } },
        fix: { description: "remove space", edits: [{ span: { start: { offset: 5, line: 1, column: 6 }, end: { offset: 6, line: 1, column: 7 } }, newText: "" }] },
      }];
      assert.equal(applyLintFixes(source, diagnostics), "helloworld");
    },
  },
  {
    name: "applyLintFixes: end-to-end with lint",
    run: () => {
      const removeEmptyInline: LintRule = {
        id: "remove-empty",
        check: (ctx) => {
          ctx.findAll(ctx.tree, (node) => {
            if (node.type === "inline" && node.children.length === 0 && node.position) {
              ctx.report({
                message: "empty",
                span: node.position,
                fix: {
                  description: "remove empty tag",
                  edits: [{ span: node.position, newText: "" }],
                },
              });
            }
            return false;
          });
        },
      };
      const source = "before $$bold()$$ after";
      const diagnostics = lintStructural(source, { rules: [removeEmptyInline] });
      const fixed = applyLintFixes(source, diagnostics);
      assert.equal(fixed, "before  after");
    },
  },

  // ── parseOptions forwarding ──
  {
    name: "lintStructural: parseOptions.handlers gates tag recognition",
    run: () => {
      // Without handlers, parseStructural accepts all tags.
      // With handlers that only have inline for "bold", "code" with raw form should degrade.
      const noRawTag: LintRule = {
        id: "no-raw",
        check: (ctx) => {
          ctx.findAll(ctx.tree, (node) => {
            if (node.type === "raw" && node.position) {
              ctx.report({ message: "raw found", span: node.position });
            }
            return false;
          });
        },
      };
      // Without handlers: raw tag is recognized
      const withoutHandlers = lintStructural("$$code(ts)%\ncontent\n%end$$", { rules: [noRawTag] });
      assert.equal(withoutHandlers.length, 1);

      // With handlers that only define inline for "code": raw form degrades to text
      const withHandlers = lintStructural("$$code(ts)%\ncontent\n%end$$", {
        rules: [noRawTag],
        parseOptions: {
          handlers: {
            code: { inline: (tokens) => ({ type: "code", value: tokens }) },
          },
        },
      });
      assert.equal(withHandlers.length, 0);
    },
  },

  // ── applyFixes atomic fix rejection ──
  {
    name: "applyLintFixes: overlapping multi-edit fix is fully rejected",
    run: () => {
      // Fix A has 2 edits: [0,3) and [6,9). Fix B has 1 edit: [2,5) — overlaps with Fix A's first edit.
      // Fix A should be fully rejected (not partially applied).
      const source = "ABCDEFGHI";
      const diagnostics: Diagnostic[] = [
        {
          ruleId: "a", severity: "warning", message: "",
          span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 9, line: 1, column: 10 } },
          fix: {
            description: "fix A",
            edits: [
              { span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 3, line: 1, column: 4 } }, newText: "X" },
              { span: { start: { offset: 6, line: 1, column: 7 }, end: { offset: 9, line: 1, column: 10 } }, newText: "Z" },
            ],
          },
        },
        {
          ruleId: "b", severity: "warning", message: "",
          span: { start: { offset: 2, line: 1, column: 3 }, end: { offset: 5, line: 1, column: 6 } },
          fix: {
            description: "fix B",
            edits: [
              { span: { start: { offset: 2, line: 1, column: 3 }, end: { offset: 5, line: 1, column: 6 } }, newText: "Y" },
            ],
          },
        },
      ];
      const result = applyLintFixes(source, diagnostics);
      // Fix A's first edit [0,3) comes first and is accepted.
      // Fix B's edit [2,5) overlaps → Fix B rejected.
      // Fix A's second edit [6,9) is also accepted.
      assert.equal(result, "XDEFZ");
    },
  },
  {
    name: "applyLintFixes: fix with overlapping edit rejects entire fix, not just the edit",
    run: () => {
      // Fix A: single edit [0,2) → "X"
      // Fix B: two edits — [1,3) overlaps with A, and [5,7) does not.
      // Fix B should be fully rejected — [5,7) must NOT be applied alone.
      const source = "ABCDEFGH";
      const diagnostics: Diagnostic[] = [
        {
          ruleId: "a", severity: "warning", message: "",
          span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 2, line: 1, column: 3 } },
          fix: {
            description: "fix A",
            edits: [
              { span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 2, line: 1, column: 3 } }, newText: "X" },
            ],
          },
        },
        {
          ruleId: "b", severity: "warning", message: "",
          span: { start: { offset: 1, line: 1, column: 2 }, end: { offset: 7, line: 1, column: 8 } },
          fix: {
            description: "fix B",
            edits: [
              { span: { start: { offset: 1, line: 1, column: 2 }, end: { offset: 3, line: 1, column: 4 } }, newText: "Y" },
              { span: { start: { offset: 5, line: 1, column: 6 }, end: { offset: 7, line: 1, column: 8 } }, newText: "Z" },
            ],
          },
        },
      ];
      const result = applyLintFixes(source, diagnostics);
      // Fix A accepted: [0,2) → "X" → source becomes "XCDEFGH"
      // Fix B fully rejected (its [1,3) edit overlaps with A's [0,2))
      // So [5,7) → "Z" must NOT be applied
      assert.equal(result, "XCDEFGH");
    },
  },
  {
    name: "applyLintFixes: fix with internally overlapping edits is rejected",
    run: () => {
      // A single fix has two edits that overlap each other: [0,4) and [2,6).
      // The entire fix should be rejected as malformed.
      const source = "ABCDEF";
      const diagnostics: Diagnostic[] = [
        {
          ruleId: "t", severity: "warning", message: "",
          span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 6, line: 1, column: 7 } },
          fix: {
            description: "bad fix",
            edits: [
              { span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 4, line: 1, column: 5 } }, newText: "X" },
              { span: { start: { offset: 2, line: 1, column: 3 }, end: { offset: 6, line: 1, column: 7 } }, newText: "Y" },
            ],
          },
        },
      ];
      const result = applyLintFixes(source, diagnostics);
      // Malformed fix → rejected → source unchanged
      assert.equal(result, "ABCDEF");
    },
  },
];

// ── Runner ──

const run = async () => {
  for (const testCase of cases) {
    try {
      await testCase.run();
      console.log(`PASS ${testCase.name}`);
    } catch (error) {
      console.error(`FAIL ${testCase.name}`);
      throw error;
    }
  }
  console.log(`PASS ${cases.length} 个lint case`);
};

await run();
