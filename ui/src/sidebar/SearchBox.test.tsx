import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchBox } from "./SearchBox";

afterEach(cleanup);
const input = () => screen.getByTestId("search-input");

function setup() {
  const onQueryChange = vi.fn();
  const onEnter = vi.fn();
  render(<SearchBox onQueryChange={onQueryChange} onEnter={onEnter} inputRef={{ current: null }} />);
  return { onQueryChange, onEnter };
}

describe("SearchBox IME", () => {
  it("does not search while composing, searches the final text on compositionend", () => {
    const { onQueryChange } = setup();
    fireEvent.compositionStart(input());
    fireEvent.change(input(), { target: { value: "đ" } });
    expect(onQueryChange).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input(), { data: "đà" });
    expect(onQueryChange).toHaveBeenLastCalledWith("đ");
  });

  it("ignores the IME-commit Enter (keyCode 229) and Enter while composing", () => {
    const { onEnter } = setup();
    fireEvent.keyDown(input(), { key: "Enter", keyCode: 229 });
    fireEvent.compositionStart(input());
    fireEvent.keyDown(input(), { key: "Enter", keyCode: 13 });
    expect(onEnter).not.toHaveBeenCalled();
  });

  it("a normal Enter calls onEnter", () => {
    const { onEnter } = setup();
    fireEvent.keyDown(input(), { key: "Enter", keyCode: 13 });
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it("Escape clears the query", () => {
    const { onQueryChange } = setup();
    fireEvent.change(input(), { target: { value: "x" } });
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(onQueryChange).toHaveBeenLastCalledWith("");
    expect((input() as HTMLInputElement).value).toBe("");
  });

  it("Escape while composing (or keyCode 229) does not clear the query", () => {
    const { onQueryChange } = setup();
    fireEvent.change(input(), { target: { value: "x" } });
    onQueryChange.mockClear();
    fireEvent.keyDown(input(), { key: "Escape", isComposing: true });
    fireEvent.keyDown(input(), { key: "Escape", keyCode: 229 });
    fireEvent.compositionStart(input());
    fireEvent.keyDown(input(), { key: "Escape", keyCode: 27 });
    expect(onQueryChange).not.toHaveBeenCalled();
    expect((input() as HTMLInputElement).value).toBe("x");
  });
});
