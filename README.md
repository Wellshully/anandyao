# An & Yao

An & Yao 是一個以兩人共同生活為核心的私人 Web App。

目前主要包含：

- Personal / Today
- Calendar
- Journal
- Eat
- Dates
- Pet
- Study
- NTU Mail
- Web Push Notifications
- Background / Cron jobs

此專案目前是針對 An / Yao 兩個固定使用者設計，不是一般公開 SaaS。

---

# Tech Stack

- Next.js 16
- React 19
- TypeScript strict mode
- Supabase
  - Auth
  - PostgreSQL
  - RLS
  - Storage
  - RPC
  - pg_cron
  - pg_net
  - Vault
- Vercel
- Gemini / `@google/genai`
- Web Push / `web-push`
- Zod
- Tailwind CSS
- `react-markdown`
- `remark-gfm`

主要時區：

```text
Asia/Taipei
```

---

# Project Structure

```text
src/
├── app/
│   ├── (main)/
│   ├── api/
│   ├── auth/
│   └── login/
│
├── features/
│   ├── dates/
│   ├── eat/
│   ├── journal/
│   ├── notifications/
│   ├── pet/
│   ├── study/
│   └── today/
│
├── lib/
│   ├── auth/
│   ├── space/
│   └── supabase/
│
├── config/
│
└── types/
    └── database.ts

supabase/
├── migrations/
└── config.toml
```

核心原則：

```text
src/app
    Route / Page / API boundary

src/features
    Domain-specific business logic

src/lib
    Cross-domain infrastructure

supabase/migrations
    Database schema / security / RPC history
```

---

# Authentication Architecture

Supabase client 分成三種。

## Browser client

```text
src/lib/supabase/client.ts
```

只供 browser 使用。

## Server client

```text
src/lib/supabase/server.ts
```

使用登入使用者的 Supabase session，因此仍受 RLS 約束。

## Admin client

```text
src/lib/supabase/admin.ts
```

使用 Supabase secret/service credential。

此檔案有：

```ts
import "server-only";
```

Admin client 只能出現在可信任 server-side code。

不要把 admin client import 到 Client Component。

---

# Authentication / Space Boundary

主要 authenticated layout：

```text
src/app/(main)/layout.tsx
```

統一要求：

```text
requireUser()
requireSpace()
```

因此 `(main)` 底下的 page 不需要各自重複處理最基本的登入檢查。

目前 `getCurrentSpace()` 還有一個已知架構限制：

```text
.limit(1).maybeSingle()
```

因此目前實際假設：

```text
一個 user 只有一個主要 space
```

如果未來允許一個 user 加入多個 space，需要改成 deterministic current-space selection，或在 DB 明確 enforce single-space membership。

---

# Major Feature Domains

## Today / Personal Plans

處理個人行程與近期事項。

Notification reminder：

```text
Personal plan
→ 開始前 10 分鐘
→ Web Push
```

---

# Dates

Dates 是共同約會 / 行程 domain。

包含：

- Date creation
- Invitation
- Participants
- Multi-day itinerary
- Ordering
- Cancellation
- Archive
- Recap
- Recap media

Date reminder：

```text
Accepted Date
→ planning_start_time 前 1 小時
→ 對 accepted participants 發 Push
```

多日 Date 使用：

```text
date ID + date_day ID
```

作為 notification key 的一部分，因此每一天可以各提醒一次。

---

# Eat

包含：

- Restaurants
- Restaurant visits
- Contexts
- Cuisines
- Picker / recommendation UI

Eat domain 的 TypeScript type 會依賴：

```text
src/types/database.ts
```

如果突然出現大量：

```text
Parameter implicitly has an 'any' type
```

先檢查 `database.ts` 是否產生失敗，不要直接替 `.map()` callback 補 `: string` 掩蓋問題。

---

# Journal

Journal 支援 Markdown rendering。

目前 Markdown renderer：

```text
src/features/journal/components/MarkdownContent.tsx
```

使用：

```text
react-markdown
remark-gfm
```

目前 Pet Daily Report 也 reuse 這個 component。

已知架構整理項：

```text
pet → journal/components/MarkdownContent
```

