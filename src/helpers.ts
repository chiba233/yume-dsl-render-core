import type { TextToken } from "yume-dsl-rich-text";
import type {
  InterpretHelpers,
  InterpretResult,
  InterpretRuleset,
  ResolvedResult,
} from "./types.ts";

export const createRuleset = <TNode, TEnv = unknown>(
  ruleset: InterpretRuleset<TNode, TEnv>,
): InterpretRuleset<TNode, TEnv> => ruleset;

export const debugUnhandled = <TNode = unknown>(
  format: (token: TextToken) => string = (token) => `[unhandled:${token.type}]`,
): ((token: TextToken) => ResolvedResult<TNode>) => {
  return (token: TextToken): ResolvedResult<TNode> => ({
    type: "text",
    text: format(token),
  });
};

export const collectNodes = <TNode>(iterable: Iterable<TNode>): TNode[] => Array.from(iterable);

export const fromHandlerMap = <TNode, TEnv = unknown>(
  handlers: Record<
    string,
    (token: TextToken, helpers: InterpretHelpers<TNode, TEnv>) => ResolvedResult<TNode>
  >,
): ((token: TextToken, helpers: InterpretHelpers<TNode, TEnv>) => InterpretResult<TNode>) => {
  return (token, helpers) => {
    const handler = handlers[token.type];
    if (handler) return handler(token, helpers);
    return { type: "unhandled" };
  };
};
