export {};

console.log("=== Render Core ===");
await import("./renderCore.test.ts");

console.log("=== Structural Query ===");
await import("./query.test.ts");

console.log("=== Lint ===");
await import("./lint.test.ts");
