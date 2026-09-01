import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";
import { PlannerError, createLogger, env } from "@gdp/core";

const log = createLogger("planner:llm");

/** §31 — every call names the *task*, not the model. Routing lives in one place. */
export type LlmTask = "brief" | "planner" | "critic" | "editor";

export interface ImageInput {
  /** data:image/png;base64,… */
  dataUri: string;
}

export interface StructuredRequest<T> {
  task: LlmTask;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  images?: ImageInput[];
  maxTokens?: number;
  temperature?: number;
  /** Name shown to the model for the emitted object. */
  toolName?: string;
}

export interface StructuredResponse<T> {
  value: T;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export function modelFor(task: LlmTask): string {
  const e = env();
  switch (task) {
    case "brief":
      return e.MODEL_BRIEF;
    case "planner":
      return e.MODEL_PLANNER;
    case "critic":
      return e.MODEL_CRITIC;
    case "editor":
      return e.MODEL_EDITOR;
    default:
      return e.MODEL_PLANNER;
  }
}

export function llmConfigured(): boolean {
  const e = env();
  if (e.LLM_PROVIDER === "anthropic") return Boolean(e.ANTHROPIC_API_KEY);
  if (e.LLM_PROVIDER === "openai") return Boolean(e.OPENAI_API_KEY);
  return false;
}

function jsonSchemaFor<T>(schema: z.ZodType<T>): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

function parseOrThrow<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new PlannerError("Model returned a value that failed schema validation", {
      issues: parsed.error.issues.slice(0, 6),
    });
  }
  return parsed.data;
}

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

function anthropic(): Anthropic {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
  return anthropicClient;
}

function openai(): OpenAI {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: env().OPENAI_API_KEY });
  return openaiClient;
}

function splitDataUri(dataUri: string): { mediaType: string; data: string } {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUri);
  if (!match) throw new PlannerError("Images must be base64 data URIs");
  return { mediaType: match[1]!, data: match[2]! };
}

/**
 * One structured call. The model always returns a validated object — never
 * prose, never code, never an image (§63, §64).
 */
export async function structured<T>(request: StructuredRequest<T>): Promise<StructuredResponse<T>> {
  const provider = env().LLM_PROVIDER;
  const model = modelFor(request.task);
  const started = Date.now();

  if (!llmConfigured()) {
    throw new PlannerError(`No LLM configured (LLM_PROVIDER=${provider}) — using the deterministic planner instead`);
  }

  const schema = jsonSchemaFor(request.schema);
  const toolName = request.toolName ?? "emit_design_plan";

  try {
    if (provider === "anthropic") {
      const response = await anthropic().messages.create({
        model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
        system: request.system,
        tools: [
          {
            name: toolName,
            description: "Emit the structured result. This is the only allowed output.",
            input_schema: schema as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: "tool", name: toolName },
        messages: [
          {
            role: "user",
            content: [
              ...(request.images ?? []).map((image) => {
                const { mediaType, data } = splitDataUri(image.dataUri);
                return {
                  type: "image" as const,
                  source: { type: "base64" as const, media_type: mediaType as "image/png", data },
                };
              }),
              { type: "text" as const, text: request.prompt },
            ],
          },
        ],
      });

      const block = response.content.find((c) => c.type === "tool_use");
      if (!block || block.type !== "tool_use") throw new PlannerError("Model did not call the output tool");
      return {
        value: parseOrThrow(request.schema, block.input),
        model,
        provider,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        durationMs: Date.now() - started,
      };
    }

    const response = await openai().chat.completions.create({
      model,
      temperature: request.temperature ?? 0.7,
      max_completion_tokens: request.maxTokens ?? 4096,
      messages: [
        { role: "system", content: request.system },
        {
          role: "user",
          content: [
            ...(request.images ?? []).map((image) => ({
              type: "image_url" as const,
              image_url: { url: image.dataUri },
            })),
            { type: "text" as const, text: request.prompt },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: toolName, schema, strict: false },
      },
    });

    const content = response.choices[0]?.message.content ?? "";
    return {
      value: parseOrThrow(request.schema, JSON.parse(content)),
      model,
      provider,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    log.warn("structured call failed", { model, provider, error: String(error) });
    throw error instanceof PlannerError ? error : new PlannerError(String(error));
  }
}

/** Try the model; fall back to a deterministic result rather than failing a user's design. */
export async function structuredOrFallback<T>(
  request: StructuredRequest<T>,
  fallback: () => T,
): Promise<{ value: T; usedModel: boolean; model?: string }> {
  if (!llmConfigured()) return { value: fallback(), usedModel: false };
  try {
    const response = await structured(request);
    return { value: response.value, usedModel: true, model: response.model };
  } catch (error) {
    log.warn("falling back to the deterministic planner", { error: String(error) });
    return { value: fallback(), usedModel: false };
  }
}
