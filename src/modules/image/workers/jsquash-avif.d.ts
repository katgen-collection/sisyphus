declare module "@jsquash/avif/codec/enc/avif_enc.js" {
  interface AvifEncodeOptions {
    quality: number;
    qualityAlpha: number;
    denoiseLevel: number;
    tileRowsLog2: number;
    tileColsLog2: number;
    speed: number;
    subsample: number;
    chromaDeltaQ: boolean;
    sharpness: number;
    enableSharpYUV: boolean;
    tune: number;
    bitDepth: number;
    lossless: boolean;
  }

  interface AvifModule extends EmscriptenWasm.Module {
    encode(
      data: BufferSource,
      width: number,
      height: number,
      options: AvifEncodeOptions
    ): Uint8Array | null;
  }

  const factory: EmscriptenWasm.ModuleFactory<AvifModule>;
  export default factory;
}
