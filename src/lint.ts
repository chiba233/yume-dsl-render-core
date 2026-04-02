import type { SourceSpan, StructuralNode, StructuralParseOptions } from "yume-dsl-rich-text";
import { parseStructural } from "yume-dsl-rich-text";
import { findFirst, findAll, walkStructural } from "./query.ts";
import type { StructuralPredicate, StructuralVisitor } from "./query.ts";

// ── Diagnostic types ──

export type DiagnosticSeverity = "error" | "warning" | "info" | "hint";

export interface TextEdit {
  /** Source range to replace. */
  span: SourceSpan;
  /** Replacement text (empty string to delete). */
  newText: string;
}

export interface Fix {
  description: string;
  edits: TextEdit[];
}

export interface Diagnostic {
  ruleId: string;
  severity: DiagnosticSeverity;
  message: string;
  /** Source span of the issue. */
  span: SourceSpan;
  /** The node that triggered the diagnostic, if available. */
  node?: StructuralNode;
  /** Optional auto-fix. */
  fix?: Fix;
}

// ── Rule interface ──

export type ReportInfo = Omit<Diagnostic, "ruleId" | "severity"> & {
  /** Override severity for this specific report. Defaults to the rule's severity. */
  severity?: DiagnosticSeverity;
};

export interface LintContext {
  /** Original source text. */
  source: string;
  /** Structural tree (parsed with `trackPositions: true`). */
  tree: StructuralNode[];
  /** Report a diagnostic. */
  report: (info: ReportInfo) => void;
  /** Depth-first pre-order search — first match. */
  findFirst: (nodes: StructuralNode[], predicate: StructuralPredicate) => StructuralNode | undefined;
  /** Depth-first pre-order search — all matches. */
  findAll: (nodes: StructuralNode[], predicate: StructuralPredicate) => StructuralNode[];
  /** Depth-first pre-order traversal — visit every node with context. */
  walk: (nodes: StructuralNode[], visitor: StructuralVisitor) => void;
}

export interface LintRule {
  /** Unique rule identifier (e.g. "no-empty-tag", "max-nesting-depth"). */
  id: string;
  /** Default severity. Can be overridden via `LintOptions.overrides`. */
  severity?: DiagnosticSeverity;
  /** Run the rule against the parsed tree. Use `ctx.report()` to emit diagnostics. */
  check: (ctx: LintContext) => void;
}

// ── Runner ──

export interface LintOptions {
  rules: LintRule[];
  /** Override severity per rule id. Set to `"off"` to disable a rule. */
  overrides?: Record<string, DiagnosticSeverity | "off">;
  /**
   * Parser options forwarded to `parseStructural`.
   *
   * Pass the same `handlers`, `allowForms`, `syntax`, `tagName`, and `depthLimit`
   * that your runtime parser uses — otherwise lint may accept structures that
   * the real parser would reject or degrade.
   *
   * `trackPositions` is always forced to `true` internally.
   */
  parseOptions?: Omit<StructuralParseOptions, "trackPositions">;
  /**
   * Called when a rule throws during `check`.
   * The error is swallowed after `onRuleError` returns — other rules continue.
   * If omitted, rule errors are silently ignored (other rules still run).
   * To fail fast instead, set `failFast: true`.
   */
  onRuleError?: (context: { ruleId: string; error: unknown }) => void;
  /**
   * When true, a rule that throws during `check` immediately aborts
   * `lintStructural` with a wrapped error — no further rules run.
   * Takes precedence over `onRuleError`.
   * Default: `false` (errors are reported via `onRuleError` or silently ignored).
   */
  failFast?: boolean;
}

const wrapRuleError = (ruleId: string, error: unknown): Error => {
  if (error instanceof Error) {
    const wrapped = new Error(`Lint rule "${ruleId}" failed: ${error.message}`);
    (wrapped as Error & { cause?: unknown }).cause = error;
    return wrapped;
  }

  return new Error(`Lint rule "${ruleId}" failed: ${String(error)}`);
};

/**
 * Lint DSL source text by running a set of rules against its structural tree.
 *
 * Parses the source with `trackPositions: true` (plus any `parseOptions`),
 * then runs each rule's `check` function. Rules that throw are isolated —
 * the error is reported via `onRuleError` and remaining rules continue.
 * Returns all collected diagnostics sorted by source offset.
 */