這其實已經是 shared UI component，未來可移到：

```text
src/components/ui/MarkdownContent.tsx
```

但目前功能正常，不是高優先級問題。

---

# Pet Architecture

Pet 是共享的虛擬寵物 domain。

主要功能：

- Pet state
- Feed / Pet / Play
- Pet events
- Conversation
- Memory
- Tasks
- Daily Report
- Report settings

Pet AI 與一般 chat 不等於 Daily Report。

---

# Pet Tasks

Pet 可以透過對話建立 task。

重要日期語意：

```text
due_at
due_has_time
```

## Date-only task

例如：

```text
明天交作業
```

AI 回：

```text
YYYY-MM-DD
```

server 內部可以儲存成：

```text
23:59:59 +08
```

但：

```text
due_has_time = false
```

因此 UI / Daily Report 不應把這個 synthetic `23:59` 當成使用者真的指定的時間。

## Exact-time task

例如：

```text
明天早上 9 點回診
```

則：

```text
due_has_time = true
```

Daily Report 才可以顯示實際時間。

Pet Task title 也會移除：

```text
今天
明天
後天
日期文字
```

避免 title 裡的舊相對日期在隔天變成錯誤資訊。

---

# Pet Daily Report

Daily Report 與 Pet chat 分離。

資料來源包括：

```text
Dates
Study assignments
Pet Tasks
```

流程：

```text
report settings
      ↓
到達使用者設定時間
      ↓
get/create Daily Report
      ↓
Gemini
      ↓
pet_daily_reports
      ↓
Web Push
      ↓
/pet?view=report#pet-daily-report
```

Daily Report 使用 Markdown。

建議生成格式包含：

```md
## 今日／近期事項

- ...

## 萌蛋整理

...
```

---

# Daily Report Idempotency

Report 本身使用：

```text
(user_id, report_date)
```

唯一限制。

因此同一天 Push retry 時：

```text
不會重新產生 Gemini report
```

而是 reuse 已存在的 report。

---

# Notification Delivery Lease

原本架構：

```text
insert notification_deliveries
        ↓
視為已送過
```

有 crash recovery 問題。

如果 worker：

```text
INSERT 成功
→ Push 前 process 被 kill
```

unique row 會永久阻止 retry。

目前已改成 lease state machine。

主要欄位：

```text
status
claimed_at
claim_token
sent_at
```

狀態：

```text
processing
delivered
```

流程：

```text
claim
  ↓
processing + UUID token
  ↓
Push
  ↓
complete
  ↓
delivered
```

如果 worker crash：

```text
processing
  ↓
lease timeout
  ↓
另一 worker 可 reclaim
```

`claim_token` 用來避免舊 worker 在 lease 已被 reclaim 後，誤 complete/delete 新 worker 的 claim。

Notification lease 約：

```text
10 minutes
```

相關 helper：

```text
src/features/notifications/lib/notification-delivery-lease.ts
```

主要 RPC：

```text
claim_notification_delivery
complete_notification_delivery
release_notification_delivery_claim
```

這套機制目前用於：

```text
Personal reminder
Study assignment reminder
Date reminder
NTU Mail notification
```

---

# Daily Report Delivery Lease

`pet_report_deliveries` 也使用相同概念。

主要 RPC：

```text
claim_pet_report_delivery
complete_pet_report_delivery
release_pet_report_delivery_claim
```

helper：

```text
src/features/pet/report/report-delivery-lease.ts
```

Report generation 與 Push delivery 是兩個不同 state。

因此：

```text
Report 已產生
Push 沒有 device
```

只會 release delivery claim，不會刪除 report。

---

# Push Delivery Semantics

目前系統偏向：

```text
at-least-once
```

而不是 mathematically exactly-once。

例如：

```text
Push 已成功
↓
process 在 complete RPC 前突然死亡
↓
lease 過期
↓
有機會再 Push 一次
```

這種 external side effect 很難做到真正 exactly-once。

目前優先保證：

```text
不要因 crash 永久漏掉通知
```

同時用 lease 降低 duplicate 機率。

---

# Study Architecture

Study 整合：

```text
NTU COOL
NTU Mail
```

