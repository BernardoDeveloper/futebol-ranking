import { describe, expect, it } from 'vitest';
import { copyText } from '../src/clipboard';

describe('copyText (R4.2, R4.3)', () => {
  it('writes the text to the clipboard and reports success', async () => {
    let written = '';
    const ok = await copyText('Ana - 8.7', {
      writeText: (t) => {
        written = t;
        return Promise.resolve();
      },
    });
    expect(ok).toBe(true);
    expect(written).toBe('Ana - 8.7');
  });

  it('reports failure when the clipboard write is refused', async () => {
    const ok = await copyText('x', { writeText: () => Promise.reject(new Error('denied')) });
    expect(ok).toBe(false);
  });

  it('reports failure when there is no clipboard', async () => {
    expect(await copyText('x', null)).toBe(false);
  });
});
