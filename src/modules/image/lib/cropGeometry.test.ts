import { describe, expect, test } from "bun:test";
import {
  centeredCropForRatio,
  detectCropRatio,
  moveCrop,
  normalizeCrop,
  ratioValue,
  resizeCrop,
} from "./cropGeometry";

const portrait = { width: 900, height: 1200 };

describe("crop geometry", () => {
  test("normalizes a crop entirely inside the source image", () => {
    expect(normalizeCrop({ x: -20, y: 1100, width: 1000, height: 300 }, portrait)).toEqual({
      x: 0,
      y: 1100,
      width: 900,
      height: 100,
    });
  });

  test("creates centered portrait and landscape presets inside a portrait image", () => {
    expect(centeredCropForRatio(portrait, ratioValue("16:9", portrait))).toEqual({
      x: 0,
      y: 347,
      width: 900,
      height: 506,
    });
    expect(centeredCropForRatio(portrait, ratioValue("3:4", portrait))).toEqual({
      x: 0,
      y: 0,
      width: 900,
      height: 1200,
    });
    expect(centeredCropForRatio(portrait, ratioValue("4:3", portrait))).toEqual({
      x: 0,
      y: 262,
      width: 900,
      height: 675,
    });
  });

  test("moves a crop without allowing it to leave the image", () => {
    const crop = { x: 100, y: 200, width: 400, height: 500 };

    expect(moveCrop(crop, -500, 900, portrait)).toEqual({
      x: 0,
      y: 700,
      width: 400,
      height: 500,
    });
  });

  test("freely resizes edge and corner handles within image bounds", () => {
    const crop = { x: 100, y: 200, width: 400, height: 500 };

    expect(resizeCrop(crop, "east", 700, 0, portrait, null)).toEqual({
      x: 100,
      y: 200,
      width: 800,
      height: 500,
    });
    expect(resizeCrop(crop, "north-west", -300, -400, portrait, null)).toEqual({
      x: 0,
      y: 0,
      width: 500,
      height: 700,
    });
  });

  test("keeps a selected ratio while resizing corners and edges", () => {
    const crop = { x: 100, y: 300, width: 600, height: 450 };
    const ratio = 4 / 3;

    const corner = resizeCrop(crop, "south-east", 100, 100, portrait, ratio);
    const edge = resizeCrop(crop, "east", 100, 0, portrait, ratio);

    expect(corner.x).toBe(100);
    expect(corner.y).toBe(300);
    expect(corner.width / corner.height).toBeCloseTo(ratio, 2);
    expect(edge.width / edge.height).toBeCloseTo(ratio, 2);
    expect(Math.abs(
      (edge.y + edge.height / 2) - (crop.y + crop.height / 2),
    )).toBeLessThanOrEqual(0.5);
  });

  test("detects original, common ratios, and custom crops", () => {
    expect(detectCropRatio({ x: 0, y: 0, width: 900, height: 1200 }, portrait)).toBe("original");
    expect(detectCropRatio({ x: 0, y: 100, width: 800, height: 1000 }, portrait)).toBe("4:5");
    expect(detectCropRatio({ x: 0, y: 100, width: 875, height: 1000 }, portrait)).toBe("custom");
  });
});
