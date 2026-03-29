import assert from "node:assert/strict";
import {
  buildPositionTracker,
  createParser,
  createSimpleInlineHandlers,
  parseRichText,
  type TextToken,
} from "yume-dsl-rich-text";
import {
  collectNodesAsync,
  type AsyncInterpretRuleset,
  type InterpretRuleset,
  interpretText,
  interpretTextAsync,
  interpretTokens,
  interpretTokensAsync,
  parseSlice,
} from "../src/index.ts";

interface TestCase {
  name: string;
  run: () => void | Promise<void>;
}

const handlers = {
  ...createSimpleInlineHandlers(["bold", "italic"]),
};

const parse = (text: string) => parseRichText(text, { handlers });
const parser = createParser({ handlers });

const htmlRuleset: InterpretRuleset<string, { tone?: string }> = {
  createText: (text) => text,
  interpret: (token, helpers) => {
    if (token.type === "bold") {
      return {
        type: "nodes",
        nodes: [
          `<strong data-tone="${helpers.env.tone ?? "none"}">`,
          ...helpers.interpretChildren(token.value),
          "</strong>",
        ],
      };
    }

    if (token.type === "italic") {
      return {
        type: "nodes",
        nodes: ["<em>", ...helpers.interpretChildren(token.value), "</em>"],
      };
    }

    return { type: "unhandled" };
  },
};

const asyncHtmlRuleset: AsyncInterpretRuleset<string, { tone?: string }> = {
  createText: (text) => text,
  interpret: async (token, helpers) => {
    if (token.type === "bold") {
      return {
        type: "nodes",
        nodes: (async function* (): AsyncGenerator<string> {
          yield `<strong data-tone="${helpers.env.tone ?? "none"}">`;
          yield* helpers.interpretChildren(token.value);
          yield "</strong>";
        })(),
      };
    }

    if (token.type === "italic") {
      return {
        type: "nodes",
        nodes: (async function* (): AsyncGenerator<string> {
          yield "<em>";
          yield* helpers.interpretChildren(token.value);
          yield "</em>";
        })(),
      };
    }

    return { type: "unhandled" };
  },
};

