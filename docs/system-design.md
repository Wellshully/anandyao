# An & Yao — System Design

## 1. Purpose

An & Yao 最初是一個提供兩位使用者共同生活功能的 Web App。

目前系統已包含：

- Calendar
- Google Calendar integration
- Study / NTU COOL sync
- Personal plans
- Pet tasks
- Pet recurring schedules
- Push notifications
- Pet Daily Report
- Dates
- Memories
- Journal
- Places
- Eat

隨著功能增加，系統開始出現越來越多：

- background jobs
- scheduled jobs
- external API calls
- notification delivery
- synchronization
- asynchronous AI work

因此下一階段不再只增加功能，而是開始改善系統本身的：

- Reliability
- Fault tolerance
- Observability
- Concurrency control
- Idempotency
- Background processing
- Data synchronization

這份文件記錄 An & Yao 的系統設計演進。

---

# 2. Current Architecture

目前主要架構：

```text
Browser
   │
   ▼
Next.js
   │
   ▼
Supabase / PostgreSQL

部分背景工作則由 Cron 呼叫 API endpoint：

Cron
 │
 ▼
Next.js API Route
 │
 ▼
Business Logic
 │
 ├── External API
 │
 ├── Database
 │
 └── Push Notification
 │
 ▼
HTTP Response
```

目前類似的 background work 包含：

```text
Study background sync
Pet Daily Report
Notification reminders
```

這種架構在目前使用人數非常少的情況下可以正常運作。

但 background work 的生命週期與 HTTP request 綁在一起。

---

# 3. Problems With the Current Model

## 3.1 HTTP lifecycle coupling

目前：

```text
Cron
 ↓
HTTP request
 ↓
execute entire job
 ↓
response
```

如果中途發生：

```text
Function timeout
Network failure
Deployment interruption
External API timeout
Process crash
```

系統很難判斷：

```text
工作完全沒開始？

工作做到一半？

工作其實完成，只是 Response 沒送回去？
```

因此：

> Request failure does not necessarily mean operation failure.

---

## 3.2 Missing unified retry model

目前不同功能需要各自處理失敗。

例如：

```text
Study Sync
 ↓
NTU COOL temporarily unavailable
 ↓
sync failed
```

系統缺少統一的：

```text
retry
exponential backoff
max attempts
dead letter state
```

理想狀態：

```text
attempt 1
 ↓ fail

5 sec

attempt 2
 ↓ fail

30 sec

attempt 3
 ↓ success
```

---

## 3.3 Duplicate execution

Distributed systems 中常見情況：

```text
Worker completes job
 ↓
response lost
 ↓
caller thinks request failed
 ↓
caller retries
```

因此 background jobs 通常必須接受：

```text
at-least-once delivery
```

並透過：

```text
idempotency
```

確保同一個 logical operation 不會被重複執行。

---

## 3.4 Concurrency

未來可能同時存在多個 worker：

```text
Worker A
Worker B
```

兩者可能同時看到：

```text
job #123 = pending
```

如果沒有 locking：

```text
Worker A → #123
Worker B → #123

duplicate execution
```

Queue 必須提供 atomic claim。

---

## 3.5 Observability

目前發生背景工作異常時，通常需要：

```text
Vercel logs
 ↓
find request
 ↓
find error
 ↓
infer current state
```

長期希望可以直接知道：

```text
Which jobs are pending?
Which jobs failed?
How many retries occurred?
When was the last successful sync?
How long do jobs take?
Is the worker healthy?
```

---

# 4. Target Architecture

目標架構：

```text
                 Browser
                    │
                    ▼
                Next.js
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
       Database           Job Producer
                              │
                              ▼
                      background_jobs
                              │
                              ▼
                           Worker
                              │
              ┌───────────────┼──────────────┐
              ▼               ▼              ▼
          NTU COOL         Push API        Gemini
              │               │              │
              └───────────────┴──────────────┘
                              │
                              ▼
                       Job result/state
```

---

# 5. Background Job Queue

目前第一個 infrastructure component：

```text
background_jobs
```

基本 lifecycle：

```text
             ┌───────────────┐
             │               │
             ▼               │
pending → running → succeeded
   ▲         │
   │         │ failure
   │         ▼
   └──── retry
             │
             │ max attempts reached
             ▼
            dead
```

可能的狀態：

```text
pending
running
succeeded
dead
cancelled
```

---

# 6. Job Fields

核心欄位：

