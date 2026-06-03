import { describe, expect, it } from "vitest";
import { AxiosError } from "axios";
import { apiError } from "../api/client";

describe("apiError", () => {
  it("extracts a string detail from an axios error", () => {
    const err = new AxiosError("boom");
    err.response = { data: { detail: "No key for anthropic" } } as never;
    expect(apiError(err)).toBe("No key for anthropic");
  });

  it("extracts the first message from a validation-style detail array", () => {
    const err = new AxiosError("boom");
    err.response = { data: { detail: [{ msg: "field required" }] } } as never;
    expect(apiError(err)).toBe("field required");
  });

  it("falls back for non-axios errors", () => {
    expect(apiError(new Error("x"), "fallback")).toBe("fallback");
  });
});
