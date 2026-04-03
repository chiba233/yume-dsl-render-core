import type {
  InterpretHelpers,
  InterpretResult,
  InterpretRuleset,
  ParserLike,
  ResolvedResult,
} from "./types.ts";
import type { TextToken } from "yume-dsl-rich-text";
import { reportError, toError } from "./internalErrors.ts";

// ── Companion utility: flattenText ──

// 迭代式 flatten：显式栈替代递归，任意嵌套深度不爆栈。
// 循环引用检测保持不变（seenValues / seenTokens）。
export const flattenText = (value: string | TextToken[]): string => {
  if (typeof value === "string") return value;

  const parts: string[] = [];
  const seenValues = new WeakSet<TextToken[]>();
  const seenTokens = new WeakSet<TextToken>();
  const stack: Array<{ arr: TextToken[]; idx: number }> = [];

  if (seenValues.has(value)) throw new Error("Circular DSL token value detected while flattening text");
  seenValues.add(value);
  stack.push({ arr: value, idx: 0 });

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.idx >= frame.arr.length) {
      stack.pop();
      continue;
    }

    const token = frame.arr[frame.idx++];
    if (seenTokens.has(token)) {
      throw new Error(`Circular DSL token detected while flattening text for type "${token.type}"`);
    }

    if (typeof token.value === "string") {
      parts.push(token.value);
      continue;
    }

    if (seenValues.has(token.value)) throw new Error("Circular DSL token value detected while flattening text");
    seenValues.add(token.value);
    seenTokens.add(token);
    stack.push({ arr: token.value, idx: 0 });
  }

  return parts.join("");
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
        reportError(ruleset.onError, helpers.env, error, "flatten", token);
        throw error;
      }
      return;
    case "drop":
      return;
    default: {
      void (result satisfies never);
      const error = new Error("Unexpected interpret result type: " + String(result));
      reportError(ruleset.onError, helpers.env, error, "internal", token);
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
    reportError(ruleset.onError, helpers.env, error, "interpret", token);
    throw error;
  }

  if (result.type !== "unhandled") return result;

  const strategy = ruleset.onUnhandled ?? "flatten";

  if (typeof strategy === "function") {
    try {
      return strategy(token, helpers);
    } catch (caught) {
      const error = toError(caught, String(caught));
      reportError(ruleset.onError, helpers.env, error, "interpret", token);
      throw error;
    }
  }

  switch (strategy) {
    case "throw": {
      const error = new Error(`No handler defined for DSL token type "${token.type}"`);
      reportError(ruleset.onError, helpers.env, error, "interpret", token);
      throw error;
    }
    case "flatten":
      return { type: "flatten" };
    case "drop":
      return { type: "drop" };
    default: {
      void (strategy satisfies never);
      const error = new Error("Unknown unhandled strategy: " + String(strategy));
      reportError(ruleset.onError, helpers.env, error, "internal", token);
      throw error;
    }
  }
};

// ── Internal: traversal ──

const interpretIterable = function* <TNode, TEnv>(
  tokens: TextToken[],
  ruleset: InterpretRuleset<TNode, TEnv>,
  helpers: InterpretHelpers<TNode, TEnv>,
  activeTokens: WeakSet<TextToken>,
): Generator<TNode> {
  for (const token of tokens) {
    if (token.type === "text") {
      if (typeof token.value !== "string") {
        const error = new Error("DSL text token value must be a string");
        reportError(ruleset.onError, helpers.env, error, "traversal", token);
        throw error;
      }
      yield ruleset.createText(token.value);
      continue;
    }

    if (activeTokens.has(token)) {
      const error = new Error(`Recursive DSL token detected for type "${token.type}"`);
      reportError(ruleset.onError, helpers.env, error, "traversal", token);
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
  const activeTokens = new WeakSet<TextToken>();

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

export const interpretText = function* <TNode, TEnv = unknown>(
  input: string,
  parser: ParserLike,
  ruleset: InterpretRuleset<TNode, TEnv>,
  env: TEnv,
): Generator<TNode> {
  yield* interpretTokens(parser.parse(input), ruleset, env);
};
