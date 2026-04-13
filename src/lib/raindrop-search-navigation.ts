export function getCycledSearchResultIndex(
  currentIndex: number | null,
  direction: 'next' | 'previous',
  totalResults: number,
) {
  if (totalResults <= 0) {
    return null;
  }

  if (currentIndex === null || currentIndex < 0 || currentIndex >= totalResults) {
    return direction === 'next' ? 0 : totalResults - 1;
  }

  if (direction === 'next') {
    return (currentIndex + 1) % totalResults;
  }

  return (currentIndex - 1 + totalResults) % totalResults;
}
