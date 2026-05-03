/**
 * Joins multiple URL parts into a single URL, ensuring exactly one slash between parts.
 * Handles trailing and leading slashes on any of the parts.
 */
export function joinUrl(base: string, ...parts: Array<string | null | undefined>): string {
  if (!base && parts.length === 0) return '';

  const allParts = [base, ...parts].filter(
    (p): p is string => p !== null && p !== undefined && p !== '',
  );

  if (allParts.length === 0) return '';

  return allParts.reduce((acc, part, index) => {
    // For the first part, we remove trailing slashes
    if (index === 0) return part.replace(/\/+$/, '');

    // For subsequent parts:
    // 1. Remove leading slashes from the current part
    const cleanPart = part.replace(/^\/+/, '');

    // 2. Combine with the accumulator using a single slash
    const joined = acc + '/' + cleanPart;

    // 3. If this is not the last part, remove trailing slashes from the result
    if (index < allParts.length - 1) {
      return joined.replace(/\/+$/, '');
    }

    // For the last part, keep it as is (preserving its own trailing slash if it had one)
    return joined;
  }, '');
}
