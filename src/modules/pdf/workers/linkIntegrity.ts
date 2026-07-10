import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFObject,
  PDFRef,
  PDFString,
} from "pdf-lib";

/** Summary of link handling performed while composing a merged document. */
export interface LinkIntegrityStats {
  linksFound: number;
  externalPreserved: number;
  internalRewritten: number;
  internalRemoved: number;
  otherPreserved: number;
}

export interface MergePageCopy {
  sourceIndex: number;
  sourcePageIndex: number;
  copiedPage: ReturnType<PDFDocument["getPages"]>[number];
}

interface InternalDestination {
  destination: PDFArray;
  action: "destination" | "goto";
}

const ANNOTS = PDFName.of("Annots");
const SUBTYPE = PDFName.of("Subtype");
const ACTION = PDFName.of("A");
const ACTION_TYPE = PDFName.of("S");
const URI = PDFName.of("URI");
const DESTINATION = PDFName.of("Dest");
const ACTION_DESTINATION = PDFName.of("D");
const NAMES = PDFName.of("Names");
const DESTS = PDFName.of("Dests");
const KIDS = PDFName.of("Kids");

function refKey(ref: PDFRef): string {
  return `${ref.objectNumber} ${ref.generationNumber}`;
}

function sourcePageKey(sourceIndex: number, ref: PDFRef): string {
  return `${sourceIndex}:${refKey(ref)}`;
}

function isName(object: PDFObject | undefined, name: string): boolean {
  return object instanceof PDFName && object.toString() === `/${name}`;
}

function destinationNameKey(object: PDFObject): string | null {
  if (object instanceof PDFName) return object.decodeText();
  if (object instanceof PDFString || object instanceof PDFHexString) {
    return object.decodeText();
  }
  return null;
}

function dereference(document: PDFDocument, object: PDFObject | undefined): PDFObject | undefined {
  return object instanceof PDFRef ? document.context.lookup(object) : object;
}

function destinationFromValue(
  document: PDFDocument,
  value: PDFObject | undefined
): PDFArray | null {
  const resolved = dereference(document, value);
  if (resolved instanceof PDFArray) return resolved;
  if (resolved instanceof PDFDict) {
    return destinationFromValue(document, resolved.get(ACTION_DESTINATION));
  }

  const key = resolved ? destinationNameKey(resolved) : null;
  return key ? findNamedDestination(document, key) : null;
}

function findInNameTree(
  document: PDFDocument,
  node: PDFDict,
  target: string,
  visited: Set<PDFDict>
): PDFArray | null {
  if (visited.has(node)) return null;
  visited.add(node);

  const names = node.lookupMaybe(NAMES, PDFArray);
  if (names) {
    for (let index = 0; index + 1 < names.size(); index += 2) {
      const key = destinationNameKey(dereference(document, names.get(index)) ?? names.get(index));
      if (key === target) {
        return destinationFromValue(document, names.get(index + 1));
      }
    }
  }

  const kids = node.lookupMaybe(KIDS, PDFArray);
  if (!kids) return null;
  for (const child of kids.asArray()) {
    const childDict = document.context.lookupMaybe(child, PDFDict);
    if (!childDict) continue;
    const destination = findInNameTree(document, childDict, target, visited);
    if (destination) return destination;
  }
  return null;
}

function findNamedDestination(document: PDFDocument, target: string): PDFArray | null {
  const names = document.catalog.lookupMaybe(NAMES, PDFDict);
  const destinations = names?.lookupMaybe(DESTS, PDFDict);
  if (destinations) {
    const destination = findInNameTree(document, destinations, target, new Set());
    if (destination) return destination;
  }

  // PDF 1.1-style documents can store named destinations directly on the catalog.
  const legacyDestinations = document.catalog.lookupMaybe(DESTS, PDFDict);
  if (!legacyDestinations) return null;
  for (const [key, value] of legacyDestinations.entries()) {
    if (destinationNameKey(key) === target) {
      return destinationFromValue(document, value);
    }
  }
  return null;
}

function getInternalDestination(document: PDFDocument, annotation: PDFDict): InternalDestination | null {
  const directDestination = annotation.get(DESTINATION);
  if (directDestination) {
    const destination = destinationFromValue(document, directDestination);
    return destination ? { destination, action: "destination" } : null;
  }

  const action = annotation.lookupMaybe(ACTION, PDFDict);
  if (!action || !isName(action.get(ACTION_TYPE), "GoTo")) return null;

  const destination = destinationFromValue(document, action.get(ACTION_DESTINATION));
  return destination ? { destination, action: "goto" } : null;
}

