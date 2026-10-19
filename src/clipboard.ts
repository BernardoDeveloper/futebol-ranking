type Writer = Pick<Clipboard, 'writeText'>;

// navigator.clipboard is typed as always present, but it is missing outside secure contexts.
function browserClipboard(): Writer | null {
  const nav = globalThis.navigator as Navigator | undefined;
  return nav?.clipboard ?? null;
}

/** Copies text to the clipboard; false when it could not, so the caller can show it for manual copying. */
export async function copyText(text: string, clipboard: Writer | null = browserClipboard()): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
