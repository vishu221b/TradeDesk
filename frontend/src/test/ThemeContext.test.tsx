import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "../context/ThemeContext";

function Probe() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} data-testid="t">
      {theme}
    </button>
  );
}

describe("ThemeContext", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("defaults to light and toggles to dark, updating the root class", async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    const btn = screen.getByTestId("t");
    expect(btn).toHaveTextContent("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await userEvent.click(btn);

    expect(btn).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("tradedesk_theme")).toBe("dark");
  });
});