function isExternalUriLink(annotation: PDFDict): boolean {
  const action = annotation.lookupMaybe(ACTION, PDFDict);
  return !!action && isName(action.get(ACTION_TYPE), "URI") && action.has(URI);
}

function isInternalNavigationLink(annotation: PDFDict): boolean {
  if (annotation.has(DESTINATION)) return true;
  const action = annotation.lookupMaybe(ACTION, PDFDict);
  return !!action && isName(action.get(ACTION_TYPE), "GoTo");
}

function cloneDestinationForOutput(
  output: PDFDocument,
  sourceDestination: PDFArray,
  targetPageRef: PDFRef
): PDFArray {
  const destination = PDFArray.withContext(output.context);
  destination.push(targetPageRef);
  for (const item of sourceDestination.asArray().slice(1)) {
    destination.push(item.clone(output.context));
  }
  return destination;
}

function setCopiedDestination(
  copiedAnnotation: PDFDict,
  outputDestination: PDFArray,
  action: InternalDestination["action"]
): boolean {
  if (action === "destination") {
    copiedAnnotation.set(DESTINATION, outputDestination);
    return true;
  }

  const copiedAction = copiedAnnotation.lookupMaybe(ACTION, PDFDict);
  if (!copiedAction) return false;
  copiedAction.set(ACTION_DESTINATION, outputDestination);
  return true;
}

/**
 * Repoints retained internal link annotations after pages have been copied into
 * a merge result. pdf-lib copies the annotation but not its target's page-tree
 * identity, so this fixes GoTo destinations without touching URI links.
 */
export function preserveMergedLinks(
  sourceDocuments: PDFDocument[],
  output: PDFDocument,
  pageCopies: MergePageCopy[]
): LinkIntegrityStats {
  const stats: LinkIntegrityStats = {
    linksFound: 0,
    externalPreserved: 0,
    internalRewritten: 0,
    internalRemoved: 0,
    otherPreserved: 0,
  };
  if (pageCopies.length === 0) return stats;

  const outputRefs = new Map<string, PDFRef>();
  for (const copy of pageCopies) {
    const sourcePage = sourceDocuments[copy.sourceIndex]?.getPages()[copy.sourcePageIndex];
    if (sourcePage) {
      outputRefs.set(sourcePageKey(copy.sourceIndex, sourcePage.ref), copy.copiedPage.ref);
    }
  }

  for (const copy of pageCopies) {
    const sourceDocument = sourceDocuments[copy.sourceIndex];
    const sourcePage = sourceDocument?.getPages()[copy.sourcePageIndex];
    if (!sourceDocument || !sourcePage) continue;

    const sourceAnnotations = sourcePage.node.lookupMaybe(ANNOTS, PDFArray);
    const copiedAnnotations = copy.copiedPage.node.lookupMaybe(ANNOTS, PDFArray);
    if (!sourceAnnotations || !copiedAnnotations) continue;

    // Copying preserves annotation order, so matching indices lets us inspect
    // source semantics while safely changing only output objects.
    for (let index = Math.min(sourceAnnotations.size(), copiedAnnotations.size()) - 1; index >= 0; index--) {
      const sourceAnnotation = sourceDocument.context.lookupMaybe(sourceAnnotations.get(index), PDFDict);
      const copiedAnnotation = output.context.lookupMaybe(copiedAnnotations.get(index), PDFDict);
      if (!sourceAnnotation || !copiedAnnotation || !isName(sourceAnnotation.get(SUBTYPE), "Link")) {
        continue;
      }

      stats.linksFound++;
      if (isExternalUriLink(sourceAnnotation)) {
        stats.externalPreserved++;
        continue;
      }

      const destination = getInternalDestination(sourceDocument, sourceAnnotation);
      if (!destination) {
        if (isInternalNavigationLink(sourceAnnotation)) {
          copiedAnnotations.remove(index);
          stats.internalRemoved++;
          continue;
        }
        stats.otherPreserved++;
        continue;
      }

      const targetSourceRef = destination.destination.get(0);
      const targetRef = targetSourceRef instanceof PDFRef
        ? outputRefs.get(sourcePageKey(copy.sourceIndex, targetSourceRef))
        : undefined;

      if (!targetRef) {
        // A GoTo link with an excluded or invalid target is worse than no link:
        // remove the click target rather than shipping a broken destination.
        copiedAnnotations.remove(index);
        stats.internalRemoved++;
        continue;
      }

      const outputDestination = cloneDestinationForOutput(output, destination.destination, targetRef);
      if (setCopiedDestination(copiedAnnotation, outputDestination, destination.action)) {
        stats.internalRewritten++;
      } else {
        stats.otherPreserved++;
      }
    }
  }

  return stats;
}