export const lintStructural = (source: string, options: LintOptions): Diagnostic[] => {
  const tree = parseStructural(source, {
    ...options.parseOptions,
    trackPositions: true,
  });

  const diagnostics: Diagnostic[] = [];

  for (const rule of options.rules) {
    const overrideSeverity = options.overrides?.[rule.id];
    if (overrideSeverity === "off") continue;

    const defaultSeverity = overrideSeverity ?? rule.severity ?? "warning";

    try {
      rule.check({
        source,
        tree,
        report: (info) => {
          diagnostics.push({
            ...info,
            ruleId: rule.id,
            severity: info.severity ?? defaultSeverity,
          });
        },
        findFirst,
        findAll,
        walk: walkStructural,
      });
    } catch (error) {
      if (options.failFast) {
        throw wrapRuleError(rule.id, error);
      }
      if (options.onRuleError) {
        options.onRuleError({ ruleId: rule.id, error });
      }
    }
  }

  return diagnostics.sort((a, b) => a.span.start.offset - b.span.start.offset);
};

// ── applyLintFixes ──

interface TaggedEdit {
  edit: TextEdit;
  fixIndex: number;
}

/**
 * Check whether a fix's own edits overlap internally.
 * Edits must be sorted by start offset before calling.
 */
const hasInternalOverlap = (edits: TextEdit[]): boolean => {
  if (edits.length <= 1) return false;
  const sorted = edits.slice().sort((a, b) => a.span.start.offset - b.span.start.offset);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].span.start.offset < sorted[i - 1].span.end.offset) return true;
  }
  return false;
};

/**
 * Apply fixable diagnostics to source text, producing a new string.
 *
 * Only diagnostics with a `fix` field are considered. Fixes are applied
 * atomically — if any edit within a fix overlaps with a previously accepted
 * edit, the **entire fix** is skipped (all-or-nothing per fix).
 *
 * Conflict strategy: **first-wins by start offset**. When two fixes' edits
 * overlap, the fix whose earliest edit comes first in source order is accepted;
 * the later fix is rejected entirely.
 *
 * A fix whose own edits overlap internally is also rejected (malformed fix).
 *
 * Within accepted fixes, edits are applied in reverse source order so that
 * earlier offsets remain valid.
 */
export const applyLintFixes = (source: string, diagnostics: Diagnostic[]): string => {
  // Collect all edits tagged with their fix index.
  // Pre-reject fixes with internal overlaps.
  const tagged: TaggedEdit[] = [];
  const rejectedFixes = new Set<number>();
  let fixIndex = 0;
  for (const d of diagnostics) {
    if (d.fix) {
      if (hasInternalOverlap(d.fix.edits)) {
        rejectedFixes.add(fixIndex);
      } else {
        for (const edit of d.fix.edits) {
          tagged.push({ edit, fixIndex });
        }
      }
      fixIndex++;
    }
  }

  if (tagged.length === 0) return source;

  // Sort edits by start offset ascending, then by end offset descending
  // so that wider edits win when two fixes start at the same position.
  tagged.sort((a, b) => {
    const s = a.edit.span.start.offset - b.edit.span.start.offset;
    if (s !== 0) return s;
    return b.edit.span.end.offset - a.edit.span.end.offset;
  });

  // Determine which fixes to reject due to cross-fix overlap.
  // Strategy: first-wins — the fix whose edit appears earlier in source order
  // is accepted; the later overlapping fix is rejected entirely.
  let lastEnd = -1;
  for (const t of tagged) {
    if (rejectedFixes.has(t.fixIndex)) continue;
    if (t.edit.span.start.offset < lastEnd) {
      // This edit overlaps with a previously accepted edit — reject its entire fix.
      rejectedFixes.add(t.fixIndex);
      continue;
    }
    lastEnd = t.edit.span.end.offset;
  }

  // Collect accepted edits.
  const accepted: TextEdit[] = [];
  for (const t of tagged) {
    if (!rejectedFixes.has(t.fixIndex)) {
      accepted.push(t.edit);
    }
  }

  if (accepted.length === 0) return source;

  // Sort accepted edits by start offset (already mostly sorted, but re-sort
  // since rejected-fix removal may have changed relative order).
  accepted.sort((a, b) => a.span.start.offset - b.span.start.offset);

  // Apply in reverse order so earlier offsets stay valid.
  let result = source;
  for (let i = accepted.length - 1; i >= 0; i--) {
    const edit = accepted[i];
    result = result.slice(0, edit.span.start.offset) + edit.newText + result.slice(edit.span.end.offset);
  }

  return result;
};
