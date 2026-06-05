import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataFormModal } from "../components/DataFormModal";

describe("DataFormModal", () => {
  // Regression: the field components used to be defined *inside* the modal, so
  // every keystroke created a new component type and React remounted the input,
  // stealing focus after a single character. Typing a full word must work and
  // the input must keep focus throughout.
  it("keeps focus while typing across multiple characters", async () => {
    render(
      <DataFormModal
        open
        entity="customers"
        mode="create"
        customers={[]}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    const name = screen.getAllByRole("textbox")[0] as HTMLInputElement;
    name.focus();
    await userEvent.type(name, "Acme Pty Ltd");
    expect(name).toHaveValue("Acme Pty Ltd");
    expect(document.activeElement).toBe(name);
  });

  it("seeds the form from an existing record in edit mode", () => {
    render(
      <DataFormModal
        open
        entity="customers"
        mode="edit"
        record={{
          id: "CUST-1001",
          name: "Brookside Cafe",
          contact: "Jo",
          email: "jo@brookside.test",
          phone: "0400000000",
          site_address: "1 High St",
        }}
        customers={[]}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    expect(screen.getByDisplayValue("Brookside Cafe")).toBeInTheDocument();
    expect(screen.getByText("Edit customer")).toBeInTheDocument();
    // Delete action is available in edit mode only.
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });
});
