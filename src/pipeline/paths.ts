import { join, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '..', '..');
export const DATA_DIR = process.env.ITEMIZE_DATA_DIR ?? join(ROOT, 'data');

/** Untouched upstream files for one patch. A cache: safe to delete, never shipped. */
export const rawDir = (patch: string) => join(DATA_DIR, 'raw', patch);
/** The compiled dataset the engine and the API read. */
export const distDir = (patch: string) => join(DATA_DIR, 'dist', patch);
/** Dev-only third-party reference data used to cross-check models. Never shipped. */
export const crosscheckDir = () => join(DATA_DIR, 'crosscheck');
