import { describe, it, expect } from "vitest";

describe("project setup", () => {
  it("should pass basic sanity check", () => {
    expect(true).toBe(true);
  });

  it("should have Node available", () => {
    expect(typeof process.versions.node).toBe("string");
    expect(process.versions.node.length).toBeGreaterThan(0);
  });
});
