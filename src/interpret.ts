import type { TextToken } from "yume-dsl-rich-text";
import type {
  InterpretHelpers,
  InterpretResult,
  InterpretRuleset,
  ResolvedResult,
} from "./types.ts";

// ── Companion utility: flattenText ──

const flattenTokenText = (
  value: string | TextToken[],
  seenValues: WeakSet<object>,
  seenTokens: WeakSet<object>,
): string => {
  if (typeof value === "string") return value;

  if (seenValues.has(value)) {
    throw new Error("Circular DSL token value detected while flattening text");
  }
  seenValues.add(value);
  try {
    return value
      .map((token) => {
        if (seenTokens.has(token)) {
          throw new Error(
            `Circular DSL token detected while flattening text for type "${token.type}"`,
          );
        }
        seenTokens.add(token);
        try {
          return flattenTokenText(token.value, seenValues, seenTokens);
        } finally {
          seenTokens.delete(token);
        }
      })
      .join("");
  } finally {
    seenValues.delete(value);
  }
};

export const flattenText = (value: string | TextToken[]): string =>
  flattenTokenText(value, new WeakSet<object>(), new WeakSet<object>());

// ── Internal: error reporting ──

const toError = (value: unknown, fallback: string): Error =>
  value instanceof Error ? value : new Error(fallback);

const reportError = <TNode, TEnv>(
  ruleset: InterpretRuleset<TNode, TEnv>,
  env: TEnv,
  error: Error,
  phase: "interpret" | "flatten" | "traversal" | "internal",
  token?: TextToken,
): void => {
  ruleset.onError?.({ error, phase, token, env });
};

// ── Internal: resolve & iterate ──

const iterateResolved = function* <TNode, TEnv>(
  result: ResolvedResult<TNode>,
  ruleset: InterpretRuleset<TNode, TEnv>,
  helpers: InterpretHelpers<TNode, TEnv>,
  token: TextToken,
): Generator<TNode> {
  switch (result.type) {
    case "nodes":
      yield* result.nodes;
      return;
    case "text":
      yield ruleset.createText(result.text);
      return;
    case "flatten":
      try {
        yield ruleset.createText(helpers.flattenText(token.value));
      } catch (caught) {
        const error = toError(caught, "Failed to flatten DSL token");
        reportError(ruleset, helpers.env, error, "flatten", token);
        throw error;
      }
      return;
    case "drop":
      return;
    default: {
      void (result satisfies never);
      const error = new Error("Unexpected interpret result type: " + String(result));
      reportError(ruleset, helpers.env, error, "internal", token);
      throw error;
    }
  }
};

const resolveResult = <TNode, TEnv>(
  token: TextToken,
  ruleset: InterpretRuleset<TNode, TEnv>,
  helpers: InterpretHelpers<TNode, TEnv>,
): ResolvedResult<TNode> => {
  let result: InterpretResult<TNode>;
  try {
    result = ruleset.interpret(token, helpers);
  } catch (caught) {
    const error = toError(caught, "DSL token interpretation failed");
    reportError(ruleset, helpers.env, error, "interpret", token);
    throw error;
  }

  if (result.type !== "unhandled") return result;

  const strategy = ruleset.onUnhandled ?? "flatten";

  if (typeof strategy === "function") {
    try {
      return strategy(token, helpers);
    } catch (caught) {
      const error = toError(caught, String(caught));
      reportError(ruleset, helpers.env, error, "interpret", token);
      throw error;
    }
  }

  switch (strategy) {
    case "throw": {
      const error = new Error(`No handler defined for DSL token type "${token.type}"`);
      reportError(ruleset, helpers.env, error, "interpret", token);
      throw error;
    }
    case "flatten":
      return { type: "flatten" };
    case "drop":
      return { type: "drop" };
    default: {
      void (strategy satisfies never);
      const error = new Error("Unknown unhandled strategy: " + String(strategy));
      reportError(ruleset, helpers.env, error, "internal", token);
      throw error;
    }
  }
};

// ── Internal: traversal ──

const interpretIterable = function* <TNode, TEnv>(
  tokens: TextToken[],
  ruleset: InterpretRuleset<TNode, TEnv>,
  helpers: InterpretHelpers<TNode, TEnv>,
  activeTokens: WeakSet<object>,
): Generator<TNode> {
  for (const token of tokens) {
    if (token.type === "text") {
      if (typeof token.value !== "string") {
        const error = new Error("DSL text token value must be a string");
        reportError(ruleset, helpers.env, error, "traversal", token);
        throw error;
      }
      yield ruleset.createText(token.value);
      continue;
    }

    if (activeTokens.has(token)) {
      const error = new Error(`Recursive DSL token detected for type "${token.type}"`);
      reportError(ruleset, helpers.env, error, "traversal", token);
      throw error;
    }

    activeTokens.add(token);
    try {
      const result = resolveResult(token, ruleset, helpers);
      yield* iterateResolved(result, ruleset, helpers, token);
    } finally {
      activeTokens.delete(token);
    }
  }
};

// ── Public API ──

export const interpretTokens = function* <TNode, TEnv = unknown>(
  tokens: TextToken[],
  ruleset: InterpretRuleset<TNode, TEnv>,
  env: TEnv,
): Generator<TNode> {
  const activeTokens = new WeakSet<object>();

  const interpretChildren = function* (value: string | TextToken[]): Generator<TNode> {
    if (typeof value === "string") {
      yield ruleset.createText(value);
      return;
    }
    yield* interpretIterable(value, ruleset, helpers, activeTokens);
  };

  const helpers: InterpretHelpers<TNode, TEnv> = {
    interpretChildren,
    flattenText,
    env,
  };

  yield* interpretIterable(tokens, ruleset, helpers, activeTokens);
};
