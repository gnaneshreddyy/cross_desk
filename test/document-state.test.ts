import { describe, expect, it } from "vitest";
import { contentFromYjsState, encodeStateFromContent } from "../src/modules/documents/document-state.js";

describe("document state helpers", () => {
  it("round-trips plain code content through a Yjs update", () => {
    const content = "const answer = 42;\nconsole.log(answer);\n";

    const encoded = encodeStateFromContent(content);
    const decoded = contentFromYjsState(encoded);

    expect(decoded).toBe(content);
  });
});