const cases: TestCase[] = [
  {
    name: "interpretTokens -> should interpret nested token tree lazily",
    run: () => {
      const result = Array.from(
        interpretTokens(parse("$$bold(a $$italic(b)$$ c)$$"), htmlRuleset, { tone: "soft" }),
      );
      assert.equal(result.join(""), '<strong data-tone="soft">a <em>b</em> c</strong>');
    },
  },
  {
    name: "interpretText -> should parse then interpret with the provided parser",
    run: () => {
      const result = Array.from(
        interpretText("$$bold(a $$italic(b)$$ c)$$", parser, htmlRuleset, { tone: "soft" }),
      );
      assert.equal(result.join(""), '<strong data-tone="soft">a <em>b</em> c</strong>');
    },
  },
  {
    name: "interpretTokensAsync -> should interpret nested token tree with async handlers",
    run: async () => {
      const result = await collectNodesAsync(
        interpretTokensAsync(parse("$$bold(a $$italic(b)$$ c)$$"), asyncHtmlRuleset, { tone: "soft" }),
      );
      assert.equal(result.join(""), '<strong data-tone="soft">a <em>b</em> c</strong>');
    },
  },
  {
    name: "interpretTextAsync -> should parse then interpret with the provided parser",
    run: async () => {
      const result = await collectNodesAsync(
        interpretTextAsync("$$bold(a $$italic(b)$$ c)$$", parser, asyncHtmlRuleset, { tone: "soft" }),
      );
      assert.equal(result.join(""), '<strong data-tone="soft">a <em>b</em> c</strong>');
    },
  },
  {
    name: "parseSlice -> should shift offset without tracker and keep local line/column",
    run: () => {
      const fullText = "hello\n$$bold(world)$$\nnext";
      const start = 6;
      const end = 21;
      const tokens = parseSlice(
        fullText,
        {
          start: { offset: start, line: 2, column: 1 },
          end: { offset: end, line: 2, column: 16 },
        },
        parser,
      );

      assert.equal(tokens.length, 1);
      assert.equal(tokens[0].type, "bold");
      assert.deepEqual(tokens[0].position, {
        start: { offset: start, line: 1, column: 1 },
        end: { offset: end, line: 1, column: 16 },
      });
    },
  },
  {
    name: "parseSlice -> should map offset and line/column with tracker",
    run: () => {
      const fullText = "hello\n$$bold(world)$$\nnext";
      const start = 6;
      const end = 21;
      const tracker = buildPositionTracker(fullText);
      const tokens = parseSlice(
        fullText,
        {
          start: { offset: start, line: 2, column: 1 },
          end: { offset: end, line: 2, column: 16 },
        },
        parser,
        tracker,
      );

      assert.equal(tokens.length, 1);
      assert.equal(tokens[0].type, "bold");
      assert.deepEqual(tokens[0].position, {
        start: { offset: start, line: 2, column: 1 },
        end: { offset: end, line: 2, column: 16 },
      });
    },
  },
  {
    name: "interpretTokensAsync -> should support async interpret during flatten fallback",
    run: async () => {
      const result = await collectNodesAsync(
        interpretTokensAsync(
          parse("$$bold(hello)$$"),
          {
            createText: (text) => `[${text}]`,
            interpret: async () => ({ type: "unhandled" }),
          },
          undefined,
        ),
      );
      assert.equal(result.join(""), "[hello]");
    },
  },
  {
    name: "interpretTokensAsync -> should support async onUnhandled strategy",
    run: async () => {
      const result = await collectNodesAsync(
        interpretTokensAsync(
          parse("$$bold(hello)$$"),
          {
            createText: (text) => text,
            interpret: async () => ({ type: "unhandled" }),
            onUnhandled: async (token) => ({ type: "text", text: `[async:${token.type}]` }),
          },
          undefined,
        ),
      );
      assert.equal(result.join(""), "[async:bold]");
    },
  },
  {
    name: "interpretTokensAsync -> should accept sync iterables in nodes results",
    run: async () => {
      const result = await collectNodesAsync(
        interpretTokensAsync(
          parse("$$bold(hello)$$"),
          {
            createText: (text) => text,
            interpret: async () => ({ type: "nodes", nodes: ["<b>", "ok", "</b>"] }),
          },
          undefined,
        ),
      );
      assert.equal(result.join(""), "<b>ok</b>");
    },
  },
  {
    name: "interpretTokensAsync -> should prefer async iterator when both sync and async are present",
    run: async () => {
      const dualModeNodes: Iterable<string> & AsyncIterable<string> = {
        *[Symbol.iterator]() {
          yield "sync";
        },
        async *[Symbol.asyncIterator]() {
          yield "async";
        },
      };

      const result = await collectNodesAsync(
        interpretTokensAsync(
          parse("$$bold(hello)$$"),
          {
            createText: (text) => text,
            interpret: async () => ({ type: "nodes", nodes: dualModeNodes }),
          },
          undefined,
        ),
      );
      assert.equal(result.join(""), "async");
    },
  },
  {
    name: "unhandled default -> should fall back to flatten",
    run: () => {
      const result = Array.from(
        interpretTokens(
          parse("$$bold(hello)$$"),
          {
            createText: (text) => text,
            interpret: () => ({ type: "unhandled" }),
          },
          undefined,
        ),
      );
      assert.equal(result.join(""), "hello");
    },
  },
  {
    name: "onUnhandled throw -> should throw",
    run: () => {
      assert.throws(
        () =>
          Array.from(
            interpretTokens(
              parse("$$bold(hello)$$"),
              {
                createText: (text) => text,
                interpret: () => ({ type: "unhandled" }),
                onUnhandled: "throw",
              },
              undefined,
            ),
          ),
        /No handler defined for DSL token type "bold"/,
      );
    },
  },
  {
    name: "onUnhandled drop -> should emit nothing",
    run: () => {
      const result = Array.from(
        interpretTokens(
          parse("$$bold(hello)$$"),
          {
            createText: (text) => text,
            interpret: () => ({ type: "unhandled" }),
            onUnhandled: "drop",
          },
          undefined,
        ),
      );
      assert.equal(result.join(""), "");
    },
  },
  {
    name: "onUnhandled function -> should use custom strategy",
    run: () => {
      const result = Array.from(
        interpretTokens(
          parse("$$bold(hello)$$"),
          {
            createText: (text) => text,
            interpret: () => ({ type: "unhandled" }),
            onUnhandled: (token) => ({ type: "text", text: `[${token.type}]` }),
          },
          undefined,
        ),
      );
      assert.equal(result.join(""), "[bold]");
    },
  },
  {
    name: "onError -> should observe unhandled throw strategy before throwing",
    run: () => {
      let seen:
        | {
            message: string;
            phase: string;
            tokenType?: string;
            envMode?: string;
          }
        | undefined;

      assert.throws(
        () =>
          Array.from(
            interpretTokens(
              parse("$$bold(hello)$$"),
              {
                createText: (text) => text,
                interpret: () => ({ type: "unhandled" }),
                onUnhandled: "throw",
                onError: (context) => {
                  seen = {
                    message: context.error.message,
                    phase: context.phase,
                    tokenType: context.token?.type,
                    envMode: context.env.mode,
                  };
                },
              },
              { mode: "observe" },
            ),
          ),
        /No handler defined for DSL token type "bold"/,
      );

      assert.deepEqual(seen, {
        message: 'No handler defined for DSL token type "bold"',
        phase: "interpret",
        tokenType: "bold",
        envMode: "observe",
      });
    },
  },
  {
    name: "self recursion -> should throw",
    run: () => {
      assert.throws(
        () =>
          Array.from(
            interpretTokens(
              parse("$$bold(hello)$$"),
              {
                createText: (text) => text,
                interpret: (token, helpers) => {
                  if (token.type !== "bold") return { type: "flatten" };
                  return { type: "nodes", nodes: helpers.interpretChildren([token]) };
                },
                onUnhandled: "throw",
              },
              undefined,
            ),
          ),
        /Recursive DSL token detected/,
      );
    },
  },
  {
    name: "onError -> should observe recursive token before throwing",
    run: () => {
      let seen:
        | {
            message: string;
            phase: string;
            tokenType?: string;
          }
        | undefined;

      assert.throws(
        () =>
          Array.from(
            interpretTokens(
              parse("$$bold(hello)$$"),
              {
                createText: (text) => text,
                interpret: (token, helpers) => {
                  if (token.type !== "bold") return { type: "flatten" };
                  return { type: "nodes", nodes: helpers.interpretChildren([token]) };
                },
                onUnhandled: "throw",
                onError: (context) => {
                  seen = {
                    message: context.error.message,
                    phase: context.phase,
                    tokenType: context.token?.type,
                  };
                },
              },
              undefined,
            ),
          ),
        /Recursive DSL token detected/,
      );

      assert.deepEqual(seen, {
        message: 'Recursive DSL token detected for type "bold"',
        phase: "traversal",
        tokenType: "bold",
      });
    },
  },
  {
    name: "circular value -> should throw",
    run: () => {
      const loop: TextToken = { type: "loop", id: "x", value: [] };
      const value = loop.value as TextToken[];
      value.push(loop);

      assert.throws(
        () =>
          Array.from(
            interpretTokens(
              [loop],
              {
                createText: (text) => text,
                interpret: () => ({ type: "flatten" }),
              },
              undefined,
            ),
          ),
        /Circular DSL token/,
      );
    },
  },
  {
    name: "onError -> should observe invalid text token before throwing",
    run: () => {
      const badText = {
        type: "text",
        id: "bad",
        value: [] as TextToken[],
      } as unknown as TextToken;

      let seen:
        | {
            message: string;
            phase: string;
            tokenType?: string;
          }
        | undefined;

      assert.throws(
        () =>
          Array.from(
            interpretTokens(
              [badText],
              {
                createText: (text) => text,
                interpret: () => ({ type: "drop" }),
                onError: (context) => {
                  seen = {
                    message: context.error.message,
                    phase: context.phase,
                    tokenType: context.token?.type,
                  };
                },
              },
              undefined,
            ),
          ),
        /DSL text token value must be a string/,
      );

      assert.deepEqual(seen, {
        message: "DSL text token value must be a string",
        phase: "traversal",
        tokenType: "text",
      });
    },
  },
];

let passed = 0;
let failed = 0;

for (const testCase of cases) {
  try {
    await testCase.run();
    console.log(`PASS ${testCase.name}`);
    passed++;
  } catch (error) {
    console.error(`FAIL ${testCase.name}`);
    console.error(error);
    failed++;
  }
}

console.log(`PASS ${passed} 个 interpret core case`);
if (failed > 0) {
  console.error(`FAIL ${failed} 个 case`);
  process.exit(1);
}
