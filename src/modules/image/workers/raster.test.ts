import { expect, test } from "bun:test";
import { applyOrientation, compositeForJpeg, cropRaster, resizeRaster } from "./raster";
import type { RasterImage } from "./raster";

const raster = {
  width: 2,
  height: 2,
  data: new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 255, 255, 0, 255,
  ]),
};

const orientationRaster = {
  width: 3,
  height: 2,
  data: new Uint8ClampedArray([
    1, 0, 0, 255, 2, 0, 0, 255, 3, 0, 0, 255,
    4, 0, 0, 255, 5, 0, 0, 255, 6, 0, 0, 255,
  ]),
};

function redChannels(image: RasterImage): number[] {
  return Array.from({ length: image.width * image.height }, (_, index) => image.data[index * 4]);
}

test("applies all EXIF orientation transforms", () => {
  const expected: Record<number, { width: number; height: number; pixels: number[] }> = {
    1: { width: 3, height: 2, pixels: [1, 2, 3, 4, 5, 6] },
    2: { width: 3, height: 2, pixels: [3, 2, 1, 6, 5, 4] },
    3: { width: 3, height: 2, pixels: [6, 5, 4, 3, 2, 1] },
    4: { width: 3, height: 2, pixels: [4, 5, 6, 1, 2, 3] },
    5: { width: 2, height: 3, pixels: [1, 4, 2, 5, 3, 6] },
    6: { width: 2, height: 3, pixels: [4, 1, 5, 2, 6, 3] },
    7: { width: 2, height: 3, pixels: [6, 3, 5, 2, 4, 1] },
    8: { width: 2, height: 3, pixels: [3, 6, 2, 5, 1, 4] },
  };

  for (let orientation = 1; orientation <= 8; orientation += 1) {
    const transformed = applyOrientation(orientationRaster, orientation as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8);
    expect({ width: transformed.width, height: transformed.height }).toEqual({
      width: expected[orientation].width,
      height: expected[orientation].height,
    });
    expect(redChannels(transformed)).toEqual(expected[orientation].pixels);
  }
});

test("crops and resizes raster data", () => {
  const cropped = cropRaster(raster, { x: 1, y: 0, width: 1, height: 2 });
  expect({ width: cropped.width, height: cropped.height }).toEqual({ width: 1, height: 2 });
  const resized = resizeRaster(cropped, {
    mode: "percentage", percentage: 50, width: null, height: null,
    maintainAspectRatio: true, fit: "contain", preventUpscale: true,
  });
  expect({ width: resized.width, height: resized.height }).toEqual({ width: 1, height: 1 });
});

test("does not apply a downscale percentage twice", () => {
  const source = {
    width: 4,
    height: 2,
    data: new Uint8ClampedArray(4 * 2 * 4),
  };
  const resized = resizeRaster(source, {
    mode: "percentage", percentage: 50, width: null, height: null,
    maintainAspectRatio: true, fit: "contain", preventUpscale: true,
  });
  expect({ width: resized.width, height: resized.height }).toEqual({ width: 2, height: 1 });
});

test("prevents contain and stretch upscaling without shrinking valid dimensions", () => {
  const source = {
    width: 4,
    height: 2,
    data: new Uint8ClampedArray(4 * 2 * 4),
  };
  const contained = resizeRaster(source, {
    mode: "dimensions", percentage: 100, width: 8, height: 1,
    maintainAspectRatio: true, fit: "contain", preventUpscale: true,
  });
  expect({ width: contained.width, height: contained.height }).toEqual({ width: 2, height: 1 });

  const stretched = resizeRaster(source, {
    mode: "dimensions", percentage: 100, width: 8, height: 1,
    maintainAspectRatio: false, fit: "stretch", preventUpscale: true,
  });
  expect({ width: stretched.width, height: stretched.height }).toEqual({ width: 4, height: 1 });
});

test("shrinks a cover target instead of upscaling its source", () => {
  const source = {
    width: 4,
    height: 2,
    data: new Uint8ClampedArray(4 * 2 * 4),
  };
  const resized = resizeRaster(source, {
    mode: "dimensions", percentage: 100, width: 8, height: 8,
    maintainAspectRatio: true, fit: "cover", preventUpscale: true,
  });
  expect({ width: resized.width, height: resized.height }).toEqual({ width: 2, height: 2 });
});

test("composites transparency for JPEG", () => {
  const result = compositeForJpeg({ width: 1, height: 1, data: new Uint8ClampedArray([200, 100, 50, 128]) }, "#ffffff");
  expect([...result.data]).toEqual([227, 177, 152, 255]);
});