```text
id
job_type
payload

status
priority
run_at

attempts
max_attempts

idempotency_key

locked_at
locked_by

started_at
finished_at

last_error

created_at
updated_at
```

其中：

### run_at

決定 job 最早可以被執行的時間。

也可以用來實作 retry backoff。

```text
attempt 1 → now
attempt 2 → now + 5 sec
attempt 3 → now + 30 sec
attempt 4 → now + 2 min
```

### idempotency_key

代表一個 logical operation。

例如：

```text
study-sync:2026-10-02T18
pet-report:pet123:2026-10-02
notification:user123:assignment456:24h
```

相同 idempotency key 只能建立一次。

---

# 7. Atomic Job Claiming

Worker 不直接：

```sql
SELECT *
FROM background_jobs
WHERE status = 'pending';
```

而是使用 PostgreSQL locking：

```sql
FOR UPDATE SKIP LOCKED
```

例如：

```text
Pending:

A
B
C
D
E
F
```

兩個 Worker 同時 claim：

```text
Worker A → A B C
Worker B → D E F
```

而不是：

```text
Worker A → A B C
Worker B → A B C
```

這提供：

```text
atomic claiming
concurrency safety
multi-worker compatibility
```

---

# 8. Worker Model

Worker 的責任：

```text
1. Claim ready jobs
2. Mark running
3. Execute handler
4. Mark succeeded
5. Handle failure
6. Calculate retry delay
7. Requeue or mark dead
```

概念：

```text
claimJobs()
   │
   ▼
for each job
   │
   ├── execute
   │      │
   │      ├── success → completeJob()
   │      │
   │      └── failure → retryJob()
   │
   ▼
done
```

---

# 9. Retry Strategy

初期可以使用 deterministic exponential backoff。

例如：

```text
attempt 1 → 5 sec
attempt 2 → 30 sec
attempt 3 → 2 min
attempt 4 → 10 min
attempt 5 → dead
```

未來可以加入：

```text
jitter
```

避免大量 jobs 同時 retry：

```text
retryDelay =
baseDelay + randomJitter
```

---

# 10. Dead Letter Jobs

當：

```text
attempts >= max_attempts
```

job 不再自動執行：

```text
status = dead
```

Dead job 必須保留：

```text
payload
last_error
attempts
timestamps
```

方便：

```text
debug
manual retry
root cause analysis
```

---

# 11. First Migration Target

第一個接入 Queue 的功能：

```text
Study Background Sync
```

目前：

```text
Cron
 ↓
/api/study/background-sync
 ↓
syncAllConfiguredNtuCoolAccounts()
```

改造後：

```text
Cron
 ↓
enqueue study.sync
 ↓
return immediately


Worker
 ↓
claim study.sync
 ↓
syncAllConfiguredNtuCoolAccounts()
 ↓
success / retry / dead
```

原因：

- 本身就是 background task
- 依賴外部 NTU COOL
- 容易受到 network failure 影響
- execution time 相對長
- 適合觀察 retry 行為

---

# 12. Existing Notification Idempotency

Notification subsystem 已經有類似 idempotency 的設計。

概念：

```text
notification_key
 ↓
insert delivery claim
 ↓
unique violation
 ↓
already processed
```

這是一個 feature-level implementation。

未來希望把：

```text
retry
job state
idempotency
failure tracking
```

逐步提升成共用 infrastructure。

---

# 13. Future: Transactional Outbox

Job Queue 穩定後，下一階段考慮：

```text
Transactional Outbox
```

例如完成 Pet Task：

```text
BEGIN

UPDATE pet_tasks
SET status = 'completed';

INSERT INTO outbox_events (
  type,
  payload
)
VALUES (
  'pet_task.completed',
  ...
);

COMMIT;
```

之後：

```text
outbox_events
      │
      ▼
   consumers
      │
      ├── Notification
      ├── Pet
      └── Analytics
```

解決：

```text
DB succeeded
but side effect failed
```

造成的 partial failure。

---

# 14. Future: Local-first Sync

後續可以研究：

```text
Browser
├── IndexedDB
├── Local state
├── Mutation Queue
└── Sync Engine
        │
        ▼
      Server
```

需要處理：

```text
offline writes
optimistic updates
retry
versioning
conflicts
event ordering
eventual consistency
```

可能使用：

```text
expected_version
server_version
```

做 optimistic concurrency control。

---

# 15. Observability

未來建立：

```text
/system
```

