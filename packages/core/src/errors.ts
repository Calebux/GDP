export class GdpError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "GdpError";
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends GdpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("validation_failed", message, details);
    this.name = "ValidationError";
  }
}

export class QualityGateError extends GdpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("quality_gate_failed", message, details);
    this.name = "QualityGateError";
  }
}

export class PlannerError extends GdpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("planner_failed", message, details);
    this.name = "PlannerError";
  }
}

export class RenderError extends GdpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("render_failed", message, details);
    this.name = "RenderError";
  }
}
