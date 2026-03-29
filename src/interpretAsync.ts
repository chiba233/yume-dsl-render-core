import type { TextToken } from "yume-dsl-rich-text";
import { flattenText } from "./interpret.ts";
import { reportError, toError } from "./internalErrors.ts";
import type {
  AsyncInterpretHelpers,
  AsyncInterpretResult,
  AsyncInterpretRuleset,
  AsyncResolvedResult,
  ParserLike,
} from "./types.ts";

type MaybeAsyncIterable = {
  [Symbol.asyncIterator]?: unknown;
};

const isAsyncIterable = <TNode>(value: Iterable<TNode> | AsyncIterable<TNode>): value is AsyncIterable<TNode> =>
  typeof (value as MaybeAsyncIterable)[Symbol.asyncIterator] === "function";

const iterateNodes = async function* <TNode>(
  nodes: Iterable<TNode> | AsyncIterable<TNode>,
): AsyncGenerator<TNode> {
  if (isAsyncIterable(nodes)) {
    yield* nodes;
    return;
  }

  yield* nodes;
};

const iterateResolved = async function* <TNode, TEnv>(
  result: AsyncResolvedResult<TNode>,
  ruleset: AsyncInterpretRuleset<TNode, TEnv>,
  helpers: AsyncInterpretHelpers<TNode, TEnv>,
  token: TextToken,
): AsyncGenerator<TNode> {
  switch (result.type) {
    case "nodes":
      yield* iterateNodes(result.nodes);
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

const resolveResult = async <TNode, TEnv>(
  token: TextToken,
  ruleset: AsyncInterpretRuleset<TNode, TEnv>,
  helpers: AsyncInterpretHelpers<TNode, TEnv>,
): Promise<AsyncResolvedResult<TNode>> => {
  let result: AsyncInterpretResult<TNode>;
  try {
    result = await ruleset.interpret(token, helpers);
  } catch (caught) {
    const error = toError(caught, "DSL token interpretation failed");
    reportError(ruleset.onError, helpers.env, error, "interpret", token);
    throw error;
  }

  if (result.type !== "unhandled") return result;

  const strategy = ruleset.onUnhandled ?? "flatten";

  if (typeof strategy === "function") {
    try {
      return await strategy(token, helpers);
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

const interpretIterableAsync = async function* <TNode, TEnv>(
  tokens: TextToken[],
  ruleset: AsyncInterpretRuleset<TNode, TEnv>,
  helpers: AsyncInterpretHelpers<TNode, TEnv>,
  activeTokens: WeakSet<TextToken>,
): AsyncGenerator<TNode> {
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
      const result = await resolveResult(token, ruleset, helpers);
      yield* iterateResolved(result, ruleset, helpers, token);
    } finally {
      activeTokens.delete(token);
    }
  }
};

export const interpretTokensAsync = async function* <TNode, TEnv = unknown>(
  tokens: TextToken[],
  ruleset: AsyncInterpretRuleset<TNode, TEnv>,
  env: TEnv,
): AsyncGenerator<TNode> {
  const activeTokens = new WeakSet<TextToken>();

  const interpretChildren = async function* (value: string | TextToken[]): AsyncGenerator<TNode> {
    if (typeof value === "string") {
      yield ruleset.createText(value);
      return;
    }

    yield* interpretIterableAsync(value, ruleset, helpers, activeTokens);
  };

  const helpers: AsyncInterpretHelpers<TNode, TEnv> = {
    interpretChildren,
    flattenText,
    env,
  };

  yield* interpretIterableAsync(tokens, ruleset, helpers, activeTokens);
};

export const interpretTextAsync = async function* <TNode, TEnv = unknown>(
  input: string,
  parser: ParserLike,
  ruleset: AsyncInterpretRuleset<TNode, TEnv>,
  env: TEnv,
): AsyncGenerator<TNode> {
  yield* interpretTokensAsync(parser.parse(input), ruleset, env);
};