目前帳號是固定配置：

```text
An
Yao
```

因此 Study architecture 不是 arbitrary multi-user provider integration。

---

# NTU COOL Sync

主要檔案：

```text
src/features/study/lib/ntu-cool-client.ts
src/features/study/lib/sync-ntu-cool.ts
src/features/study/lib/ensure-study-fresh.ts
src/features/study/lib/study-sync-state.ts
src/features/study/lib/cool-sync-lease.ts
```

COOL client 已包含：

- session retry
- login redirect / HTML response detection
- safe pagination URL validation
- HTTPS requirement
- `cool.ntu.edu.tw` host restriction
- `/api/v1/` path restriction
- pagination
- max page protection

---

# COOL Snapshot Reconciliation

COOL sync 不只 upsert。

完整 snapshot 成功取得後會刪除：

```text
synced_at < current snapshot timestamp
```

的舊資料。

處理：

```text
study_courses
study_assignments
study_announcements
```

因此已從：

```text
只新增、不刪除
```

改為：

```text
remote snapshot reconciliation
```

避免 COOL 已刪除的 assignment 永遠留在 app。

重要原則：

```text
所有 remote fetch 成功後
才允許進行 stale cleanup
```

如果 COOL 中途失敗：

```text
保留舊 Supabase data
```

避免 partial fetch 把正常資料刪掉。

---

# COOL Concurrency Lease

因為 COOL sync 可以從兩個入口觸發：

```text
App
Background Cron
```

所以不能只靠 JavaScript in-memory mutex。

Vercel 不同 instance 仍可能同時執行。

目前已加入 DB-level per-user lease。

欄位：

```text
study_sync_state.cool_sync_claimed_at
study_sync_state.cool_sync_claim_token
```

主要 RPC：

```text
claim_cool_sync_lease
renew_cool_sync_lease
complete_cool_sync_lease
release_cool_sync_lease
```

lease 約：

```text
15 minutes
```

流程：

```text
Worker A
  ↓
claim token A
  ↓
fetch ALL remote COOL data

Worker B
  ↓
claim
  ↓
拿不到 lease
  ↓
skip

Worker A
  ↓
renew token A
  ↓
persist snapshot
  ↓
reconcile stale rows
  ↓
complete token A
```

如果 A 超時而 B 已 reclaim：

```text
A renew(old token)
→ false
→ A 不允許寫 DB
```

這防止舊 snapshot 覆蓋新 snapshot。

---

# Study Sync Heartbeat

不要再使用：

```text
最後一筆 course.synced_at
最後一筆 mail.synced_at
```

來判斷 provider 是否成功同步。

目前使用：

```text
study_sync_state
```

包含：

```text
cool_last_synced_at
mail_last_synced_at
```

`ensureStudyFresh()` 判斷的是：

```text
上一次成功完成 COOL sync 的時間

上一次成功完成 Mail sync 的時間
```

而不是：

```text
資料表最後一次有資料寫入的時間
```

這對以下狀況很重要：

```text
COOL legitimately returns 0 courses

Mailbox is empty

Mail 全部被 filter
```

這些情況仍然可以是一次「成功同步」。

---

# NTU Mail

主要檔案：

```text
src/features/study/mail/
```

使用 POP3 / TLS。

Mail sync：

```text
fetch recent headers
    ↓
filter
    ↓
upsert study_mail_messages
    ↓
mail heartbeat
    ↓
optional notification
```

---

# Mail Notification Baseline

第一次 background mail sync 不應突然把現有幾十封歷史信全部 Push。

因此有：

```text
mail:baseline:v1
```

以及每封既有 mail 的 notification delivery marker。

第一次同步：

```text
建立 baseline
↓
現有 mail 視為已處理
↓
不 Push 歷史 mail
```

空信箱也必須建立 baseline。

否則：

```text
第一次 sync = 0 封信
↓
沒有 baseline
↓
未來第一封新信
↓
被誤判為 initial mailbox
↓
Push 被 suppress
```

目前這個情況已在同步邏輯中處理。

---

# Notification Reminder Windows

目前三種 reminder：

```text
Personal
    10 minutes before start

Study Assignment
    within 24 hours before due_at

Date
    within 1 hour before planning_start_time
```

