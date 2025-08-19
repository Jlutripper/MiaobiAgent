/**
 * AI Schema Type Abstraction Layer
 *
 * This file provides a vendor-agnostic way to reference the type constants
 * required for building dynamic JSON schemas for AI models.
 *
 * We are currently using the enum from `@google/genai` because it provides a
 * convenient set of string constants that compile down to a standard JavaScript
 * object. By abstracting it here, we prevent higher-level services (like agent services)
 * from having a direct, semantic dependency on a specific SDK.
 *
 * If we were to switch to another AI provider that uses a different schema
 * definition method, we would only need to update or augment this file.
 */
import { Type as GeminiType } from "@google/genai";

export const SchemaType = GeminiType;
