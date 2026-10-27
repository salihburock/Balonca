export type ParseErrorCode =
  | 'empty'
  | 'binary'
  | 'html-page'
  | 'unknown-format'
  | 'invalid-json'
  | 'bad-shape'
  | 'no-cues';

/** Thrown for any subtitle that cannot be read. `code` maps to a translated, human message in the UI. */
export class SubtitleParseError extends Error {
  constructor(
    public readonly code: ParseErrorCode,
    public readonly detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'SubtitleParseError';
  }
}
