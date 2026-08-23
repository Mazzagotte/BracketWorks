import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../lib/api";
import ChangelogModal from "./ChangelogModal";

vi.mock("../lib/api", () => ({ apiClient: { get: vi.fn() } }));

describe("ChangelogModal", () => {
  beforeEach(() => vi.mocked(apiClient.get).mockReset());

  it("renders legacy bullet-only entries", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ entries: [{ version: "1.0", date: "2026-08-01", changes: ["Legacy fix"] }] });
    render(<ChangelogModal isOpen />);
    expect(await screen.findByText("Legacy fix")).toBeInTheDocument();
  });

  it("renders structured entries and tags", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ entries: [{ version: "2.0", date: "2026-08-23", changes: [], title: "Major update", summary: "A focused release.", sections: [{ heading: "Recovery", items: ["Added restore points."] }], tags: ["Reliability"] }] });
    render(<ChangelogModal isOpen />);
    expect(await screen.findByRole("heading", { name: "Major update" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recovery" })).toBeInTheDocument();
    expect(screen.getByText("Added restore points.")).toBeInTheDocument();
    expect(screen.getByText("Reliability")).toBeInTheDocument();
  });

  it("renders markup-looking content as escaped text", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ entries: [{ version: "3.0", date: "2026-08-23", changes: ["<script>alert(1)</script>"] }] });
    const { container } = render(<ChangelogModal isOpen />);
    expect(await screen.findByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });
});
