// Client-safe constants (no Zod) for CSV import limits. Shared by client components and server code.
export const IMPORT_MAX_BYTES = 1_000_000;
export const IMPORT_MAX_ROWS = 5000;
export const IMPORT_FILE_NAME_MAX = 200;

/** Same limit as a manually entered category (finance.schema.ts). */
export const IMPORT_CATEGORY_MAX = 160;