作為系統管理與 observability 中心。

預計整合：

```text
/system

Overview
├── Database usage
├── Storage usage
└── Worker health

Jobs
├── Pending
├── Running
├── Retrying
├── Succeeded
└── Dead

Study Sync
├── Sync history
├── Errors
└── Duration

Notifications
├── Delivery status
├── Failures
└── Retry

Cron / Worker
├── Last heartbeat
├── Last successful run
└── Error state
```

目前散落的 system diagnostics 將逐步移入 `/system`：

```text
Profile
└── System / DB usage
        ↓
     /system

/study/sync-history
        ↓
     /system
```

---

# 16. Metrics

之後希望追蹤：

```text
queue depth

job success rate
job failure rate

job execution latency
queue waiting latency

retry count
dead job count

Study sync duration
Study sync failure rate

notification delivery success rate

worker heartbeat
```

---

# 17. Failure Injection

系統完成後不只測試 happy path。

會刻意建立 failure：

```text
throw on attempt 1
throw on attempt 2
success on attempt 3
```

確認：

```text
pending
 ↓
running
 ↓
pending + future run_at
 ↓
running
 ↓
pending + future run_at
 ↓
running
 ↓
succeeded
```

也會測試：

```text
duplicate enqueue
multiple workers
worker crash
stale lock
external API failure
max retry reached
```

---

# 18. Engineering Goals

這次 systems upgrade 的主要目的不是處理大量流量。

目前 An & Yao 的使用者與資料量都很小。

主要目標是學習與實作：

```text
Durability

Idempotency

Concurrency Control

Fault Tolerance

Retry / Backoff

Asynchronous Processing

Eventual Consistency

Observability
```

因此我們刻意避免目前沒有需求的：

```text
Kafka
Kubernetes
Redis Cluster
Microservices
Distributed database
```

優先使用：

```text
Next.js
PostgreSQL
Supabase
Cron
Workers
```

把核心 systems concepts 做正確。

---

# 19. Roadmap

## Phase 1 — Durable Job Queue

- [x] Design `background_jobs`
- [x] Add database migration
- [x] Implement atomic claim with `FOR UPDATE SKIP LOCKED`
- [ ] `enqueueJob()`
- [ ] `claimJobs()`
- [ ] `completeJob()`
- [ ] `retryJob()`
- [ ] `deadLetterJob()`
- [ ] Worker runner
- [ ] Failure injection tests

## Phase 2 — Real Workloads

- [ ] Move Study background sync into queue
- [ ] Move Pet Daily Report into queue
- [ ] Evaluate Notification reminders
- [ ] Add idempotency keys
- [ ] Add retry policies per job type

## Phase 3 — Transactional Outbox

- [ ] `outbox_events`
- [ ] Domain events
- [ ] Event dispatcher
- [ ] Idempotent consumers

## Phase 4 — `/system`

- [ ] System overview
- [ ] Job dashboard
- [ ] Job detail
- [ ] Manual retry
- [ ] Worker health
- [ ] Move DB usage from Profile
- [ ] Move Study sync history from `/study/sync-history`
- [ ] Metrics

## Phase 5 — Local-first

- [ ] IndexedDB
- [ ] Local cache
- [ ] Mutation queue
- [ ] Offline writes
- [ ] Sync engine
- [ ] Versioning
- [ ] Conflict resolution

---

# 20. Current Design Principle

The goal is not to make the architecture complicated.

The goal is:

> Use the simplest architecture that allows us to explicitly reason about failures.

An & Yao should remain simple enough for a small personal application while providing real implementations of production system concepts.

The system should become:

```text
observable
recoverable
idempotent
concurrency-safe
```

without adding infrastructure purely for complexity.

---

# 21. Long-term Project Positioning

An & Yao is not intended to be presented only as:

> A couple-oriented Next.js website.

The long-term technical direction is closer to:

> A personal information system that integrates heterogeneous data sources and explores reliable asynchronous processing, synchronization, event-driven architecture, and observability.

This allows the project to remain personally useful while also serving as a meaningful systems engineering side project.
EOF

git status --short docs/system-design.md

````

這份我特別保留了兩種內容：

```text
「為什麼做」
+
「怎麼做」
````

> 我當時其實只有兩個使用者，所以 scalability 並不是痛點。我做這次改造是為了研究 asynchronous processing、failure recovery、idempotency 和 observability，而且刻意沒有導入 Kafka 或 microservices。
