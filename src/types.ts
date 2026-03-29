import type { SourceSpan, TextToken } from "yume-dsl-rich-text";

// ── Result ──

export type Awaitable<T> = T | Promise<T>;

export interface ParserLike {
  parse: (input: string) => TextToken[];
}

export type InterpretResult<TNode> =
  | { type: "nodes"; nodes: Iterable<TNode> }
  | { type: "text"; text: string }
  | { type: "flatten" }
  | { type: "unhandled" }
  | { type: "drop" };

export type ResolvedResult<TNode> = Exclude<InterpretResult<TNode>, { type: "unhandled" }>;

export type AsyncInterpretResult<TNode> =
  | { type: "nodes"; nodes: Iterable<TNode> | AsyncIterable<TNode> }
  | { type: "text"; text: string }
  | { type: "flatten" }
  | { type: "unhandled" }
  | { type: "drop" };

export type AsyncResolvedResult<TNode> = Exclude<AsyncInterpretResult<TNode>, { type: "unhandled" }>;

// ── Helpers ──

export interface InterpretHelpers<TNode, TEnv = unknown> {
  interpretChildren: (value: string | TextToken[]) => Iterable<TNode>;
  flattenText: (value: string | TextToken[]) => string;
  env: TEnv;
}

export interface AsyncInterpretHelpers<TNode, TEnv = unknown> {
  interpretChildren: (value: string | TextToken[]) => AsyncIterable<TNode>;
  flattenText: (value: string | TextToken[]) => string;
  env: TEnv;
}

// ── Strategy ──

export type UnhandledStrategy<TNode, TEnv = unknown> =
  | "throw"
  | "flatten"
  | "drop"
  | ((token: TextToken, helpers: InterpretHelpers<TNode, TEnv>) => ResolvedResult<TNode>);

export type AsyncUnhandledStrategy<TNode, TEnv = unknown> =
  | "throw"
  | "flatten"
  | "drop"
  | ((
      token: TextToken,
      helpers: AsyncInterpretHelpers<TNode, TEnv>,
    ) => Awaitable<AsyncResolvedResult<TNode>>);

// ── Ruleset ──

export interface InterpretRuleset<TNode, TEnv = unknown> {
  createText: (text: string) => TNode;
  interpret: (token: TextToken, helpers: InterpretHelpers<TNode, TEnv>) => InterpretResult<TNode>;
  onUnhandled?: UnhandledStrategy<TNode, TEnv>;
  onError?: (context: {
    error: Error;
    phase: "interpret" | "flatten" | "traversal" | "internal";
    token?: TextToken;
    position?: SourceSpan;
    env: TEnv;
  }) => void;
}

export interface AsyncInterpretRuleset<TNode, TEnv = unknown> {
  createText: (text: string) => TNode;
  interpret: (
    token: TextToken,
    helpers: AsyncInterpretHelpers<TNode, TEnv>,
  ) => Awaitable<AsyncInterpretResult<TNode>>;
  onUnhandled?: AsyncUnhandledStrategy<TNode, TEnv>;
  onError?: (context: {
    error: Error;
    phase: "interpret" | "flatten" | "traversal" | "internal";
    token?: TextToken;
    position?: SourceSpan;
    env: TEnv;
  }) => void;
}
