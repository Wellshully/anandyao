/** Gemini can return a literal backslash+n; show it as a real line break. */
export function displayAdventureText(input: string): string {
  return input.replace(/\\r\\n|\\n|\\r/g, "\n").replace(/\r\n?/g, "\n");
}
