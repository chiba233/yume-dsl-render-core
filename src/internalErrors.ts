import type { TextToken } from "yume-dsl-rich-text";

type ErrorPhase = "interpret" | "flatten" | "traversal" | "internal";

type ErrorReporter<TEnv> = (context: {
  error: Error;
  phase: ErrorPhase;
  token?: TextToken;
  position?: TextToken["position"];
  env: TEnv;
}) => void;

export const toError = (value: unknown, fallback: string): Error =>
  value instanceof Error ? value : new Error(fallback);

export const reportError = <TEnv>(
  onError: ErrorReporter<TEnv> | undefined,
  env: TEnv,
  error: Error,
  phase: ErrorPhase,
  token?: TextToken,
): void => {
  onError?.({ error, phase, token, position: token?.position, env });
};
