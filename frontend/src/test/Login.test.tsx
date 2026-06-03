import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const login = vi.fn().mockResolvedValue(undefined);
const register = vi.fn().mockResolvedValue(undefined);

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ login, register, user: null, loading: false, logout: vi.fn(), refreshUser: vi.fn() }),
}));

import { Login } from "../pages/Login";
import { ThemeProvider } from "../context/ThemeContext";

const renderLogin = () =>
  render(
    <ThemeProvider>
      <Login />
    </ThemeProvider>,
  );

describe("Login", () => {
  it("logs in with entered credentials", async () => {
    renderLogin();
    await userEvent.type(screen.getByLabelText("Username"), "alice");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    const submit = screen
      .getAllByRole("button", { name: "Sign in" })
      .find((b) => b.getAttribute("type") === "submit")!;
    await userEvent.click(submit);
    expect(login).toHaveBeenCalledWith("alice", "secret123");
  });

  it("prefills the demo account", async () => {
    renderLogin();
    await userEvent.click(screen.getByText(/Use the demo account/i));
    expect(screen.getByLabelText("Username")).toHaveValue("demo");
    expect(screen.getByLabelText("Password")).toHaveValue("demo1234");
  });
});