單筆 Push error 已在 `deliverOnce()` 隔離。

Notification delivery 也已使用 crash-recoverable lease。

---

# Reminder Category Failure Isolation

最後一次 architecture audit 發現：

```text
Personal
↓
Assignments
↓
Dates
```

原本是直接 sequential `await`。

因此如果：

```text
Personal query throws
```

則：

```text
Assignments 不跑
Dates 不跑
```

已提出修法：

```text
runReminderCategory(...)
```

讓每個 category 各自：

```text
try/catch
```

同時仍保持 sequential execution，不用 `Promise.all()` 突然增加 DB / Push concurrency。

IMPORTANT：

截至這份 README 產生時，本聊天室尚未收到「這個最後 reminder-category patch 已完成且 build 通過」的明確確認。

下一個聊天室應先確認：

```text
src/features/notifications/lib/run-notification-reminders.ts
```

是否已存在：

```ts
runReminderCategory(...)
```

如果已存在，再跑完整 verification。

---

# Background Jobs / Cron

目前主要 background endpoints：

```text
/api/notifications/reminders
/api/pet/daily-report
/api/study/background-sync
/api/study/mail-background-sync
```

大致排程：

```text
Notification reminders
    every minute

Pet Daily Report
    every minute

NTU Mail
    every 5 minutes

NTU COOL
    every 6 hours
```

Cron API 使用：

```text
Authorization: Bearer <CRON_SECRET>
```

Supabase pg_cron / pg_net 從 Vault 取得 secret。

不要把 `CRON_SECRET` 寫進 source code。

---

# Cron Design Notes

目前各 Cron route 還各自實作 Bearer secret validation。

未來可以抽成：

```text
src/lib/cron/...
```

共用 helper。

目前不是高優先級 bug。

---

# Environment Variables

目前 source 使用：

```env
AI_MODEL=

CRON_SECRET=

GEMINI_API_KEY=

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=

NEXT_PUBLIC_VAPID_PUBLIC_KEY=

SUPABASE_SECRET_KEY=

NTU_MAIL_HOST=
NTU_MAIL_PORT=

STUDY_AN_USER_ID=
STUDY_AN_COOL_USERNAME=
STUDY_AN_COOL_PASSWORD=
STUDY_AN_MAIL_USERNAME=
STUDY_AN_MAIL_PASSWORD=

STUDY_YAO_USER_ID=
STUDY_YAO_COOL_USERNAME=
STUDY_YAO_COOL_PASSWORD=
STUDY_YAO_MAIL_USERNAME=
STUDY_YAO_MAIL_PASSWORD=
```

`NODE_ENV` 由 runtime 管理。

IMPORTANT：

目前 `.env.example` 在 architecture audit 時是空的。

這是已知待整理項目。

不要把真實：

```text
password
Supabase secret key
Gemini API key
Cron secret
```

commit 到 repository。

---

# Supabase Security

Database 使用：

```text
RLS
minimum grants
server-only service role
```

之前已進行 remote-schema reconciliation 與 privilege hardening。

重要原則：

```text
RLS != table privilege
```

因此 authenticated / anon 不應拿到：

```text
TRUNCATE
MAINTAIN
REFERENCES
TRIGGER
```

之類不必要的 broad privileges。

新的 application tables 應：

```text
先 revoke
再 explicit grant minimum privileges
```

Admin-only RPC 應：

```text
revoke execute from public, anon, authenticated
grant execute to service_role
```

---

# Important Database Tables

主要 reliability tables：

```text
notification_deliveries
pet_report_deliveries
study_sync_runs
study_sync_state
```

主要 Study tables：

```text
study_courses
study_assignments
study_announcements
study_mail_messages
```

主要 Pet tables：

```text
pets
pet_events
pet_memories
pet_tasks
pet_daily_reports
pet_report_settings
pet_report_deliveries
```

---

# Supabase Type Generation

Database type：

```text
src/types/database.ts
```

不要直接使用：

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

因為 shell 會先 truncate `database.ts`。

如果 Supabase CLI generation 失敗，就會留下空檔案，導致整個 project 出現：

