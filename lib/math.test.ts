import { describe, expect, test } from "bun:test";
import { add } from "./math";

describe("add", () => {
  test("1 + 1 equals 2", () => {
    expect(add(1, 1)).toBe(2);
  });
});
