"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  choosePetAdventureRewardAction,
  startPetAdventureSecondQuestAction,
  discardPetAdventureRewardAction,
  equipPetAdventureRewardAction,
  getPetAdventureStateAction,
  generatePetAdventureRewardImageAction,
  confirmPetAdventureCoupleQuestAction,
  movePetAdventureDecorationAction,
  resizePetAdventureDecorationAction,
  rerollPetAdventureTestQuestAction,
  unlockPetAdventureTestRewardAction,
  type PetAdventureState,
} from "./actions";
import { rewardAppearance, ROOMS } from "./catalog";
import { displayAdventureText } from "./display-adventure-text";

type Props = { refreshSignal: number };
type Reward = PetAdventureState["rewards"][number];

function isDiscardedChoice(choice: Reward["choice"]) {
  return choice === "discarded";
}

function timeLeft(iso: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(iso) - now) / 1000));
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remaining = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remaining}`;
}

const smallButton = "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium transition hover:border-[var(--foreground)] disabled:cursor-wait disabled:opacity-50";
const strongButton = "rounded-xl bg-[var(--foreground)] px-3 py-2 text-xs font-medium text-[var(--on-foreground)] disabled:cursor-wait disabled:opacity-50";

export default function PetAdventure({ refreshSignal }: Props) {
  const [data, setData] = useState<PetAdventureState | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"quest" | "room">("quest");
  const [editingFurniture, setEditingFurniture] = useState(false);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [sizePending, setSizePending] = useState(false);

  const roomRef = useRef<HTMLDivElement>(null);

  const pointerRef = useRef<{
    pointerId: number;
    itemId: string;
    offsetX: number;
    offsetY: number;
    moved: boolean;
    startX: number;
    startY: number;
  } | null>(null);

  const positionRef = useRef<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const [dragPosition, setDragPosition] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const [positionPending, setPositionPending] = useState(false);

  useEffect(() => {
    let live = true;
    async function refresh() {
      try {
        const result = await getPetAdventureStateAction();
        if (live) {
          setData(result);
          setError("");
          setNow(Date.now());
        }
      } catch {
        if (live) setError("每日冒險暫時無法載入，請確認資料庫 Migration 已套用。");
      }
    }
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    const clock = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    const polling = window.setInterval(() => { void refresh(); }, 60000);
    return () => {
      live = false;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(clock);
      window.clearInterval(polling);
    };
  }, [refreshSignal]);

  // Reveal the gift as soon as the server permits it, even if the normal
  // one-minute refresh has not run yet.
  useEffect(() => {
    const locked = data?.rewards.find(
      (item) => item.choice === null && item.title === "神祕禮物",
    );
    if (!locked) return;
    const delay = Math.max(0, Date.parse(locked.availableAt) - Date.now() + 400);
    const timer = window.setTimeout(() => {
      void getPetAdventureStateAction()
        .then((value) => setData(value))
        .catch(() => setError("禮物揭曉失敗，請稍後再試。"));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [data]);

  async function change(
    id: string,
    action: "accept" | "decline" | "equip" | "unequip" | "discard",
  ) {
    if (busy) return;
    setBusy(id);
    setError("");
    try {
      let result: { success: boolean; error?: string };
      if (action === "accept" || action === "decline") {
        result = await choosePetAdventureRewardAction(id, action);
      } else if (action === "discard") {
        result = await discardPetAdventureRewardAction(id);
      } else {
        result = await equipPetAdventureRewardAction(id, action === "equip");
      }
      if (!result.success) {
        setError(result.error ?? "操作失敗，請稍後再試。");
      }
      setData(await getPetAdventureStateAction());
    } catch {
      setError("連線失敗，請重新整理後再試。");
    } finally {
      setBusy(null);
    }
  }

  async function runTestAction(kind: "reroll" | "unlock") {
    if (busy || !data?.debugEnabled) return;

    setBusy(kind);
    setError("");

    try {
      const result = kind === "reroll"
        ? await rerollPetAdventureTestQuestAction()
        : await unlockPetAdventureTestRewardAction();

      if (!result.success) {
        setError(result.error ?? "測試操作失敗。");
      }

      setData(await getPetAdventureStateAction());
    } catch {
      setError("測試操作連線失敗。");
    } finally {
      setBusy(null);
    }
  }


  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, item: Reward) {
    if (!editingFurniture || busy || positionPending || !roomRef.current) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.pointerType === "touch") event.preventDefault();
    const box = roomRef.current.getBoundingClientRect();

    if (!box.width || !box.height) return;

    const x = item.positionX;
    const y = item.positionY;

    pointerRef.current = {
      pointerId: event.pointerId,
      itemId: item.id,
      offsetX: event.clientX - box.left - x * box.width,
      offsetY: event.clientY - box.top - y * box.height,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
    };

    positionRef.current = { id: item.id, x, y };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const pointer = pointerRef.current;
    const box = roomRef.current?.getBoundingClientRect();

    if (
      !pointer ||
      pointer.pointerId !== event.pointerId ||
      !box?.width ||
      !box.height
    ) {
      return;
    }

    if (event.pointerType === "touch") event.preventDefault();

    const x = Math.max(
      0.08,
      Math.min(
        0.92,
        (event.clientX - box.left - pointer.offsetX) / box.width,
      ),
    );

    const y = Math.max(
      0.10,
      Math.min(
        0.90,
        (event.clientY - box.top - pointer.offsetY) / box.height,
      ),
    );

    if (
      Math.hypot(
        event.clientX - pointer.startX,
        event.clientY - pointer.startY,
      ) >= 4
    ) {
      pointer.moved = true;
    }

    const next = {
      id: pointer.itemId,
      x,
      y,
    };

    positionRef.current = next;
    setDragPosition(next);
  }

  async function endDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const pointer = pointerRef.current;

    if (!pointer || pointer.pointerId !== event.pointerId) {
      return;
    }

    moveDrag(event);
    pointerRef.current = null;

    const last = positionRef.current;

    if (!pointer.moved || !last || last.id !== pointer.itemId) {
      setDragPosition(null);
      return;
    }

    setPositionPending(true);
    setError("");

    try {
      const result = await movePetAdventureDecorationAction(
        last.id,
        last.x,
        last.y,
      );

      if (!result.success) {
        setError(result.error ?? "位置儲存失敗");
      }

      setData(await getPetAdventureStateAction());
    } catch {
      setError("位置儲存失敗，請重新整理後再試。");
    } finally {
      setPositionPending(false);
      setDragPosition(null);
      positionRef.current = null;
    }
  }

  function cancelDrag() {
    pointerRef.current = null;
    positionRef.current = null;
    setDragPosition(null);
  }


  async function resizeFurniture(item: Reward, newScale: number) {
    if (!editingFurniture || busy || sizePending || positionPending) {
      return;
    }

    const scale = Math.round(newScale * 4) / 4;

    if (
      scale < 0.5 ||
      scale > 2 ||
      scale === item.sizeScale
    ) {
      return;
    }

    setSizePending(true);
    setError("");

    try {
      const result = await resizePetAdventureDecorationAction(
        item.id,
        scale,
      );

      if (!result.success) {
        setError(result.error ?? "家具大小儲存失敗。");
      }

      setData(await getPetAdventureStateAction());
    } catch {
      setError("家具大小儲存失敗，請重新整理後再試。");
    } finally {
      setSizePending(false);
    }
  }

  async function confirmCoupleQuest(confirmed: boolean) {
    if (!data || busy || data.quest.mode !== "couple") return;
    setBusy("confirm");
    setError("");
    try {
      const result = await confirmPetAdventureCoupleQuestAction(data.quest.id, confirmed);
      if (!result.success) setError(result.error ?? "任務確認失敗。");
      setData(await getPetAdventureStateAction());
    } catch {
      setError("任務確認失敗，請重新整理後再試。");
    } finally {
      setBusy(null);
    }
  }

  async function startSecondQuest() {
    if (!data || busy || !data.quest.canStartSecondRound) return;
    setBusy("second-round");
    setError("");
    try {
      const result = await startPetAdventureSecondQuestAction();
      if (!result.success) {
        setError(result.error ?? "無法開始第二次任務。");
      }
      setData(await getPetAdventureStateAction());
    } catch {
      setError("建立第二次任務失敗，請重新整理後再試。");
    } finally {
      setBusy(null);
    }
  }

  async function createGiftImage(id: string) {
    if (busy) return;

    if (!window.confirm(
      "這會呼叫付費 Gemini 圖片 API 一次，確定繼續？",
    )) return;

    setBusy(id);
    setError("");

    try {
      const result = await generatePetAdventureRewardImageAction(id);

      if (!result.success) {
        setError(result.error ?? "圖片生成失敗。");
      }

      setData(await getPetAdventureStateAction());
    } catch {
      setError("圖片生成請求失敗，請查看伺服器紀錄。");
    } finally {
      setBusy(null);
    }
  }

  const latest = data?.rewards.find((reward) => reward.isToday);
  const inventory = data?.rewards.filter((reward) => reward.choice === "accepted") ?? [];
  const roomGift = inventory.find((reward) => reward.kind === "room" && reward.equipped);
  const decorGifts = inventory.filter(
    (reward) => reward.kind === "decor" && reward.equipped,
  );
  const selectedFurniture = decorGifts.find(
    (item) => item.id === selectedFurnitureId,
  );
  const storedCount = inventory.filter(
    (reward) => !reward.equipped,
  ).length;
  const room = roomGift ? rewardAppearance("room", roomGift.variant) : ROOMS[0];

  return (
    <section className="mx-auto mt-2 w-full max-w-6xl sm:mt-4">
      <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
        <header className="flex items-center justify-between gap-3 px-5 py-5">
          <div className="flex flex-col gap-1">
            <h1 className="font-story text-xl font-semibold">萌蛋的每日冒險</h1>
            <span className="text-xs text-[var(--muted)]">
              {data
                ? data.quest.completedAt
                  ? latest?.choice === "accepted" ? "今日任務完成 · 禮物已收藏"
                    : latest?.choice === "discarded" ? "今日任務完成"
                      : "今日任務完成 · 有神祕禮物"
                  : `今日任務 ${data.quest.progress}/${data.quest.goal}`
                : "每日任務、神祕禮物與小房間"}
            </span>
          </div>
          <Link href="/pet" className="shrink-0 text-xs text-[var(--muted)] underline-offset-4 hover:underline">
            返回萌蛋
          </Link>
        </header>

        <div className="border-t border-[var(--border)] px-4 pb-5 pt-4 sm:px-5">
          <div className="mb-4 flex gap-2">
            <button type="button" onClick={() => setTab("quest")}
              className={`${smallButton} ${tab === "quest" ? "border-[var(--foreground)]" : ""}`}>
              今日任務
            </button>
            <button type="button" onClick={() => setTab("room")}
              className={`${smallButton} ${tab === "room" ? "border-[var(--foreground)]" : ""}`}>
              小房間 · 收藏
            </button>
          </div>

          {error && <p role="alert" className="mb-3 text-sm text-[var(--danger)]">{error}</p>}
          {!data && !error && <p className="text-sm text-[var(--muted)]">讀取今日冒險中……</p>}

          {data && tab === "quest" && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-[var(--surface-soft)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-story font-semibold">{displayAdventureText(data.quest.title)}</h3>
                  <span className="shrink-0 text-xs text-[var(--muted)]">
                    {data.today}{data.quest.maxRounds === 2 ? ` · 第 ${data.quest.round}/2 次` : ""}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-6">{displayAdventureText(data.quest.story)}</p>
                <p className="mt-3 text-xs text-[var(--muted)]">
                  {data.quest.completedAt ? "已完成" : data.quest.mode === "couple"
                    ? "雙人互動 · 需要兩位玩家各自確認"
                    : `任務：${data.quest.actionLabel} ${data.quest.goal} 次`}
                  {" · "}{data.quest.progress}/{data.quest.goal}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface)]">
                  <div className="h-full rounded-full bg-[var(--accent)] transition-all"
                    style={{ width: `${Math.min(100, 100 * data.quest.progress / data.quest.goal)}%` }} />
                </div>
                {!data.quest.completedAt && data.quest.mode === "couple" && (
                  <div className="mt-4 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <p className="text-sm font-medium">雙人確認：{data.quest.progress}/2</p>
                    <p className="text-xs text-[var(--muted)]">
                      {data.quest.myConfirmed ? "你已確認 · 等待另一位玩家" : "你尚未確認"}
                      {" · "}{data.quest.progress === 2 ? "雙方已確認" : "完成互動後，各自按下確認"}
                    </p>
                    {!data.quest.pairReady && (
                      <p className="text-xs text-[var(--danger)]">目前共用空間不是剛好兩位成員，請先檢查帳號綁定。</p>
                    )}
                    {data.quest.myConfirmed ? (
                      <button type="button" className={smallButton}
                        disabled={!!busy || !data.quest.pairReady}
                        onClick={() => void confirmCoupleQuest(false)}>
                        取消我的確認
                      </button>
                    ) : (
                      <button type="button" className={strongButton}
                        disabled={!!busy || !data.quest.pairReady}
                        onClick={() => void confirmCoupleQuest(true)}>
                        我確認已完成互動
                      </button>
                    )}
                  </div>
                )}
                {!data.quest.completedAt && data.quest.mode === "pet_actions" && (
                  <p className="mt-2 text-xs text-[var(--muted)]">前往萌蛋頁面，使用「{data.quest.actionLabel}」按鈕累積進度。兩個人可以一起完成。</p>
                )}
              </div>
              {data.debugEnabled && (
                <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-3">
                  <p className="text-xs text-[var(--muted)]">
                    本機測試工具 · 不影響已收藏的禮物
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={smallButton}
                      disabled={!!busy}
                      onClick={() => void runTestAction("reroll")}
                    >
                      重新抽測試任務
                    </button>
                    {latest?.choice === null &&
                      now < Date.parse(latest.availableAt) && (
                        <button
                          type="button"
                          className={strongButton}
                          disabled={!!busy}
                          onClick={() => void runTestAction("unlock")}
                        >
                          立即開箱（測試）
                        </button>
                      )}
                  </div>
                </div>
              )}
              {latest ? (
                <div className="rounded-2xl border border-[var(--border)] p-4">
                  <h3 className="font-story font-semibold">萌蛋的神祕禮物</h3>

                  {latest.imageUrl && (
                    <div
                      role="img"
                      aria-label={`${latest.title}的 AI 圖片`}
                      className="mx-auto mt-3 h-44 w-44 rounded-xl border border-[var(--border)] bg-contain bg-center bg-no-repeat"
                      style={{
                        backgroundImage: `url("${latest.imageUrl}")`,
                      }}
                    />
                  )}

                  {data.imageTestEnabled &&
                    latest.choice === "accepted" && (
                      <div className="mt-3 text-center">
                        {latest.imageStatus === "none" ? (
                          <button
                            type="button"
                            className={smallButton}
                            disabled={!!busy}
                            onClick={() => void createGiftImage(latest.id)}
                          >
                            用 AI 製作這件禮物的圖片（付費測試）
                          </button>
                        ) : (
                          <p className="text-xs text-[var(--muted)]">
                            {latest.imageStatus === "ready"
                              ? "AI 圖片已保存"
                              : latest.imageStatus === "generating"
                                ? "AI 圖片正在生成"
                                : "AI 圖片生成失敗，保留原本樣板"}
                          </p>
                        )}
                      </div>
                    )}
                  {now < Date.parse(latest.availableAt) ? (
                    <div className="py-4 text-center">
                      <div className="text-5xl" role="img" aria-label="包裝中的禮物">🎁</div>
                      <p className="mt-3 text-sm">萌蛋正在準備禮物……</p>
                      <p className="mt-1 text-xs tabular-nums text-[var(--muted)]">
                        {now ? `${timeLeft(latest.availableAt, now)} 後可以開箱` : "準備中"}
                      </p>
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <div className="text-6xl" role="img" aria-label={latest.title}>
                        {rewardAppearance(latest.kind, latest.variant).emoji}
                      </div>
                      <h4 className="mt-3 font-story text-lg font-semibold">{latest.title}</h4>
                      <p className="mt-1 text-xs text-[var(--muted)]">{latest.kind === "room" ? "新房間背景" : "房間擺飾"}</p>
                      <p className="mt-2 whitespace-pre-line text-sm">{displayAdventureText(latest.story)}</p>
                      {latest.choice === null ? (
                        <div className="mt-4 flex justify-center gap-3">
                          <button type="button" disabled={!!busy} onClick={() => void change(latest.id, "accept")} className={strongButton}>收下禮物</button>
                          <button type="button" disabled={!!busy} onClick={() => void change(latest.id, "decline")} className={smallButton}>不要這件</button>
                        </div>
                      ) : isDiscardedChoice(latest.choice) ? (
                        <p className="mt-3 text-sm text-[var(--muted)]">這份禮物已放棄，不會加入收藏。</p>
                      ) : isDiscardedChoice(latest.choice) ? (
                        <p className="mt-3 text-sm text-[var(--muted)]">這份禮物已放棄，不會加入收藏。</p>
                      ) : (
                        <p className="mt-3 text-sm text-[var(--muted)]">已收藏，可前往「小房間」擺放。</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-center text-sm text-[var(--muted)]">
                  完成今日任務後，萌蛋會準備一件神祕禮物。
                </div>
              )}
              {data.quest.maxRounds === 2 && data.quest.round === 1 && data.quest.completedAt && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                  <p className="text-sm font-medium">10 月 13 日限定：可再完成一次任務、獲得第二份禮物。</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">第一份禮物需先開箱並選擇收下或放棄；兩次共用原本的每日 AI 圖片額度。</p>
                  <button
                    type="button"
                    className={`${strongButton} mt-3`}
                    disabled={!!busy || !data.quest.canStartSecondRound}
                    onClick={() => void startSecondQuest()}
                  >
                    {data.quest.canStartSecondRound ? "開始今日第 2 次任務" : "請先處理第一份禮物"}
                  </button>
                </div>
              )}
            </div>
          )}

          {data && tab === "room" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[var(--muted)]">
                  {editingFurniture ? "編輯中 · 拖曳家具調整位置" : "家具已鎖定，避免誤觸"}
                </span>

                <button
                  type="button"
                  disabled={!!busy || positionPending}
                  onClick={() => {
                    cancelDrag();
                    setEditingFurniture((current) => !current);
                  }}
                  className={editingFurniture ? strongButton : smallButton}
                >
                  {editingFurniture ? "完成編輯" : "編輯家具"}
                </button>
              </div>
              <div
                ref={roomRef}
                className="relative isolate h-[55dvh] min-h-[20rem] max-h-[36rem] w-full overflow-hidden rounded-2xl sm:h-[60dvh]"
                style={{
                  background: room.bg,
                  // Disable browser pan/scroll arbitration only inside the editing canvas.
                  touchAction: editingFurniture ? "none" : "pan-y",
                  overscrollBehavior: editingFurniture ? "contain" : "auto",
                }}
              >
                {roomGift?.imageUrl && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-x-[10%] -top-[10%] -bottom-[22%] z-0 bg-cover bg-center bg-no-repeat"
                    style={{
                      backgroundImage: `url("${roomGift.imageUrl}")`,
                      backgroundPosition: "center 35%",
                    }}
                  />
                )}

                {!roomGift?.imageUrl && (
                  <>
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[26%] bg-black/10"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute left-[9%] top-[12%] z-0 h-20 w-20 rounded-full border-4 border-white/30 bg-white/20 sm:h-28 sm:w-28"
                    />
                  </>
                )}

                <div className="pointer-events-none absolute bottom-[12%] left-1/2 z-20 -translate-x-1/2">
                  <Image
                    src="/pet/pet00.png"
                    alt="房間裡的萌蛋"
                    width={256}
                    height={256}
                    className="h-48 w-48 object-contain drop-shadow-lg sm:h-64 sm:w-64"
                  />
                </div>
                {decorGifts.map((item) => {
                  const pos = dragPosition?.id === item.id
                    ? dragPosition
                    : {
                        x: item.positionX,
                        y: item.positionY,
                      };

                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!editingFurniture || !!busy || positionPending || sizePending}
                      aria-label={`移動${item.title}：先開啟編輯家具，再拖曳`}
                      title={item.title}
                      data-pet-furniture="true"
                      aria-pressed={editingFurniture && selectedFurnitureId === item.id}
                      onPointerDown={(event) => {
                        setSelectedFurnitureId(item.id);
                        startDrag(event, item);
                      }}
                      onPointerMove={moveDrag}
                      onPointerUp={(event) => void endDrag(event)}
                      onPointerCancel={cancelDrag}
                      onDragStart={(event) => event.preventDefault()}
                      className={`absolute z-[60] flex h-24 w-24 select-none items-center justify-center rounded-full drop-shadow-md sm:h-[7.5rem] sm:w-[7.5rem] ${
                        editingFurniture
                          ? selectedFurnitureId === item.id
                            ? "touch-none cursor-grab ring-2 ring-[var(--accent)] active:cursor-grabbing"
                            : "touch-none cursor-grab ring-2 ring-white/70 active:cursor-grabbing"
                          : "pointer-events-none"
                      }`}
                      style={{
                        left: `${pos.x * 100}%`,
                        top: `${pos.y * 100}%`,
                        transform: `translate(-50%, -50%) scale(${item.sizeScale})`,
                      }}
                    >
                      {item.imageUrl ? (
                        <span
                          role="img"
                          aria-label={item.title}
                          className="pointer-events-none block h-full w-full shrink-0 bg-contain bg-center bg-no-repeat"
                          style={{
                            backgroundImage: `url("${item.imageUrl}")`,
                          }}
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none inline-block shrink-0 select-none"
                          style={{
                            fontSize: "clamp(5.5rem, 22.5vw, 7rem)",
                            lineHeight: 1,
                          }}
                        >
                          {rewardAppearance("decor", item.variant).emoji}
                        </span>
                      )}
                    </button>
                  );
                })}
                <span className="pointer-events-none absolute bottom-2 left-3 z-[70] rounded-full bg-white/70 px-2 py-1 text-xs text-gray-800">{room.title}</span>
              </div>
              {editingFurniture && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                  {selectedFurniture ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        已選取：{selectedFurniture.title} · {selectedFurniture.sizeScale.toFixed(2)}×
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className={smallButton}
                          disabled={!!busy || positionPending || sizePending || selectedFurniture.sizeScale <= 0.5}
                          onClick={() => void resizeFurniture(
                            selectedFurniture,
                            selectedFurniture.sizeScale - 0.25,
                          )}
                        >
                          縮小 −
                        </button>

                        <button
                          type="button"
                          className={smallButton}
                          disabled={!!busy || positionPending || sizePending || selectedFurniture.sizeScale >= 2}
                          onClick={() => void resizeFurniture(
                            selectedFurniture,
                            selectedFurniture.sizeScale + 0.25,
                          )}
                        >
                          放大 ＋
                        </button>

                        <button
                          type="button"
                          className={smallButton}
                          disabled={!!busy || positionPending || sizePending || selectedFurniture.sizeScale === 1}
                          onClick={() => void resizeFurniture(
                            selectedFurniture,
                            1,
                          )}
                        >
                          重設 1×
                        </button>
                      </div>

                      <p className="text-xs text-[var(--muted)]">
                        0.5×～2×，每次調整 0.25×，每件家具獨立儲存。
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">
                      點選房間內任一家具，再調整大小。
                    </p>
                  )}
                </div>
              )}
              <p className="text-xs text-[var(--muted)]">房間最多擺放 10 件，倉庫最多存放 50 件。點「編輯家具」後可逐件拖曳，放開就會儲存位置。</p>
              <h3 className="font-story font-semibold">收藏與倉庫（倉庫 {storedCount}/50 · 房間 {decorGifts.length}/10）</h3>
              {inventory.length === 0 ? (
                <p className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm text-[var(--muted)]">目前還沒有收藏。先完成任務、開箱並收下禮物吧。</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {inventory.map((item: Reward) => (
                    <div key={item.id} className="rounded-2xl border border-[var(--border)] p-3">
                      <div className="flex items-center gap-3">
                        <span role="img" aria-label={item.title} className="text-4xl">{item.imageUrl ? (
                    <span
                      role="img"
                      aria-label={item.title}
                      className="inline-block h-12 w-12 shrink-0 bg-contain bg-center bg-no-repeat"
                      style={{
                        backgroundImage: `url("${item.imageUrl}")`,
                      }}
                    />
                  ) : rewardAppearance(item.kind, item.variant).emoji}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{item.title}</p>
                          <p className="text-xs text-[var(--muted)]">{item.kind === "room" ? "房間背景" : "擺飾"}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" disabled={!!busy} className={strongButton}
                          onClick={() => void change(item.id, item.equipped ? "unequip" : "equip")}>
                          {item.equipped ? "收起擺設" : item.kind === "room" ? "使用房間" : "放進房間"}
                        </button>
                        <button type="button" disabled={!!busy} className={smallButton}
                          onClick={() => {
                            if (window.confirm(`確定丟棄「${item.title}」嗎？這個動作無法復原。`)) {
                              void change(item.id, "discard");
                            }
                          }}>
                          丟棄
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
