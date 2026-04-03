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
 * Iterative — no recursion, no stack overflow on deep nesting.
 * Callback returns `true` to stop immediately.
 */
const dfs = (
  nodes: StructuralNode[],
  callback: (node: StructuralNode, ctx: StructuralVisitContext) => boolean,
): boolean => {
  const stack: Array<{ nodes: StructuralNode[]; idx: number; parent: StructuralNode | null; depth: number }> = [
    { nodes, idx: 0, parent: null, depth: 0 },
  ];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.idx >= frame.nodes.length) { stack.pop(); continue; }
    const node = frame.nodes[frame.idx++];
    if (callback(node, { parent: frame.parent, depth: frame.depth, index: frame.idx - 1 })) return true;
    const groups = getChildGroups(node);
    for (let g = groups.length - 1; g >= 0; g--) {
      stack.push({ nodes: groups[g], idx: 0, parent: node, depth: frame.depth + 1 });
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
  });
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
  });
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
  });
};

// ── nodeAtOffset ──

/**
 * Find the deepest node whose source span contains the given source offset.
 *
 * Iterative — no stack overflow on deep nesting.
 * Requires nodes parsed with `trackPositions: true`.
 * Returns `undefined` if no node contains the offset or positions are absent.
 */
export const nodeAtOffset = (
  nodes: StructuralNode[],
  offset: number,
): StructuralNode | undefined => {
  let best: StructuralNode | undefined;
  const stack: StructuralNode[][] = [nodes];
  while (stack.length > 0) {
    const arr = stack.pop()!;
    for (const node of arr) {
      const pos = node.position;
      if (!pos || offset < pos.start.offset || offset >= pos.end.offset) continue;
      best = node;
      const groups = getChildGroups(node);
      for (let g = groups.length - 1; g >= 0; g--) stack.push(groups[g]);
    }
  }
  return best;
};

// ── nodePathAtOffset ──

/**
 * Return the full path from root to the deepest node whose source span
 * contains the given offset. The first element is the outermost match,
 * the last element is the deepest (same as what `nodeAtOffset` returns).
 *
 * Iterative — no stack overflow on deep nesting.
 * Requires nodes parsed with `trackPositions: true`.
 * Returns an empty array if no node contains the offset.
 */
export const nodePathAtOffset = (
  nodes: StructuralNode[],
  offset: number,
): StructuralNode[] => {
  const path: StructuralNode[] = [];
  let current: StructuralNode[] = nodes;
  outer: for (;;) {
    for (const node of current) {
      const pos = node.position;
      if (!pos || offset < pos.start.offset || offset >= pos.end.offset) continue;
      path.push(node);
      // descend into first matching child group
      const groups = getChildGroups(node);
      if (groups.length === 0) break outer;
      // for block nodes (args + children), check both
      let found = false;
      for (const group of groups) {
        for (const child of group) {
          const cp = child.position;
          if (cp && offset >= cp.start.offset && offset < cp.end.offset) {
            current = group;
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) break outer;
      continue outer;
    }
    break;
  }
  return path;
};

// ── enclosingNode ──

const isTagNode = (node: StructuralNode): node is StructuralTagNode =>
  node.type === "inline" || node.type === "raw" || node.type === "block";

/**
 * Find the deepest tag node (inline / raw / block) whose source span
 * contains the given source offset.
 *
 * Iterative — no stack overflow on deep nesting.
 * Requires nodes parsed with `trackPositions: true`.
 * Returns `undefined` if the offset is not inside any tag, or positions are absent.
 */
export const enclosingNode = (
  nodes: StructuralNode[],
  offset: number,
): StructuralTagNode | undefined => {
  let best: StructuralTagNode | undefined;
  const stack: StructuralNode[][] = [nodes];
  while (stack.length > 0) {
    const arr = stack.pop()!;
    for (const node of arr) {
      const pos = node.position;
      if (!pos || offset < pos.start.offset || offset >= pos.end.offset) continue;
      if (isTagNode(node)) best = node;
      const groups = getChildGroups(node);
      for (let g = groups.length - 1; g >= 0; g--) stack.push(groups[g]);
    }
  }
  return best;
};
