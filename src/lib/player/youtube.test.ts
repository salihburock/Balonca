import { describe, expect, it } from 'vitest';
import { parseVideoId } from './youtube';

describe('parseVideoId', () => {
  it.each([
    ['https://youtu.be/abcdefghijk', 'abcdefghijk'],
    ['https://www.youtube.com/watch?v=abcdefghijk&t=30s', 'abcdefghijk'],
    ['https://www.youtube.com/watch?feature=share&v=abcdefghijk', 'abcdefghijk'],
    ['https://m.youtube.com/shorts/abcdefghijk', 'abcdefghijk'],
    ['https://www.youtube.com/embed/abcdefghijk?start=5', 'abcdefghijk'],
    ['https://www.youtube.com/live/abcdefghijk', 'abcdefghijk'],
    ['  abcdefghijk  ', 'abcdefghijk'],
    ['https://example.com/watch?v=short', null],
    ['hello world', null],
    ['', null],
    ['https://youtu.be/abcdefghijkEXTRA', null],
  ])('%s', (input, id) => expect(parseVideoId(input)).toBe(id));
});
