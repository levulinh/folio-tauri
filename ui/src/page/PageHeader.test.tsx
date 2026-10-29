import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PageMeta } from "../backend/generated/PageMeta";

const openPage = vi.fn();
vi.mock("../state/pageActions", () => ({ openPage: (id: string) => openPage(id) }));

import { usePagesStore } from "../state/pagesStore";
import { PageHeader } from "./PageHeader";

const page = (id: string, title: string, parentId: string | null): PageMeta => ({
  id, parentId, title, orderKey: id, createdAt: 0, updatedAt: 0,
});

beforeEach(() => {
  openPage.mockClear();
  usePagesStore.setState({
    pages: [page("root", "Root", null), page("child", "Child", "root"), page("leaf", "", "child")],
  });
});
afterEach(cleanup);

describe("PageHeader breadcrumb", () => {
  it("opens an ancestor page on click and leaves the current page inert", () => {
    render(<PageHeader pageId="leaf" />);
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Root", "Child"]);
    expect(screen.queryByRole("button", { name: "Không có tiêu đề" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Child" }));
    expect(openPage).toHaveBeenCalledWith("child");
    expect(openPage).toHaveBeenCalledTimes(1);
  });

  it("renders a root page without ancestor buttons", () => {
    render(<PageHeader pageId="root" />);
    expect(screen.queryByTestId("breadcrumb-ancestor")).toBeNull();
    expect(screen.getByTestId("page-breadcrumb").textContent).toBe("Root");
  });
});
