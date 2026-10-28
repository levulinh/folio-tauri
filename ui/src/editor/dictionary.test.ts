import { en } from "@blocknote/core/locales";
import { expect, it } from "vitest";
import { dictionary } from "./dictionary";

it("keeps the slash menu in English", () => {
  expect(dictionary.slash_menu).toEqual(en.slash_menu);
});
