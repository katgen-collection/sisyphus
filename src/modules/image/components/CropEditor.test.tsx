import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";
import { useState } from "react";
import type { PixelCrop } from "../types";

GlobalRegistrator.register({ url: "http://localhost:3000" });

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalNaturalWidth = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "naturalWidth");
const originalNaturalHeight = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "naturalHeight");
const originalResizeObserver = globalThis.ResizeObserver;
const originalSetPointerCapture = Element.prototype.setPointerCapture;

class TestResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    this.callback([{
      target,
      contentRect: {
        width: 600,
        height: 480,
        x: 0,
        y: 0,
        top: 0,
        right: 600,
        bottom: 480,
        left: 0,
        toJSON: () => ({}),
      },
    } as ResizeObserverEntry], this);
  }

  disconnect() {}
  unobserve() {}
  takeRecords(): ResizeObserverEntry[] { return []; }
}

beforeAll(() => {
  URL.createObjectURL = () => "blob:crop-preview";
  URL.revokeObjectURL = () => {};
  Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
    configurable: true,
    get: () => 900,
  });
  Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
    configurable: true,
    get: () => 1200,
  });
  globalThis.ResizeObserver = TestResizeObserver;
  Element.prototype.setPointerCapture = () => {};
});

const { cleanup, fireEvent, render, screen, waitFor } = await import("@testing-library/react");
const { CropEditor } = await import("./CropEditor");

function CropHarness({ initialCrop = null }: { initialCrop?: PixelCrop | null }) {
  const [crop, setCrop] = useState<PixelCrop | null>(initialCrop);

  return (
    <>
      <CropEditor
        file={new File([Uint8Array.of(1)], "portrait.jpg", { type: "image/jpeg" })}
        crop={crop}
        onChange={setCrop}
        onDimensions={() => {}}
        onClose={() => {}}
      />
      <output data-testid="crop-value">{JSON.stringify(crop)}</output>
    </>
  );
}

function loadPortrait() {
  fireEvent.load(screen.getByAltText("Crop preview"));
}

function cropValue(): PixelCrop | null {
  return JSON.parse(screen.getByTestId("crop-value").textContent || "null") as PixelCrop | null;
}

function setFrameRect() {
  const frame = screen.getByTestId("crop-image-frame");
  Object.defineProperty(frame, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 360,
      bottom: 480,
      width: 360,
      height: 480,
      toJSON: () => ({}),
    }),
  });
  return frame;
}

function setSelectionRect() {
  const selection = screen.getByTestId("crop-selection");
  Object.defineProperty(selection, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: 40,
      y: 80,
      left: 40,
      top: 80,
      right: 200,
      bottom: 280,
      width: 160,
      height: 200,
      toJSON: () => ({}),
    }),
  });
  return selection;
}

afterEach(() => {
  cleanup();
});

afterAll(async () => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  if (originalNaturalWidth) Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", originalNaturalWidth);
  if (originalNaturalHeight) Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", originalNaturalHeight);
  globalThis.ResizeObserver = originalResizeObserver;
  Element.prototype.setPointerCapture = originalSetPointerCapture;
  await GlobalRegistrator.unregister();
});

