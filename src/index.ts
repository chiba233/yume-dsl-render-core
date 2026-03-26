import type { TextToken } from "yume-dsl-rich-text";

export type RenderResult<TNode> =
  | { type: "tokens"; tokens: Iterable<TNode> }
  | { type: "text"; text?: string }
  | { type: "defer" }
  | { type: "empty" };

export interface RenderHelpers<TNode, TEnv = unknown> {
  renderChildren: (value: string | TextToken[]) => Iterable<TNode>;
  flattenText: (value: string | TextToken[]) => string;
  env: TEnv;
}

export interface TokenRenderer<TNode, TEnv = unknown> {
  createText: (text: string) => TNode;
  render: (token: TextToken, helpers: RenderHelpers<TNode, TEnv>) => RenderResult<TNode>;
  fallbackRender?: (token: TextToken, helpers: RenderHelpers<TNode, TEnv>) => RenderResult<TNode>;
  strict?: boolean;
}

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

type ResolvedRenderResult<TNode> = Exclude<RenderResult<TNode>, { type: "defer" }>;

const iterateRendered = function* <TNode>(
  result: ResolvedRenderResult<TNode>,
  createText: (text: string) => TNode,
  token: TextToken,
): Generator<TNode> {
  switch (result.type) {
    case "tokens":
      yield* result.tokens;
      return;
    case "text": {
      const text = result.text ?? flattenText(token.value);
      yield createText(text);
      return;
    }
    case "empty":
      return;
    default: {
      const _exhaustive: never = result;
      throw new Error(
        `Unexpected render result type: ${(_exhaustive as ResolvedRenderResult<TNode>).type}`,
      );
    }
  }
};

const resolveRenderResult = <TNode, TEnv>(
  token: TextToken,
  renderer: TokenRenderer<TNode, TEnv>,
  helpers: RenderHelpers<TNode, TEnv>,
): ResolvedRenderResult<TNode> => {
  const result = renderer.render(token, helpers);
  if (result.type !== "defer") return result;

  if (renderer.fallbackRender) {
    const fallbackResult = renderer.fallbackRender(token, helpers);
    if (fallbackResult.type !== "defer") {
      return fallbackResult;
    }
  }

  if (renderer.strict ?? false) {
    throw new Error(`No renderer defined for DSL token type "${token.type}"`);
  }

  return { type: "text" };
};

const renderTokenIterable = function* <TNode, TEnv>(
  tokens: TextToken[],
  renderer: TokenRenderer<TNode, TEnv>,
  helpers: RenderHelpers<TNode, TEnv>,
  activeTokens: WeakSet<object>,
): Generator<TNode> {
  for (const token of tokens) {
    if (token.type === "text") {
      if (typeof token.value !== "string") {
        throw new Error("DSL text token value must be a string");
      }
      yield renderer.createText(token.value);
      continue;
    }

    if (activeTokens.has(token)) {
      throw new Error(`Recursive DSL token rendering detected for type "${token.type}"`);
    }

    activeTokens.add(token);
    try {
      const result = resolveRenderResult(token, renderer, helpers);
      yield* iterateRendered(result, renderer.createText, token);
    } finally {
      activeTokens.delete(token);
    }
  }
};

export const renderTokens = function* <TNode, TEnv = unknown>(
  tokens: TextToken[],
  renderer: TokenRenderer<TNode, TEnv>,
  env: TEnv,
): Generator<TNode> {
  const activeTokens = new WeakSet<object>();

  const renderChildren = function* (value: string | TextToken[]): Generator<TNode> {
    if (typeof value === "string") {
      yield renderer.createText(value);
      return;
    }

    yield* renderTokenIterable(value, renderer, helpers, activeTokens);
  };

  const helpers: RenderHelpers<TNode, TEnv> = {
    renderChildren,
    flattenText,
    env,
  };

  yield* renderTokenIterable(tokens, renderer, helpers, activeTokens);
};

export const collectRendered = <TNode>(iterable: Iterable<TNode>): TNode[] => Array.from(iterable);
