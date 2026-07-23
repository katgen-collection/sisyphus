import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import type { AcceptedFile } from "@/modules/_shared";
import { IMAGE_LIMITS } from "../types";
import type {
  ImageOptions,
  ImageWorkerAPI,
  ImageWorkerResponse,
} from "../types";

GlobalRegistrator.register({ url: "http://localhost:3000" });

let processImageImpl: ImageWorkerAPI["processImage"];
let terminateCalls = 0;
let downloadedFilename: string | null = null;

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalAnchorClick = HTMLAnchorElement.prototype.click;

URL.createObjectURL = () => "blob:test";
URL.revokeObjectURL = () => {};
HTMLAnchorElement.prototype.click = function () {
  downloadedFilename = this.download;
};

mock.module("../workerClient", () => ({
  getImageWorker: () => ({
    processImage: (...args: Parameters<ImageWorkerAPI["processImage"]>) =>
      processImageImpl(...args),
  }),
  terminateImageWorker: () => {
    terminateCalls += 1;
  },
}));

const { act, cleanup, configure, renderHook, waitFor } = await import(
  "@testing-library/react"
);
configure({ reactStrictMode: true });
const { useImageBatch } = await import("./useImageBatch");

const options: Omit<ImageOptions, "crop"> = {
  outputFormat: "webp",
  quality: 80,
  jpegMatte: "#ffffff",
  resize: {
    mode: "none",
    percentage: 100,
    width: null,
    height: null,
    maintainAspectRatio: true,
    fit: "contain",
    preventUpscale: true,
  },
};

function acceptedFile(name: string, byte: number): AcceptedFile {
  return {
    id: `uploader-${name}`,
    file: new File([Uint8Array.of(byte)], name, { type: "image/png" }),
  };
}

function success(byte: number): ImageWorkerResponse {
  const data = Uint8Array.of(byte).buffer;
  return {
    ok: true,
    result: {
      data,
      mimeType: "image/webp",
      inputBytes: 1,
      outputBytes: data.byteLength,
      width: 1,
      height: 1,
    },
  };
}

beforeEach(() => {
  terminateCalls = 0;
  downloadedFilename = null;
  processImageImpl = async () => success(1);
});

afterEach(() => {
  cleanup();
});

afterAll(async () => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  HTMLAnchorElement.prototype.click = originalAnchorClick;
  await GlobalRegistrator.unregister();
});

describe("useImageBatch", () => {
  test("processes files in strict FIFO order and isolates a file failure", async () => {
    const order: string[] = [];
    let activeCalls = 0;
    let maxActiveCalls = 0;

    processImageImpl = async (input, onProgress) => {
      order.push(input.sourceName);
      activeCalls += 1;
      maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
      onProgress?.("decoding");
      await Promise.resolve();
      activeCalls -= 1;

      if (input.sourceName === "second.png") {
        return {
          ok: false,
          error: { code: "decode-failed", message: "Second image failed." },
        };
      }
      return success(input.sourceName === "first.png" ? 1 : 3);
    };

    const { result } = renderHook(() => useImageBatch());
    act(() => {
      result.current.addFiles([
        acceptedFile("first.png", 1),
        acceptedFile("second.png", 2),
        acceptedFile("third.png", 3),
      ]);
    });

    await act(async () => {
      await result.current.process(options);
    });

    expect(order).toEqual(["first.png", "second.png", "third.png"]);
    expect(maxActiveCalls).toBe(1);
    expect(result.current.state).toBe("done-with-errors");
    expect(result.current.activeItemId).toBeNull();
    expect(result.current.items.map((item) => item.stage)).toEqual([
      "complete",
      "failed",
      "complete",
    ]);
    expect(result.current.items[0]?.result?.filename).toBe("first.webp");
    expect(result.current.items[1]?.error?.message).toBe(
      "Second image failed."
    );
    expect(result.current.items[2]?.result?.filename).toBe("third.webp");
    expect(terminateCalls).toBe(2);
  });

  test("reset terminates processing and ignores a stale worker completion", async () => {
    let resolveWorker: ((response: ImageWorkerResponse) => void) | null = null;
    processImageImpl = () =>
      new Promise<ImageWorkerResponse>((resolve) => {
        resolveWorker = resolve;
      });

    const { result } = renderHook(() => useImageBatch());
    act(() => {
      result.current.addFiles([acceptedFile("pending.png", 1)]);
    });

    let processing: Promise<void> | null = null;
    act(() => {
      processing = result.current.process(options);
    });
    await waitFor(() => expect(result.current.state).toBe("processing"));
    await waitFor(() => expect(resolveWorker).not.toBeNull());

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.items).toEqual([]);
    expect(result.current.activeItemId).toBeNull();
    expect(terminateCalls).toBe(2);

    await act(async () => {
      resolveWorker?.(success(9));
      await processing;
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.items).toEqual([]);
    expect(terminateCalls).toBe(2);
  });

  test("unmount terminates the worker and lets stale processing settle silently", async () => {
    let resolveWorker: ((response: ImageWorkerResponse) => void) | null = null;
    processImageImpl = () =>
      new Promise<ImageWorkerResponse>((resolve) => {
        resolveWorker = resolve;
      });

    const { result, unmount } = renderHook(() => useImageBatch());
    act(() => {
      result.current.addFiles([acceptedFile("pending.png", 1)]);
    });

    let processing: Promise<void> | null = null;
    act(() => {
      processing = result.current.process(options);
    });
    await waitFor(() => expect(resolveWorker).not.toBeNull());

    unmount();
    expect(terminateCalls).toBe(2);

    const finishWorker = resolveWorker as
      | ((response: ImageWorkerResponse) => void)
      | null;
    finishWorker?.(success(5));
    await processing;

    expect(terminateCalls).toBe(2);
  });

  test("restores the error terminal state when ZIP creation fails", async () => {
    processImageImpl = async (input) => {
      if (input.sourceName === "bad.png") {
        return {
          ok: false,
          error: { code: "decode-failed", message: "Bad image." },
        };
      }

      const response = success(4);
      if (response.ok) {
        response.result.outputBytes = IMAGE_LIMITS.maxZipBytes + 1;
      }
      return response;
    };

    const { result } = renderHook(() => useImageBatch());
    act(() => {
      result.current.addFiles([
        acceptedFile("good.png", 1),
        acceptedFile("bad.png", 2),
      ]);
    });
    await act(async () => {
      await result.current.process(options);
    });
    expect(result.current.state).toBe("done-with-errors");

    await act(async () => {
      await result.current.downloadAll();
    });

    expect(result.current.state).toBe("done-with-errors");
    expect(result.current.batchError).toBe(
      "Combined results exceed the 100 MiB ZIP limit. " +
        "Download the images individually."
    );

    act(() => {
      result.current.downloadItem(result.current.items[0]!.id);
    });
    expect(downloadedFilename).toBe("good.webp");
  });
});
