import { expect, test } from "bun:test";
import { makeOutputName } from "./naming";

test("creates safe collision-resistant output names", () => {
  const used = new Set<string>();
  const first = makeOutputName("folder/photo.HEIC", "webp", used);
  used.add(first.toLowerCase());
  expect(first).toBe("photo.webp");
  expect(makeOutputName("photo.jpg", "webp", used)).toBe("photo (2).webp");
  expect(makeOutputName("../CON.png", "jpeg", new Set())).toBe("image-con.jpg");
});
