import type { PositionTracker, SourceSpan, TextToken } from "yume-dsl-rich-text";
import type { ParserLike } from "./types.ts";

/**
 * Parse a substring of a larger document identified by a `SourceSpan`.
 *
 * Slices `fullText` using `span.start.offset` / `span.end.offset`, then calls
 * `parser.parse` with `baseOffset` and optional `tracker` so that positions in
 * the resulting `TextToken[]` point back into the original document.
 *
 * @param fullText  The complete source text.
 * @param span      The region to parse — typically from a `StructuralNode.position`.
 * @param parser    A parser with `parse(input, overrides?)`.
 * @param tracker   Optional pre-built tracker from the full document
 *                  (`buildPositionTracker(fullText)`). When provided, `line`/`column`
 *                  are also correct; without it, only `offset` is shifted.
 */
export const parseSlice = (
  fullText: string,
  span: SourceSpan,
  parser: ParserLike,
  tracker?: PositionTracker,
): TextToken[] =>
  parser.parse(
    fullText.slice(span.start.offset, span.end.offset),
    {
      trackPositions: true,
      baseOffset: span.start.offset,
      tracker,
    },
  );
