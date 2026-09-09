import type { EditCategory } from "@gdp/core";
import type { DesignPatch, DesignDocument } from "@gdp/design-schema";

export interface EditClassificationResult {
  category: EditCategory;
  creditCost: number;
  isFree: boolean;
  reason: string;
  allowedOperations: string[];
}

const DATE_TIME_KEYWORDS = [
  "date",
  "time",
  "october",
  "november",
  "december",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "am",
  "pm",
  "o'clock",
  "venue",
  "location",
  "address",
];

const PHOTO_KEYWORDS = [
  "photo",
  "image",
  "picture",
  "cutout",
  "portrait",
  "subject",
  "swap photo",
  "change photo",
  "replace photo",
];

export function classifyEdit(
  instructionOrParams:
    | string
    | {
        instruction?: string;
        instructions?: string;
        patch?: DesignPatch | any;
        targetLayerId?: string;
        doc?: DesignDocument;
      },
  patchArg?: DesignPatch | any,
  docArg?: DesignDocument,
): EditClassificationResult {
  let instruction = "";
  let patch: DesignPatch = { version: "1.0", docId: "doc", ops: [] as any };
  let doc: DesignDocument | undefined = docArg;

  if (typeof instructionOrParams === "string") {
    instruction = instructionOrParams;
    patch = patchArg || patch;
  } else if (instructionOrParams && typeof instructionOrParams === "object") {
    instruction = instructionOrParams.instruction || instructionOrParams.instructions || "";
    doc = instructionOrParams.doc || docArg;
    if (instructionOrParams.patch?.ops) {
      patch = instructionOrParams.patch;
    } else if (instructionOrParams.patch) {
      // Synthesize ops if raw patch provided
      const rawPatch = instructionOrParams.patch;
      if (rawPatch.content) {
        patch = {
          version: "1.0",
          docId: "doc",
          ops: [
            {
              op: "set-text",
              target: { id: instructionOrParams.targetLayerId || "layer_1" },
              text: rawPatch.content,
            } as any,
          ],
        };
      } else if (rawPatch.fill || rawPatch.filters) {
        patch = {
          version: "1.0",
          docId: "doc",
          ops: [
            {
              op: "style-layer",
              target: { id: instructionOrParams.targetLayerId || "layer_1" },
              style: rawPatch,
            } as any,
          ],
        };
      } else if (rawPatch.layers || rawPatch.layoutType) {
        patch = {
          version: "1.0",
          docId: "doc",
          ops: [
            {
              op: "reorder-layers",
              target: { id: "canvas" },
              order: [],
            } as any,
          ],
        };
      }
    }
  }

  const lowerInstruction = (instruction || "").toLowerCase().trim();
  const ops = patch?.ops || [];
  const opTypes = ops.map((o) => o.op);

  // Check 1: Photo Swap
  if (
    PHOTO_KEYWORDS.some((kw) => lowerInstruction.includes(kw)) ||
    opTypes.includes("swap-asset" as any)
  ) {
    return {
      category: "PHOTO_SWAP",
      creditCost: 0,
      isFree: true,
      reason: "Asset & photo replacement (included free with pack)",
      allowedOperations: ["swap-asset", "nudge-layer"],
    };
  }

  // Check 2: Date / Time / Location Correction
  const hasOnlyTextOps = opTypes.length > 0 && opTypes.every((op) => op === "set-text");
  const isDateInstruction = DATE_TIME_KEYWORDS.some((kw) =>
    lowerInstruction.includes(kw),
  );

  const targetsDateSlot = patch.ops.some((op) => {
    if (op.op !== "set-text") return false;
    const target = (op as any).target;
    return (
      target?.slot === "date" ||
      target?.slot === "time" ||
      target?.slot === "location"
    );
  });

  if (hasOnlyTextOps && (isDateInstruction || targetsDateSlot)) {
    return {
      category: "DATE_TIME_CORRECTION",
      creditCost: 0,
      isFree: true,
      reason: "Date, time, or location correction (D-04: free and unlimited)",
      allowedOperations: ["set-text"],
    };
  }

  // Check 3: Text Correction (headline, offer, copy, CTA, details)
  if (hasOnlyTextOps) {
    return {
      category: "TEXT_CORRECTION",
      creditCost: 0,
      isFree: true,
      reason: "Typographic text correction (D-04: free and unlimited)",
      allowedOperations: ["set-text"],
    };
  }

  // Check 4: Structural Regeneration (recompose archetype, grid, layout bounds)
  if (opTypes.includes("recompose") || lowerInstruction.includes("layout") || lowerInstruction.includes("move")) {
    return {
      category: "STRUCTURAL_REGENERATION",
      creditCost: 1,
      isFree: false,
      reason: "Structural layout recomposition (metered compute: 1 credit)",
      allowedOperations: ["recompose", "set-text", "nudge-layer"],
    };
  }

  // Check 5: Creative Regeneration (palette change, font pairing swap, background change)
  return {
    category: "CREATIVE_REGENERATION",
    creditCost: 1,
    isFree: false,
    reason: "Creative redesign or palette change (metered compute: 1 credit)",
    allowedOperations: opTypes,
  };
}
