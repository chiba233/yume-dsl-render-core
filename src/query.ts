import type { StructuralNode } from "yume-dsl-rich-text";

export interface StructuralVisitContext {
  parent: StructuralNode | null;
  depth: number;
  index: number;
}

export type StructuralPredicate = (
  node: StructuralNode,
  ctx: StructuralVisitContext,
) => boolean;

export type StructuralVisitor = (
  node: StructuralNode,
  ctx: StructuralVisitContext,
) => void;

/**
 * A `StructuralNode` whose type is one of the tag forms: inline, raw, or block.
 */
export type StructuralTagNode = Extract<StructuralNode, { type: "inline" | "raw" | "block" }>;

// ── Internal helpers ──

const getChildGroups = (node: StructuralNode): StructuralNode[][] => {
  switch (node.type) {
    case "text":
    case "escape":
    case "separator":
      return [];
    case "inline":
      return [node.children];
    case "raw":
      return [node.args];
    case "block":
      return [node.args, node.children];
  }
};

/**
 * Core DFS engine. Pre-order traversal with early-exit support.
 * Callback returns `true` to stop immediately (propagated up the stack).
 */
const dfs = (
  nodes: StructuralNode[],
  callback: (node: StructuralNode, ctx: StructuralVisitContext) => boolean,
  parent: StructuralNode | null,
  depth: number,
): boolean => {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (callback(node, { parent, depth, index: i })) return true;
    for (const group of getChildGroups(node)) {
      if (dfs(group, callback, node, depth + 1)) return true;
    }
  }
  return false;
};

// ── findFirst ──

/**
 * Depth-first pre-order search. Returns the first node matching the predicate, or `undefined`.
 */
export const findFirst = (
  nodes: StructuralNode[],
  predicate: StructuralPredicate,
): StructuralNode | undefined => {
  let result: StructuralNode | undefined;
  dfs(nodes, (node, ctx) => {
    if (predicate(node, ctx)) {
      result = node;
      return true;
    }
    return false;
  }, null, 0);
  return result;
};

// ── findAll ──

/**
 * Depth-first pre-order search. Returns all nodes matching the predicate.
 */
export const findAll = (
  nodes: StructuralNode[],
  predicate: StructuralPredicate,
): StructuralNode[] => {
  const result: StructuralNode[] = [];
  dfs(nodes, (node, ctx) => {
    if (predicate(node, ctx)) result.push(node);
    return false;
  }, null, 0);
  return result;
};

// ── walkStructural ──

/**
 * Depth-first pre-order traversal. Calls `visitor` for every node.
 *
 * Unlike `findFirst`/`findAll`, this is a pure side-effect visitor —
 * it does not collect or return anything. Use it when your logic
 * needs to inspect every node with full context (parent, depth, index).
 */
export const walkStructural = (
  nodes: StructuralNode[],
  visitor: StructuralVisitor,
): void => {
  dfs(nodes, (node, ctx) => {
    visitor(node, ctx);
    return false;
  }, null, 0);
};

// ── nodeAtOffset ──

const walkAtOffset = (
  nodes: StructuralNode[],
  offset: number,
  best: StructuralNode | undefined,
): StructuralNode | undefined => {
  for (const node of nodes) {
    const pos = node.position;
    if (!pos) continue;
    if (offset < pos.start.offset || offset >= pos.end.offset) continue;
    best = node;
    for (const group of getChildGroups(node)) {
      best = walkAtOffset(group, offset, best);
    }
  }
  return best;
};

/**
 * Find the deepest node whose source span contains the given source offset.
 *
 * The offset must be a string index into the **original source text** that was
 * passed to `parseStructural` — not an offset into rendered, printed, or
 * display text.
 *
 * Requires nodes parsed with `trackPositions: true`.
 * Returns `undefined` if no node contains the offset or positions are absent.
 */
export const nodeAtOffset = (
  nodes: StructuralNode[],
  offset: number,
): StructuralNode | undefined => walkAtOffset(nodes, offset, undefined);

// ── enclosingNode ──

const isTagNode = (node: StructuralNode): node is StructuralTagNode =>
  node.type === "inline" || node.type === "raw" || node.type === "block";

const walkEnclosing = (
  nodes: StructuralNode[],
  offset: number,
  best: StructuralTagNode | undefined,
): StructuralTagNode | undefined => {
  for (const node of nodes) {
    const pos = node.position;
    if (!pos) continue;
    if (offset < pos.start.offset || offset >= pos.end.offset) continue;
    if (isTagNode(node)) best = node;
    for (const group of getChildGroups(node)) {
      best = walkEnclosing(group, offset, best);
    }
  }
  return best;
};

/**
 * Find the deepest tag node (inline / raw / block) whose source span
 * contains the given source offset.
 *
 * Unlike {@link nodeAtOffset}, this skips text, escape, and separator nodes —
 * it returns only structurally meaningful "enclosing" tag nodes.
 *
 * The offset must be a string index into the **original source text** that was
 * passed to `parseStructural` — not an offset into rendered, printed, or
 * display text.
 *
 * Requires nodes parsed with `trackPositions: true`.
 * Returns `undefined` if the offset is not inside any tag, or positions are absent.
 */
export const enclosingNode = (
  nodes: StructuralNode[],
  offset: number,
): StructuralTagNode | undefined => walkEnclosing(nodes, offset, undefined);
