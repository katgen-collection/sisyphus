"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { FileText, Loader2, AlertCircle, X, Download, RotateCcw, ChevronUp, ChevronDown } from "lucide-react";
import {
    FileUploader,
    Button,
    downloadUint8Array,
    type AcceptedFile,
} from "@/modules/_shared";
import { usePdfWorker } from "../hooks/usePdfWorker";
import { LoadingSpinner } from "@/components";
import { MergePageSource } from "../types";
import { loadPdfjs, type PDFDocumentProxy } from "../lib/pdfjs";
import { PdfLazyPage } from "./PdfLazyPage";

interface PageItem {
    id: string;
    fileId: string;
    pageIndex: number;
    sourceName: string;
}

interface SourceFile {
    id: string;
    file: File;
    pdfDoc: PDFDocumentProxy | null;
    color: string;
}

const FILE_COLORS = [
    "bg-blue-100 text-blue-800 border-blue-200",
    "bg-emerald-100 text-emerald-800 border-emerald-200",
    "bg-amber-100 text-amber-800 border-amber-200",
    "bg-purple-100 text-purple-800 border-purple-200",
    "bg-rose-100 text-rose-800 border-rose-200",
    "bg-cyan-100 text-cyan-800 border-cyan-200",
];

export function PdfMerge() {
    const { state, progress, error, mergePdfs, reset } = usePdfWorker();

    const [files, setFiles] = useState<SourceFile[]>([]);
    const [pages, setPages] = useState<PageItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    // Desktop HTML5 drag
    const [draggedId, setDraggedId] = useState<string | null>(null);

    // Mobile touch-based drag
    const [touchDragIndex, setTouchDragIndex] = useState<number | null>(null);
    const touchStartY = useRef<number>(0);
    const touchCurrentY = useRef<number>(0);
    const [touchOffset, setTouchOffset] = useState(0);
    const gridRef = useRef<HTMLDivElement>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            files.forEach((f) => {
                if (f.pdfDoc) f.pdfDoc.destroy();
            });
        };
    }, []);

    const handleFilesAccepted = useCallback(
        async (acceptedFiles: AcceptedFile[]) => {
            if (acceptedFiles.length === 0) return;

            setIsLoading(true);
            setPreviewError(null);
            reset();

            try {
                const pdfjs = await loadPdfjs();
                const newFiles: SourceFile[] = [];
                const newPages: PageItem[] = [];

                const startColorIdx = files.length % FILE_COLORS.length;

                for (let i = 0; i < acceptedFiles.length; i++) {
                    const file = acceptedFiles[i];
                    const fileId = file.id;
                    const arrayBuffer = await file.file.arrayBuffer();
                    const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;

                    const colorClass = FILE_COLORS[(startColorIdx + i) % FILE_COLORS.length];

                    newFiles.push({
                        id: fileId,
                        file: file.file,
                        pdfDoc,
                        color: colorClass,
                    });

                    // Page thumbnails rasterize lazily (see PdfLazyPage) — the
                    // doc proxy stays alive on the SourceFile for on-demand render.
                    for (let j = 0; j < pdfDoc.numPages; j++) {
                        const pageNumber = j + 1;
                        newPages.push({
                            id: `${fileId}-${pageNumber}`,
                            fileId: fileId,
                            pageIndex: j,
                            sourceName: file.file.name,
                        });
                    }
                }

                setFiles((prev) => [...prev, ...newFiles]);
                setPages((prev) => [...prev, ...newPages]);
            } catch (err) {
                setPreviewError(err instanceof Error ? err.message : "Failed to load PDF");
            } finally {
                setIsLoading(false);
            }
        },
        [files, reset]
    );

    // --- Desktop HTML5 Drag ---
    const handleDragStart = useCallback((id: string) => {
        setDraggedId(id);
    }, []);

    const handleDragOver = useCallback(
        (e: React.DragEvent, targetId: string) => {
            e.preventDefault();
            if (!draggedId || draggedId === targetId) return;

            setPages((prev) => {
                const items = [...prev];
                const draggedIdx = items.findIndex((i) => i.id === draggedId);
                const targetIdx = items.findIndex((i) => i.id === targetId);
                if (draggedIdx === -1 || targetIdx === -1) return prev;

                const [dragged] = items.splice(draggedIdx, 1);
                items.splice(targetIdx, 0, dragged);
                return items;
            });
        },
        [draggedId]
    );

    const handleDragEnd = useCallback(() => {
        setDraggedId(null);
    }, []);

    // --- Mobile Touch Drag (long-press + drag to reorder) ---
    const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleTouchStart = useCallback((e: React.TouchEvent, idx: number) => {
        const touch = e.touches[0];
        touchStartY.current = touch.clientY;
        touchCurrentY.current = touch.clientY;

        // Long press (300ms) to initiate drag
        touchTimerRef.current = setTimeout(() => {
            setTouchDragIndex(idx);
            setTouchOffset(0);
            // Small haptic-like visual feedback
        }, 300);
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        touchCurrentY.current = touch.clientY;

        // If we haven't started dragging yet and moved too much, cancel long press
        if (touchDragIndex === null && touchTimerRef.current) {
            const dy = Math.abs(touch.clientY - touchStartY.current);
            if (dy > 10) {
                clearTimeout(touchTimerRef.current);
                touchTimerRef.current = null;
            }
            return;
        }

        if (touchDragIndex === null) return;
        e.preventDefault(); // Prevent scrolling while dragging

        const dy = touch.clientY - touchStartY.current;
        setTouchOffset(dy);

        // Calculate which item we're hovering over
        if (!gridRef.current) return;
        const cards = gridRef.current.querySelectorAll("[data-page-idx]");
        for (const card of Array.from(cards)) {
            const rect = card.getBoundingClientRect();
            if (touch.clientY >= rect.top && touch.clientY <= rect.bottom &&
                touch.clientX >= rect.left && touch.clientX <= rect.right) {
                const targetIdx = Number(card.getAttribute("data-page-idx"));
                if (!isNaN(targetIdx) && targetIdx !== touchDragIndex) {
                    // Swap
                    setPages(prev => {
                        const items = [...prev];
                        const [dragged] = items.splice(touchDragIndex, 1);
                        items.splice(targetIdx, 0, dragged);
                        return items;
                    });
                    setTouchDragIndex(targetIdx);
                    touchStartY.current = touch.clientY;
                    setTouchOffset(0);
                }
                break;
            }
        }
    }, [touchDragIndex]);

    const handleTouchEnd = useCallback(() => {
        if (touchTimerRef.current) {
            clearTimeout(touchTimerRef.current);
            touchTimerRef.current = null;
        }
        setTouchDragIndex(null);
        setTouchOffset(0);
    }, []);

    // --- Move buttons (mobile-friendly alternative) ---
    const movePage = useCallback((idx: number, direction: "up" | "down") => {
        setPages(prev => {
            const items = [...prev];
            const targetIdx = direction === "up" ? idx - 1 : idx + 1;
            if (targetIdx < 0 || targetIdx >= items.length) return prev;
            [items[idx], items[targetIdx]] = [items[targetIdx], items[idx]];
            return items;
        });
    }, []);

    const handleReset = useCallback(() => {
        files.forEach(f => f.pdfDoc?.destroy());
        setFiles([]);
        setPages([]);
        setPreviewError(null);
        reset();
    }, [files, reset]);

    const removePage = useCallback((pageId: string) => {
        setPages(prev => prev.filter(p => p.id !== pageId));
    }, []);

    const handleMerge = useCallback(async () => {
        if (files.length === 0 || pages.length === 0) return;

        try {
            const sourceFiles = files.map(f => f.file);
            const mergePages: MergePageSource[] = pages.map(p => ({
                fileId: p.fileId,
                fileIndex: files.findIndex(f => f.id === p.fileId),
                pageIndex: p.pageIndex
            }));

            const result = await mergePdfs(sourceFiles, mergePages);
            if (result) {
                downloadUint8Array(result.data, result.filename, "application/pdf");
            }
        } catch (err) {
            console.error(err);
        }
    }, [files, pages, mergePdfs]);

    const isProcessing = state === "processing";
    const canProcess = pages.length > 0 && !isProcessing && !isLoading;

    // No files loaded yet – show full FileUploader
    if (files.length === 0 && !isLoading) {
        return (
            <FileUploader
                accept=".pdf"
                multiple
                onFilesAccepted={handleFilesAccepted}
                disabled={isProcessing}
            >
                {isLoading ? (
                    <div className="text-center">
                        <Loader2 className="w-8 h-8 mx-auto text-stone-400 animate-spin mb-2" />
                        <p className="text-stone-500">Loading PDF...</p>
                    </div>
                ) : undefined}
            </FileUploader>
        );
    }

    return (
        <div className="space-y-4">
            {/* File info bar */}
            <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg">
                <FileText className="w-5 h-5 text-stone-500 shrink-0" />
                <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
                    {files.map(file => (
                        <span key={file.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${file.color}`}>
                            {file.file.name}
                        </span>
                    ))}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={handleReset}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Clear all"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Add more files (compact uploader) */}
            <FileUploader
                accept=".pdf"
                multiple
                onFilesAccepted={handleFilesAccepted}
                disabled={isProcessing || isLoading}
                compact
            >
                {isLoading ? (
                    <div className="flex items-center gap-2 text-stone-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Loading pages...</span>
                    </div>
                ) : (
                    <p className="text-stone-500 text-sm">
                        Drop more PDF files here or click to add
                    </p>
                )}
            </FileUploader>

            {/* Loading indicator */}
            {isLoading && (
                <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="md" text="Loading PDF..." />
                </div>
            )}

            {/* Page grid */}
            {!isLoading && pages.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs text-stone-400">
                        {pages.length} page{pages.length !== 1 ? "s" : ""} · <span className="hidden sm:inline">Drag to reorder</span><span className="sm:hidden">Use arrows to reorder</span>
                    </p>
                    <div
                        ref={gridRef}
                        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onTouchCancel={handleTouchEnd}
                    >
                        {pages.map((page, idx) => {
                            const sourceFile = files.find(f => f.id === page.fileId);
                            const fileColor = sourceFile?.color || "bg-gray-100";
                            const isTouchDragging = touchDragIndex === idx;
                            return (
                                <div
                                    key={page.id}
                                    data-page-idx={idx}
                                    // Desktop HTML5 drag
                                    draggable={!isProcessing}
                                    onDragStart={() => handleDragStart(page.id)}
                                    onDragOver={(e) => handleDragOver(e, page.id)}
                                    onDragEnd={handleDragEnd}
                                    // Mobile touch drag
                                    onTouchStart={(e) => handleTouchStart(e, idx)}
                                    className={`
                                        relative group rounded-lg overflow-hidden border-2 bg-white transition-all
                                        ${draggedId === page.id
                                            ? "opacity-50 scale-95 border-stone-400"
                                            : isTouchDragging
                                                ? "opacity-75 scale-105 border-blue-400 shadow-lg z-20"
                                                : "border-stone-200 hover:border-stone-400 shadow-sm"
                                        }
                                        ${!isProcessing ? "cursor-move" : ""}
                                    `}
                                    style={isTouchDragging ? {
                                        transform: `scale(1.05) translateY(${touchOffset}px)`,
                                        zIndex: 50,
                                        position: "relative",
                                    } : undefined}
                                >
                                    <div className="aspect-[3/4] pointer-events-none">
                                        <PdfLazyPage
                                            doc={sourceFile?.pdfDoc ?? null}
                                            pageNumber={page.pageIndex + 1}
                                            scale={0.5}
                                            alt={`Page ${idx + 1}`}
                                            className="w-full h-full bg-white"
                                        />
                                    </div>

                                    {/* Source file badge */}
                                    <div className={`absolute top-0 left-0 right-0 px-2 py-1 text-[10px] font-medium truncate border-b ${fileColor}`}>
                                        {page.sourceName}
                                    </div>

                                    {/* Page number */}
                                    <div className="absolute bottom-1 left-1 px-2 py-0.5 rounded bg-stone-900/70 text-white text-xs">
                                        {idx + 1}
                                    </div>

                                    {/* Mobile reorder buttons (always visible on touch devices) */}
                                    <div className="absolute bottom-1 right-1 flex flex-col gap-0.5 sm:hidden">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); movePage(idx, "up"); }}
                                            disabled={idx === 0}
                                            className="p-1 rounded bg-white/90 text-stone-500 disabled:opacity-30 shadow-sm active:bg-stone-100"
                                        >
                                            <ChevronUp className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); movePage(idx, "down"); }}
                                            disabled={idx === pages.length - 1}
                                            className="p-1 rounded bg-white/90 text-stone-500 disabled:opacity-30 shadow-sm active:bg-stone-100"
                                        >
                                            <ChevronDown className="w-3 h-3" />
                                        </button>
                                    </div>

                                    {/* Remove button (visible on hover for desktop) */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removePage(page.id);
                                        }}
                                        className="absolute top-7 right-1 p-1 rounded-full bg-white/80 text-stone-400 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-red-100 hover:text-red-500 transition-all"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Error */}
            {(previewError || error) && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {previewError || error}
                </div>
            )}

            {/* Processing */}
            {isProcessing && (
                <div className="flex items-center justify-center py-4">
                    <LoadingSpinner size="md" text={`Merging... ${progress}%`} />
                </div>
            )}

            {/* Success */}
            {state === "done" && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700">
                    Files merged successfully! Download started.
                </div>
            )}

            {/* Action */}
            <div className="flex gap-3">
                <Button
                    variant="secondary"
                    onClick={handleReset}
                    className="flex-1"
                >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                </Button>
                <Button onClick={handleMerge} disabled={!canProcess} loading={isProcessing} className="flex-1">
                    <Download className="w-4 h-4" />
                    Merge & Download
                </Button>
            </div>
        </div>
    );
}
