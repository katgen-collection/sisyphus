/** Accepted file with metadata for processing */
export interface AcceptedFile {
  file: File;
  id: string;
  preview?: string;
}

/** Generic progress callback signature */
export type ProgressCallback = (progress: number) => void;

/** Processing state machine */
export type ProcessingState = "idle" | "loading" | "processing" | "done" | "error";
