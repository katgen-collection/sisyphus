"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
    FileText,
    Loader2,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Download,
    Trash2,
    Type,
    Image as ImageIcon,
    X,
    Move,
} from "lucide-react";
import {
    FileUploader,
    Button,
    downloadUint8Array,
    type AcceptedFile,
} from "@/modules/_shared";
import { usePdfWorker } from "../hooks/usePdfWorker";
import { LoadingSpinner } from "@/components";
import { PdfAnnotation, TextAnnotation, ImageAnnotation } from "../types";

// PDF Viewer Types
type PDFDocumentProxy = {
    numPages: number;
    getPage: (pageNumber: number) => Promise<PDFPageProxy>;
    destroy: () => void;
};

type PDFPageProxy = {
    getViewport: (params: { scale: number }) => { width: number; height: number };
    render: (params: {
        canvasContext: CanvasRenderingContext2D;
        viewport: unknown;
        canvas: HTMLCanvasElement;
    }) => { promise: Promise<void> };
};

type PDFJSLib = {
    getDocument: (params: { data: ArrayBuffer }) => { promise: Promise<PDFDocumentProxy> };
    GlobalWorkerOptions: { workerSrc: string };
};

let pdfjsLib: PDFJSLib | null = null;
let pdfjsLoading: Promise<PDFJSLib> | null = null;

async function loadPdfjs(): Promise<PDFJSLib> {
    if (typeof window === "undefined") {
        throw new Error("PDF rendering is only available in the browser");
    }
    if (pdfjsLib) return pdfjsLib;
    if (pdfjsLoading) return pdfjsLoading;

    pdfjsLoading = new Promise<PDFJSLib>((resolve, reject) => {
        const existing = (window as unknown as { pdfjsLib?: PDFJSLib }).pdfjsLib;
        if (existing) {
            existing.GlobalWorkerOptions.workerSrc =
                "https://unpkg.com/pdfjs-dist@2.16.105/legacy/build/pdf.worker.min.js";
            pdfjsLib = existing;
            resolve(existing);
            return;
        }

        const script = document.createElement("script");
        script.src = "https://unpkg.com/pdfjs-dist@2.16.105/legacy/build/pdf.min.js";
        script.async = true;
        script.crossOrigin = "anonymous";
        script.onload = () => {
            const lib = (window as unknown as { pdfjsLib?: PDFJSLib }).pdfjsLib;
            if (!lib) {
                reject(new Error("PDF.js failed to load"));
                return;
            }
            lib.GlobalWorkerOptions.workerSrc =
                "https://unpkg.com/pdfjs-dist@2.16.105/legacy/build/pdf.worker.min.js";
            pdfjsLib = lib;
            resolve(lib);
        };
        script.onerror = () => reject(new Error("Failed to load PDF.js"));
        document.head.appendChild(script);
    });

    return pdfjsLoading;
}

interface PagePreview {
    pageIndex: number;
    preview: string;
    width: number;
    height: number;
}

