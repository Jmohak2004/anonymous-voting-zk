import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VotePanel from "./VotePanel";

const options = ["Pizza", "Sushi"];

describe("VotePanel", () => {
  it("cast vote is disabled until an option is chosen", () => {
    render(<VotePanel options={options} hasIdentity canAct submit={vi.fn()} onDone={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByRole("button", { name: /cast vote/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Sushi"));
    expect(screen.getByRole("button", { name: /cast vote/i })).toBeEnabled();
  });

  it("shows the proving state then success", async () => {
    let finish!: () => void;
    const submit = vi.fn((_o: bigint, onStage: (s: "proving" | "sending") => void) => {
      onStage("proving");
      return new Promise<void>((res) => (finish = res));
    });
    const onDone = vi.fn();
    render(<VotePanel options={options} hasIdentity canAct submit={submit} onDone={onDone} onImport={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Sushi"));
    fireEvent.click(screen.getByRole("button", { name: /cast vote/i }));
    expect(await screen.findByText(/generating proof/i)).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith(1n, expect.any(Function));
    finish();
    expect(await screen.findByText(/vote submitted/i)).toBeInTheDocument();
    expect(onDone).toHaveBeenCalled();
  });

  it("warns that voting from the registered address links the vote to the voter", () => {
    render(<VotePanel options={options} hasIdentity canAct submit={vi.fn()} onDone={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByText(/links your vote to you/i)).toBeInTheDocument();
  });

  it("success message does not overclaim anonymity", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<VotePanel options={options} hasIdentity canAct submit={submit} onDone={vi.fn()} onImport={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Pizza"));
    fireEvent.click(screen.getByRole("button", { name: /cast vote/i }));
    expect(await screen.findByText(/vote submitted/i)).toBeInTheDocument();
    expect(screen.queryByText(/anonymously/i)).toBeNull();
  });

  it("shows an import prompt when no identity is stored in this browser", () => {
    render(<VotePanel options={options} hasIdentity={false} canAct submit={vi.fn()} onDone={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByText(/no voting identity found/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cast vote/i })).toBeNull();
  });

  it("surfaces an error from the submit step", async () => {
    const submit = vi.fn().mockRejectedValue(new Error("boom"));
    render(<VotePanel options={options} hasIdentity canAct submit={submit} onDone={vi.fn()} onImport={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Pizza"));
    fireEvent.click(screen.getByRole("button", { name: /cast vote/i }));
    await waitFor(() => expect(screen.getByText(/boom/)).toBeInTheDocument());
  });
});
