/**
 * Generic JSON field parser for D1 database rows.
 * D1 stores JSON arrays/objects as strings; this safely parses them.
 */
export function parseJsonField<T>(value: string | T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }
  return value;
}

/**
 * Safely parses an AI-generated JSON array string.
 * Handles markdown code fences and extracts the array even from surrounding text.
 */
export function parseJsonArray(text: string): string[] {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("Could not parse generated output into a JSON array");
  }
}