export function PdfEdit() {
    const { state, progress, error, annotatePdf, reset } = usePdfWorker();

    const [file, setFile] = useState<AcceptedFile | null>(null);
    const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
    const [pages, setPages] = useState<PagePreview[]>([]);
    const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);

    // Interaction state
    const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
    const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [interactionStart, setInteractionStart] = useState<{ x: number; y: number } | null>(null);

    const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
    const pageContainerRef = useRef<HTMLDivElement>(null);
    const lastTapTimeRef = useRef<number>(0);

    // Cleanup
    useEffect(() => {
        return () => {
            if (pdfDocRef.current) pdfDocRef.current.destroy();
            pages.forEach((p) => URL.revokeObjectURL(p.preview));
        };
    }, []);

    const handleFilesAccepted = useCallback(
        async (files: AcceptedFile[]) => {
            const newFile = files[0] ?? null;
            setFile(newFile);
            reset();
            setPreviewError(null);
            setAnnotations([]);
            setSelectedPageIndex(0);
            setSelectedAnnotationId(null);
            setEditingAnnotationId(null);

            if (pdfDocRef.current) {
                pdfDocRef.current.destroy();
                pdfDocRef.current = null;
            }

            pages.forEach((p) => URL.revokeObjectURL(p.preview));
            setPages([]);

            if (!newFile) return;

            setIsLoading(true);
            try {
                const pdfjs = await loadPdfjs();
                const arrayBuffer = await newFile.file.arrayBuffer();
                setPdfData(new Uint8Array(arrayBuffer));

                const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
                pdfDocRef.current = pdfDoc;

                const nextPages: PagePreview[] = [];
                const scale = 1.5;

                for (let i = 0; i < pdfDoc.numPages; i++) {
                    const pageNumber = i + 1;
                    const page = await pdfDoc.getPage(pageNumber);
                    const viewport = page.getViewport({ scale });

                    const canvas = document.createElement("canvas");
                    const context = canvas.getContext("2d");
                    if (!context) throw new Error("Canvas context not available");

                    canvas.width = viewport.width;
                    canvas.height = viewport.height;

                    await page.render({ canvasContext: context, viewport, canvas }).promise;

                    const blob = await new Promise<Blob | null>((resolve) => {
                        canvas.toBlob(resolve, "image/png", 0.9);
                    });

                    if (!blob) continue;
                    const url = URL.createObjectURL(blob);
                    nextPages.push({
                        pageIndex: i,
                        preview: url,
                        width: viewport.width,
                        height: viewport.height,
                    });
                }

                setPages(nextPages);
            } catch (err) {
                setPreviewError(err instanceof Error ? err.message : "Failed to load PDF");
            } finally {
                setIsLoading(false);
            }
        },
        [reset]
    );

    // --- Annotation CRUD ---

    const addText = useCallback(() => {
        const newId = `text-${Date.now()}`;
        const newAnnotation: TextAnnotation = {
            type: "text",
            id: newId,
            text: "New Text",
            pageIndex: selectedPageIndex,
            x: 50,
            y: 50,
            size: 16,
            color: "#000000"
        };
        setAnnotations(prev => [...prev, newAnnotation]);
        setSelectedAnnotationId(newId);
        setEditingAnnotationId(null); // Don't auto-enter edit mode
    }, [selectedPageIndex]);

    const addImage = useCallback((imgFile: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            if (!arrayBuffer) return;

            const newId = `img-${Date.now()}`;
            const newAnnotation: ImageAnnotation = {
                type: "image",
                id: newId,
                imageData: new Uint8Array(arrayBuffer),
                pageIndex: selectedPageIndex,
                x: 50,
                y: 50,
                width: 20,
                height: 15,
            };

            const img = new Image();
            img.onload = () => {
                const page = pages[selectedPageIndex];
                if (page) {
                    const pageAspect = page.width / page.height;
                    const imgAspect = img.width / img.height;
                    newAnnotation.height = (20 * pageAspect) / imgAspect;
                }
                setAnnotations(prev => [...prev, newAnnotation]);
                setSelectedAnnotationId(newId);
                setEditingAnnotationId(null);
                URL.revokeObjectURL(img.src);
            };
            img.src = URL.createObjectURL(new Blob([arrayBuffer]));
        };
        reader.readAsArrayBuffer(imgFile);
    }, [pages, selectedPageIndex]);

    const updateText = useCallback((id: string, text: string) => {
        setAnnotations(prev => prev.map(ann =>
            ann.id === id && ann.type === "text" ? { ...ann, text } : ann
        ));
    }, []);

    const removeAnnotation = useCallback((id: string) => {
        setAnnotations(prev => prev.filter(a => a.id !== id));
        if (selectedAnnotationId === id) setSelectedAnnotationId(null);
        if (editingAnnotationId === id) setEditingAnnotationId(null);
    }, [selectedAnnotationId, editingAnnotationId]);

    // --- Helpers to get client coords ---
    function getClientXY(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null {
        if ("touches" in e) {
            const touch = e.touches[0] || e.changedTouches[0];
            if (!touch) return null;
            return { x: touch.clientX, y: touch.clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    // --- Annotation tap handler: single tap = select+drag, double tap = edit text ---
    const handleAnnotationPointerDown = useCallback((e: React.MouseEvent | React.TouchEvent, id: string) => {
        e.stopPropagation();
        e.preventDefault();
        const coords = getClientXY(e);
        if (!coords) return;

        const now = Date.now();
        const ann = annotations.find(a => a.id === id);
        const isDoubleTap = now - lastTapTimeRef.current < 350;
        lastTapTimeRef.current = now;

        if (isDoubleTap && ann?.type === "text") {
            // Double-tap on text = enter edit mode
            setEditingAnnotationId(id);
            setSelectedAnnotationId(id);
            setIsDragging(false);
            return;
        }

        // Single tap = select and start drag
        if (editingAnnotationId === id) {
            // Already editing, don't start drag
            return;
        }

        setEditingAnnotationId(null); // Exit edit mode for any other
        setSelectedAnnotationId(id);
        setIsDragging(true);
        setIsResizing(false);
        setInteractionStart(coords);
    }, [annotations, editingAnnotationId]);

    // --- Resize logic ---
    const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent, id: string) => {
        e.stopPropagation();
        e.preventDefault();
        const coords = getClientXY(e);
        if (!coords) return;

        setIsResizing(true);
        setIsDragging(false);
        setEditingAnnotationId(null);
        setSelectedAnnotationId(id);
        setInteractionStart(coords);
    }, []);

    // Unified move handler for both drag and resize
    const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if ((!isDragging && !isResizing) || !interactionStart || !selectedAnnotationId || !pageContainerRef.current) return;
        e.preventDefault();

        const coords = getClientXY(e);
        if (!coords) return;

        const dx = coords.x - interactionStart.x;
        const dy = coords.y - interactionStart.y;

        const rect = pageContainerRef.current.getBoundingClientRect();
        const dPctX = (dx / rect.width) * 100;
        const dPctY = (dy / rect.height) * 100;

        if (isDragging) {
            setAnnotations(prev => prev.map(ann => {
                if (ann.id !== selectedAnnotationId) return ann;
                return {
                    ...ann,
                    x: Math.max(0, Math.min(100, ann.x + dPctX)),
                    y: Math.max(0, Math.min(100, ann.y + dPctY))
                };
            }));
        } else if (isResizing) {
            setAnnotations(prev => prev.map(ann => {
                if (ann.id !== selectedAnnotationId) return ann;

                if (ann.type === "image") {
                    const newW = Math.max(5, (ann.width ?? 20) + dPctX);
                    const newH = Math.max(5, (ann.height ?? 15) + dPctY);
                    return { ...ann, width: newW, height: newH };
                } else if (ann.type === "text") {
                    const newSize = Math.max(8, Math.min(72, (ann.size ?? 16) + dy * 0.3));
                    return { ...ann, size: Math.round(newSize) };
                }
                return ann;
            }));
        }

        setInteractionStart(coords);
    }, [isDragging, isResizing, interactionStart, selectedAnnotationId]);

    const handlePointerEnd = useCallback(() => {
        setIsDragging(false);
        setIsResizing(false);
        setInteractionStart(null);
    }, []);

    // --- Download ---
    const handleDownload = useCallback(async () => {
        if (!file || !pdfData || annotations.length === 0) return;

        try {
            const originalName = file.file.name.replace(/\.pdf$/i, "");
            const outputName = `${originalName}_edited.pdf`;
            const result = await annotatePdf(pdfData, annotations, outputName);
            if (result) {
                downloadUint8Array(result.data, result.filename, "application/pdf");
            }
        } catch (err) {
            console.error(err);
        }
    }, [file, pdfData, annotations, annotatePdf]);

    const handleBack = useCallback(() => {
        setFile(null);
        setPdfData(null);
        pages.forEach((p) => URL.revokeObjectURL(p.preview));
        setPages([]);
        setAnnotations([]);
        setSelectedAnnotationId(null);
        setEditingAnnotationId(null);
        reset();
    }, [pages, reset]);

    const currentPage = pages[selectedPageIndex];
    const pageAnnotations = annotations.filter(a => a.pageIndex === selectedPageIndex);
    const isProcessing = state === "processing";

    // Upload step
    if (!file) {
        return (
            <FileUploader
                accept=".pdf"
                onFilesAccepted={handleFilesAccepted}
                disabled={isProcessing || isLoading}
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
            {/* Top bar */}
            <div className="flex items-center justify-between text-sm">
                <button
                    onClick={handleBack}
                    className="flex items-center gap-1 text-stone-500 hover:text-stone-700 transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                </button>
                <div className="text-stone-400">
                    {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
                </div>
            </div>

            {/* File info */}
            <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg">
                <FileText className="w-5 h-5 text-stone-500" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-700 truncate">{file?.file.name}</p>
                    <p className="text-xs text-stone-400">{pages.length} page{pages.length !== 1 ? "s" : ""}</p>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
                <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={addText} disabled={isProcessing} className="h-8 text-xs px-3">
                        <Type className="w-4 h-4 mr-1.5" />
                        Add Text
                    </Button>
                    <div className="relative">
                        <input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                    addImage(f);
                                    e.target.value = "";
                                }
                            }}
                            disabled={isProcessing}
                        />
                        <Button variant="secondary" disabled={isProcessing} className="h-8 text-xs px-3">
                            <ImageIcon className="w-4 h-4 mr-1.5" />
                            Add Image
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {annotations.length > 0 && (
                        <Button
                            variant="secondary"
                            onClick={() => { setAnnotations([]); setSelectedAnnotationId(null); setEditingAnnotationId(null); }}
                            className="h-8 text-xs px-3"
                        >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                            Clear All
                        </Button>
                    )}
                    <Button
                        onClick={handleDownload}
                        disabled={isProcessing || annotations.length === 0}
                        loading={isProcessing}
                        className="h-8 text-xs px-3"
                    >
                        <Download className="w-4 h-4 mr-1.5" />
                        Download
                    </Button>
                </div>
            </div>

            {/* Editor canvas area */}
            {currentPage && (
                <div className="flex flex-col items-center gap-4">
                    {/* Pagination */}
                    <div className="flex items-center justify-between w-full max-w-[600px]">
                        <button
                            onClick={() => setSelectedPageIndex(i => Math.max(0, i - 1))}
                            disabled={selectedPageIndex === 0}
                            className="p-2 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-sm text-stone-500">
                            Page {selectedPageIndex + 1} of {pages.length}
                        </span>
                        <button
                            onClick={() => setSelectedPageIndex(i => Math.min(pages.length - 1, i + 1))}
                            disabled={selectedPageIndex === pages.length - 1}
                            className="p-2 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Hint for mobile users */}
                    <p className="text-xs text-stone-400 sm:hidden text-center">
                        Tap to select · Double-tap text to edit · Drag to move
                    </p>

                    {/* Canvas – touch-none prevents mobile scroll */}
                    <div className="flex justify-center w-full">
                        <div
                            ref={pageContainerRef}
                            className="relative bg-white rounded-lg shadow-lg overflow-hidden select-none touch-none"
                            style={{
                                width: "100%",
                                maxWidth: Math.min(600, currentPage.width),
                                aspectRatio: `${currentPage.width} / ${currentPage.height}`,
                            }}
                            onMouseMove={handlePointerMove}
                            onMouseUp={handlePointerEnd}
                            onMouseLeave={handlePointerEnd}
                            onTouchMove={handlePointerMove}
                            onTouchEnd={handlePointerEnd}
                            onClick={() => { setSelectedAnnotationId(null); setEditingAnnotationId(null); }}
                        >
                            <img
                                src={currentPage.preview}
                                alt={`Page ${selectedPageIndex + 1}`}
                                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                                draggable={false}
                            />

                            {/* Annotations */}
                            {pageAnnotations.map(ann => {
                                const isSelected = selectedAnnotationId === ann.id;
                                const isEditing = editingAnnotationId === ann.id;
                                return (
                                    <div
                                        key={ann.id}
                                        className={`absolute group flex items-center justify-center touch-none
                                            ${isEditing ? "cursor-text" : "cursor-move"}
                                            ${isSelected ? "ring-2 ring-blue-500 z-10" : "hover:ring-1 hover:ring-blue-300"}
                                        `}
                                        style={{
                                            left: `${ann.x}%`,
                                            top: `${ann.y}%`,
                                            width: ann.type === "image" ? `${ann.width}%` : "auto",
                                            height: ann.type === "image" ? `${ann.height}%` : "auto",
                                            transform: "translate(-50%, -50%)",
                                            maxWidth: "100%",
                                            maxHeight: "100%",
                                        }}
                                        onMouseDown={(e) => handleAnnotationPointerDown(e, ann.id)}
                                        onTouchStart={(e) => handleAnnotationPointerDown(e, ann.id)}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {ann.type === "text" ? (
                                            isEditing ? (
                                                // Edit mode: show input (only on double-tap)
                                                <input
                                                    autoFocus
                                                    value={ann.text}
                                                    onChange={(e) => updateText(ann.id, e.target.value)}
                                                    className="bg-white/80 border border-blue-400 rounded px-1 outline-none text-center min-w-[60px]"
                                                    style={{
                                                        fontSize: `${(ann.size || 12) * 1.5}px`,
                                                        color: ann.color
                                                    }}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onTouchStart={(e) => e.stopPropagation()}
                                                    onBlur={() => setEditingAnnotationId(null)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            setEditingAnnotationId(null);
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                // Display mode: just show text (draggable)
                                                <span
                                                    className="pointer-events-none"
                                                    style={{
                                                        fontSize: `${(ann.size || 12) * 1.5}px`,
                                                        color: ann.color,
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {ann.text}
                                                </span>
                                            )
                                        ) : (
                                            <img
                                                src={URL.createObjectURL(new Blob([ann.imageData as BlobPart]))}
                                                className="w-full h-full object-contain pointer-events-none"
                                                alt=""
                                                onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                                            />
                                        )}

                                        {/* Delete button */}
                                        {isSelected && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeAnnotation(ann.id);
                                                }}
                                                className="absolute -top-3 -right-3 p-1 bg-red-500 text-white rounded-full shadow-sm hover:bg-red-600 z-20"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}

                                        {/* Resize handle (bottom-right corner) */}
                                        {isSelected && !isEditing && (
                                            <div
                                                className="absolute -bottom-2 -right-2 w-5 h-5 bg-blue-500 rounded-sm cursor-se-resize z-20 flex items-center justify-center shadow-md hover:bg-blue-600 transition-colors touch-none"
                                                onMouseDown={(e) => handleResizeStart(e, ann.id)}
                                                onTouchStart={(e) => handleResizeStart(e, ann.id)}
                                            >
                                                <Move className="w-3 h-3 text-white rotate-45" />
                                            </div>
                                        )}

                                        {/* Edit text hint on selected text annotations */}
                                        {isSelected && ann.type === "text" && !isEditing && (
                                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-stone-800 text-white text-[10px] whitespace-nowrap z-20">
                                                Double-tap to edit
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Hint overlay when no annotations */}
                            {pageAnnotations.length === 0 && annotations.length === 0 && (
                                <div className="absolute inset-0 flex items-center justify-center bg-stone-900/10 pointer-events-none">
                                    <div className="px-4 py-2 rounded-lg bg-white/90 text-stone-600 text-sm shadow-lg">
                                        Use the toolbar to add text or images
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Properties Panel (for selected text annotation) */}
            {selectedAnnotationId && (() => {
                const ann = annotations.find(a => a.id === selectedAnnotationId);
                if (!ann || ann.type !== "text") return null;

                return (
                    <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
                        <h4 className="text-sm font-medium text-stone-700 mb-3">Text Properties</h4>
                        <div className="flex flex-wrap gap-4 items-center">
                            <label className="text-xs text-stone-500 flex items-center gap-2">
                                Color
                                <input
                                    type="color"
                                    value={ann.color || "#000000"}
                                    onChange={(e) => {
                                        setAnnotations(prev => prev.map(a =>
                                            a.id === ann.id ? { ...a, color: e.target.value } : a
                                        ));
                                    }}
                                    className="w-8 h-8 rounded cursor-pointer border border-stone-300"
                                />
                            </label>
                            <label className="text-xs text-stone-500 flex items-center gap-2">
                                Size
                                <input
                                    type="number"
                                    min="8"
                                    max="72"
                                    value={ann.size || 12}
                                    onChange={(e) => {
                                        setAnnotations(prev => prev.map(a =>
                                            a.id === ann.id ? { ...a, size: Number(e.target.value) } : a
                                        ));
                                    }}
                                    className="w-16 p-1 text-sm border rounded border-stone-300"
                                />
                            </label>
                            {/* Edit text button for mobile */}
                            <button
                                onClick={() => setEditingAnnotationId(ann.id)}
                                className="text-xs text-blue-600 hover:text-blue-700 underline sm:hidden"
                            >
                                Edit text
                            </button>
                        </div>
                    </div>
                );
            })()}

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
                    <LoadingSpinner size="md" text={`Processing... ${progress}%`} />
                </div>
            )}

            {/* Success */}
            {state === "done" && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700">
                    PDF saved successfully! Download started.
                </div>
            )}
        </div>
    );
}