```text
database.ts is not a module
implicit any
```

應使用安全版本：

```bash
TMP="$(mktemp)"

if npx supabase gen types typescript --linked > "$TMP"; then
  if grep -q 'export type Database' "$TMP"; then
    mv "$TMP" "src/types/database.ts"
    echo "database.ts regenerated successfully."
  else
    echo "Generated file does not contain Database type."
    rm -f "$TMP"
    exit 1
  fi
else
  echo "Supabase type generation failed."
  rm -f "$TMP"
  exit 1
fi
```

之後：

```bash
npx tsc --noEmit
```

---

# Standard Verification

每次 architecture / database / server worker 修改後：

```bash
npx tsc --noEmit &&
npm run lint &&
npm run build
```

不要只看 dev server 能不能跑。

---

# Current Verification Status

目前最近明確確認：

```text
src/types/database.ts
```

已正常重新產生。

包含：

```text
cool_sync_claim_token
cool_sync_claimed_at

claim_cool_sync_lease
renew_cool_sync_lease
complete_cool_sync_lease
release_cool_sync_lease
```

並且：

```bash
npx tsc --noEmit
```

已通過。

但是在這份 README 產生前：

```text
最新 COOL lease 相關修改後的
npm run lint
npm run build
```

沒有在聊天室中得到最後一次明確成功確認。

因此下一次開始工作時，第一件事建議跑：

```bash
npx tsc --noEmit &&
npm run lint &&
npm run build
```

---

# Known / Deferred Architecture Items

以下目前不是正在修的項目，但 audit 已辨識。

## 1. Production test API endpoints

目前仍存在類似：

```text
/api/notifications/test/reminders
/api/study/test/*
```

其中部分 endpoint 有 side effect。

使用者已明確決定：

```text
暫時不要處理
```

下一個聊天室不要自動先刪除它們。

---

## 2. `.env.example`

目前是空的。

之後應補上 environment variable names，但不能包含真實 secret。

---

## 3. Single-space assumption

目前：

```text
getCurrentSpace()
→ limit(1)
```

如果未來支援 multiple spaces，要改。

---

## 4. Shared Markdown component

目前：

```text
Pet
→ Journal MarkdownContent
```

功能正常，但 domain ownership 不理想。

之後可以移到：

```text
src/components/ui/
```

---

## 5. Cron auth duplication

多個 API route 都各自做：

```text
Bearer CRON_SECRET validation
```

未來可抽共用 helper。

---

## 6. Pet task duplicate detection

目前已知：

```text
相同 normalized title
```

可能被判定為同一 task。

因此：

```text
同標題、不同日期
```

未來可能需要納入 due date 比對。

---

## 7. Daily Report no-device retries

如果使用者沒有有效 Push subscription：

```text
release delivery claim
```

而 Daily Report Cron 每分鐘執行。

因此 report time 過後，當天可能持續每分鐘 retry。

功能上不會重新生成 Gemini report，但仍可能造成不必要 worker activity。

之後可加入：

```text
retry backoff
next_attempt_at
```

---

## 8. Daily Report retention

目前沒有正式 retention policy。

未來可以決定例如：

```text
keep 30 / 90 / 180 days
```

---

## 9. Notification observability

Reminder category failure isolation 後，如果 category query 失敗：

```text
stats = 0
```

和「真的沒有 notification」看起來相同。

console log 能看到 error，但 API stats 無法區分。

未來可以改成：

```ts
{
  personal: {
    sent: 0,
    error: null
  }
}
```

之類的結構。

目前不是 blocker。

---

## 10. COOL explicit fetch timeout

COOL network layer 還可以再審 explicit timeout / AbortController。

目前已有 pagination safety 與 session handling，但 timeout 可以作為後續 hardening。

---

# Architecture Audit Status

這輪 audit 已主要處理：

