"use client";

import { useState, useCallback } from "react";
import type { ProcessingState } from "../types";

interface ProcessingStateHook {
  state: ProcessingState;
  progress: number;
  error: string | null;
  setIdle: () => void;
  setLoading: () => void;
  setProcessing: () => void;
  setDone: () => void;
  setError: (message: string) => void;
  setProgress: (value: number) => void;
  reset: () => void;
}

/**
 * Manages processing lifecycle state for worker operations.
 */
export function useProcessingState(): ProcessingStateHook {
  const [state, setState] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setErrorMsg] = useState<string | null>(null);

  const setIdle = useCallback(() => {
    setState("idle");
    setErrorMsg(null);
  }, []);

  const setLoading = useCallback(() => {
    setState("loading");
    setProgress(0);
    setErrorMsg(null);
  }, []);

  const setProcessing = useCallback(() => {
    setState("processing");
  }, []);

  const setDone = useCallback(() => {
    setState("done");
    setProgress(100);
  }, []);

  const setError = useCallback((message: string) => {
    setState("error");
    setErrorMsg(message);
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setProgress(0);
    setErrorMsg(null);
  }, []);

  return {
    state,
    progress,
    error,
    setIdle,
    setLoading,
    setProcessing,
    setDone,
    setError,
    setProgress,
    reset,
  };
}
