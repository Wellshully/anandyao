import { describe, expect, it } from "vitest";
import { displayAdventureText } from "./display-adventure-text";

describe("displayAdventureText", () => {
  it("converts literal escaped line breaks", () => {
    expect(displayAdventureText(String.raw`先餵食\n再玩耍`)).toBe("先餵食\n再玩耍");
    expect(displayAdventureText(String.raw`第一行\r\n第二行`)).toBe("第一行\n第二行");
  });
  it("keeps real newlines and normal text", () => {
    expect(displayAdventureText("你好\n世界")).toBe("你好\n世界");
    expect(displayAdventureText("萌蛋想吃飯")).toBe("萌蛋想吃飯");
  });
});
