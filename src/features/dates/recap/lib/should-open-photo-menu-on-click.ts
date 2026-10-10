export function shouldOpenRecapPhotoMenuOnClick(
  detail: number,
  pointerType: string | null,
): boolean {
  // Keyboard activation.
  if (detail === 0) {
    return true;
  }

  // Desktop mouse click.
  // Touch and pen still require a long press.
  return pointerType === "mouse";
}