describe("CropEditor", () => {
  test("fits the interactive frame to the portrait image instead of its letterbox area", async () => {
    render(<CropHarness />);
    loadPortrait();

    await waitFor(() => {
      expect(screen.getByTestId("crop-image-frame").getAttribute("style")).toContain("width: 360px");
      expect(screen.getByTestId("crop-image-frame").getAttribute("style")).toContain("height: 480px");
    });
  });

  test("keeps the ratio scroller inside narrow mobile grid tracks", () => {
    render(<CropHarness />);

    const dialog = screen.getByRole("dialog");
    const presets = screen.getByRole("group", { name: "Aspect ratio presets" });

    expect(dialog.className).toContain("w-full");
    expect(dialog.className).toContain("min-w-0");
    expect(dialog.className).toContain("max-w-full");
    expect(presets.parentElement?.className).toContain("min-w-0");
    expect(presets.className).toContain("max-w-full");
  });

  test("applies portrait and landscape presets immediately and labels the crop", async () => {
    render(<CropHarness />);
    loadPortrait();

    for (const [label, expected] of [
      ["3:4", null],
      ["4:3", { x: 0, y: 262, width: 900, height: 675 }],
      ["9:16", { x: 112, y: 0, width: 675, height: 1200 }],
      ["16:9", { x: 0, y: 347, width: 900, height: 506 }],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name: `Use ${label} aspect ratio` }));
      await waitFor(() => expect(cropValue()).toEqual(expected));
      expect(screen.getByText(new RegExp(`^${label.replace(":", "\\:")} ·`))).toBeTruthy();
    }
  });

  test("drags the crop in source-image coordinates", async () => {
    render(<CropHarness initialCrop={{ x: 100, y: 200, width: 400, height: 500 }} />);
    loadPortrait();
    fireEvent.click(screen.getByRole("button", { name: "Use Free aspect ratio" }));
    const frame = setFrameRect();
    const selection = screen.getByTestId("crop-selection");

    fireEvent.pointerDown(selection, { pointerId: 1, clientX: 40, clientY: 80 });
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 80, clientY: 120 });
    fireEvent.pointerUp(frame, { pointerId: 1 });

    await waitFor(() => expect(cropValue()).toEqual({ x: 200, y: 300, width: 400, height: 500 }));
  });

  test("centers large touch hitboxes on the crop boundary instead of covering its interior", () => {
    render(<CropHarness />);
    loadPortrait();

    expect(screen.getByRole("button", { name: "Resize crop from north west" }).className)
      .toContain("-translate-x-1/2 -translate-y-1/2");
    expect(screen.getByRole("button", { name: "Resize crop from north" }).className)
      .toContain("-translate-y-1/2");
    expect(screen.getByRole("button", { name: "Resize crop from east" }).className)
      .toContain("translate-x-1/2");
    expect(screen.getByRole("button", { name: "Resize crop from south east" }).className)
      .toContain("translate-x-1/2 translate-y-1/2");
  });

  test("moves instead of resizing when a handle receives a touch well inside the crop", async () => {
    render(<CropHarness initialCrop={{ x: 100, y: 200, width: 400, height: 500 }} />);
    loadPortrait();
    fireEvent.click(screen.getByRole("button", { name: "Use Free aspect ratio" }));
    const frame = setFrameRect();
    setSelectionRect();
    const northWest = screen.getByRole("button", { name: "Resize crop from north west" });

    fireEvent.pointerDown(northWest, {
      pointerId: 3,
      pointerType: "touch",
      clientX: 60,
      clientY: 100,
    });
    fireEvent.pointerMove(frame, {
      pointerId: 3,
      pointerType: "touch",
      clientX: 100,
      clientY: 140,
    });
    fireEvent.pointerUp(frame, { pointerId: 3, pointerType: "touch" });

    await waitFor(() => expect(cropValue()).toEqual({ x: 200, y: 300, width: 400, height: 500 }));
  });

  test("still resizes when a touch lands close to the visible crop boundary", async () => {
    render(<CropHarness initialCrop={{ x: 100, y: 200, width: 400, height: 500 }} />);
    loadPortrait();
    fireEvent.click(screen.getByRole("button", { name: "Use Free aspect ratio" }));
    const frame = setFrameRect();
    setSelectionRect();
    const northWest = screen.getByRole("button", { name: "Resize crop from north west" });

    fireEvent.pointerDown(northWest, {
      pointerId: 4,
      pointerType: "touch",
      clientX: 46,
      clientY: 86,
    });
    fireEvent.pointerMove(frame, {
      pointerId: 4,
      pointerType: "touch",
      clientX: 86,
      clientY: 126,
    });
    fireEvent.pointerUp(frame, { pointerId: 4, pointerType: "touch" });

    await waitFor(() => expect(cropValue()).toEqual({ x: 200, y: 300, width: 300, height: 400 }));
  });

  test("resizes from a corner and keeps a selected ratio locked", async () => {
    render(<CropHarness initialCrop={{ x: 100, y: 200, width: 400, height: 500 }} />);
    loadPortrait();
    const frame = setFrameRect();

    fireEvent.click(screen.getByRole("button", { name: "Use 4:5 aspect ratio" }));
    const handle = screen.getByRole("button", { name: "Resize crop from south east" });
    fireEvent.pointerDown(handle, { pointerId: 2, clientX: 320, clientY: 440 });
    fireEvent.pointerMove(frame, { pointerId: 2, clientX: 280, clientY: 400 });
    fireEvent.pointerUp(frame, { pointerId: 2 });

    await waitFor(() => {
      const crop = cropValue();
      expect(crop).not.toBeNull();
      expect(crop!.width / crop!.height).toBeCloseTo(4 / 5, 2);
      expect(crop!.x).toBeGreaterThanOrEqual(0);
      expect(crop!.y).toBeGreaterThanOrEqual(0);
      expect(crop!.x + crop!.width).toBeLessThanOrEqual(900);
      expect(crop!.y + crop!.height).toBeLessThanOrEqual(1200);
    });
  });

  test("treats exact dimension edits as a custom crop", async () => {
    render(<CropHarness />);
    loadPortrait();
    fireEvent.click(screen.getByText("Exact crop"));

    fireEvent.change(screen.getByLabelText("width"), { target: { value: "875" } });

    await waitFor(() => {
      expect(cropValue()).toEqual({ x: 0, y: 0, width: 875, height: 1200 });
      expect(screen.getByText("Custom · 875 × 1200 px")).toBeTruthy();
    });
  });

  test("resets the crop to the full image", async () => {
    render(<CropHarness initialCrop={{ x: 100, y: 200, width: 400, height: 500 }} />);
    loadPortrait();

    fireEvent.click(screen.getByRole("button", { name: "Reset crop" }));

    await waitFor(() => expect(cropValue()).toBeNull());
    expect(screen.getByText("Original · 900 × 1200 px")).toBeTruthy();
  });
});