```text
✅ Server / browser / admin Supabase boundary

✅ Authentication boundary

✅ RLS / privilege hardening

✅ Study stale snapshot reconciliation

✅ Notification delivery crash recovery

✅ Mail delivery crash recovery

✅ Daily Report delivery crash recovery

✅ Notification claim token protection

✅ Daily Report claim token protection

✅ Mail freshness heartbeat

✅ Empty-mailbox freshness

✅ Empty-mailbox baseline semantics

✅ COOL freshness heartbeat

✅ COOL concurrent sync lease

✅ COOL stale-worker token protection

🟡 Reminder category failure isolation
   patch proposed; verify whether applied

🟡 production /api/**/test/*
   deliberately deferred

🟡 single-space invariant

🟡 .env.example

🟡 shared Markdown ownership

🟡 Cron auth duplication

🟡 Pet same-title task matching

🟡 Daily Report retry/backoff

🟡 retention

🟡 observability
```

目前沒有已知未處理的 Critical architecture issue。

---

# Recommended Next Steps

下一個聊天室建議從這裡開始，不要重新從最早期 architecture audit 開始。

第一步：

```bash
git status --short

npx tsc --noEmit &&
npm run lint &&
npm run build
```

第二步確認：

```text
run-notification-reminders.ts
```

是否已經套用：

```text
runReminderCategory()
```

如果沒有，完成 reminder category failure isolation。

之後可以按照：

```text
1. .env.example
2. single-space invariant
3. Cron auth helper
4. shared Markdown component
5. Pet task duplicate semantics
6. Daily Report retry/backoff
7. retention
8. observability / tests
```

逐項整理。

Production test endpoints 目前使用者要求先不要動。

---

# ChatGPT Handoff Instructions

如果這份 README 是提供給新的 ChatGPT conversation：

請把本文件視為目前 project architecture 的 handoff baseline。

不要假設較舊聊天中的 source snapshot 還是最新版。

工作方式：

```text
1. 一次處理一個 architecture issue。
2. 修改前先確認最新版 source。
3. 不要一次大量 refactor。
4. DB change 使用 Supabase migration。
5. DB change 後重新 generate database.ts。
6. 使用安全 temporary-file type generation。
7. 每一輪跑 TypeScript / lint / build。
8. 保留 server/browser/admin security boundary。
9. Cron / worker 必須考慮 concurrency、idempotency、retry、crash recovery。
10. 不要重新處理使用者已明確 deferred 的 production test endpoints。
```

目前 project 的核心方向是：

```text
correctness
→ security
→ concurrency
→ crash recovery
→ maintainability
```

而不是為了「看起來乾淨」而優先做大規模重構。

---

# Local Development

一般開發：

```bash
npm run dev
```

完整驗證：

```bash
npx tsc --noEmit &&
npm run lint &&
npm run build
```

Supabase migration：

```bash
npx supabase migration new <migration_name>
```

先確認：

```bash
npx supabase db push --dry-run
```

再：

```bash
npx supabase db push
```

然後安全重新產生 DB types。

---

# Deployment

目前 deployment：

```text
Vercel
+
Supabase
```

Background jobs 主要由：

```text
Supabase pg_cron
→ pg_net
→ Vercel API routes
```

觸發。

Cron secret 儲存在 Supabase Vault，HTTP request 使用 Bearer Authorization。

Production deploy 前至少確認：

```bash
npx tsc --noEmit &&
npm run lint &&
npm run build
```

以及：

```text
Supabase migrations 已 push
Vercel env 已設定
Cron secret 一致
VAPID keys 一致
Study credentials 存在
```

---

# Security Rule of Thumb

永遠維持：

```text
Browser
  ↓
RLS-protected Supabase client

Server authenticated action
  ↓
session-aware server client

Trusted background worker
  ↓
server-only admin client
```

不要為了方便，把：

```text
SUPABASE_SECRET_KEY
Gemini key
Study password
CRON_SECRET
```

帶到 browser bundle。

---

# Project State Summary

目前專案已經從「功能優先」進入：

```text
architecture stabilization / reliability hardening
```

階段。

近期最重要的改進是：

```text
notification delivery lease
Daily Report delivery lease
Mail delivery lease
provider-level Study heartbeat
COOL stale-data reconciliation
COOL per-user synchronization lease
```

所以後續修改時，不要退回：

```text
INSERT row = already delivered

data row timestamp = provider freshness

multiple sync workers freely writing same snapshot
```

這些舊語意。
