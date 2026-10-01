import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | An & Yao",
  description:
    "Privacy Policy for An & Yao, including Google Calendar integration.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <Link
          href="/"
          className="
            text-xs
            text-[var(--muted)]
            transition
            hover:text-[var(--foreground)]
          "
        >
          ← 回到 An & Yao
        </Link>

        <header className="mt-8 border-b border-[var(--border)] pb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Privacy Policy
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            隱私權政策
          </h1>

          <p className="mt-3 text-sm text-[var(--muted)]">
            最後更新：2026 年 10 月 1 日
          </p>
        </header>

        <div className="mt-10 space-y-10 text-sm leading-7">
          <section>
            <h2 className="text-lg font-semibold">
              1. 關於本服務
            </h2>

            <p className="mt-3 text-[var(--muted)]">
              An & Yao 是一個私人使用的網站，提供行程管理、
              約會規劃、生活紀錄以及 Google Calendar 整合等功能。
              本隱私權政策說明本服務如何存取、使用及保護使用者資料。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">
              2. Google Calendar 資料
            </h2>

            <p className="mt-3 text-[var(--muted)]">
              當使用者主動選擇連結 Google Calendar 時，
              本服務會透過 Google OAuth 取得使用者授權的
              Google Calendar 存取權限。
            </p>

            <p className="mt-3 text-[var(--muted)]">
              Google Calendar 資料僅用於在 An & Yao 的 Calendar
              功能中顯示使用者自己的行程與時間資訊，
              以及提供與行程相關的網站功能。
            </p>

            <p className="mt-3 text-[var(--muted)]">
              本服務不會使用 Google Calendar 資料進行廣告投放、
              行銷分析，也不會出售 Google 使用者資料。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">
              3. Google OAuth 權杖
            </h2>

            <p className="mt-3 text-[var(--muted)]">
              為了維持 Google Calendar 的連線，
              本服務可能儲存 Google OAuth 所提供的 access token
              與 refresh token。
            </p>

            <p className="mt-3 text-[var(--muted)]">
              這些權杖只會用於代表已授權的使用者向 Google
              Calendar API 取得其行事曆資料，
              不會用於其他無關用途。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">
              4. 資料的使用方式
            </h2>

            <p className="mt-3 text-[var(--muted)]">
              本服務取得的資料僅會用於提供網站核心功能，
              包括顯示行程、整合不同來源的日曆資訊、
              以及維持使用者所要求的 Google Calendar 連線。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">
              5. 資料分享
            </h2>

            <p className="mt-3 text-[var(--muted)]">
              本服務不會出售、出租或交易使用者的 Google
              Calendar 資料，也不會將這些資料提供給與本服務功能
              無關的第三方。
            </p>

            <p className="mt-3 text-[var(--muted)]">
              為了維持網站運作，資料可能經由網站所使用的基礎設施
              與雲端服務進行處理，但僅限提供本服務所必要的範圍。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">
              6. 資料保存與安全
            </h2>

            <p className="mt-3 text-[var(--muted)]">
              本服務會採取合理的技術措施保護使用者資料及 OAuth
              授權資訊，並盡可能限制只有執行網站功能所必要的程式
              可以存取相關資料。
            </p>

            <p className="mt-3 text-[var(--muted)]">
              Google Calendar 行程資料主要在需要顯示或使用時取得。
              若本服務保存任何與 Google 整合相關的資訊，
              其用途僅限維持使用者所要求的服務功能。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">
              7. 撤銷 Google Calendar 授權
            </h2>

            <p className="mt-3 text-[var(--muted)]">
              使用者可以隨時透過自己的 Google 帳戶安全性設定，
              撤銷 An & Yao 對 Google Calendar 的存取權限。
            </p>

            <a
              href="https://myaccount.google.com/connections"
              target="_blank"
              rel="noreferrer"
              className="
                mt-3
                inline-block
                font-medium
                text-[var(--accent)]
                underline
                underline-offset-4
              "
            >
              管理 Google 第三方連線
            </a>
          </section>

          <section>
            <h2 className="text-lg font-semibold">
              8. 隱私權政策變更
            </h2>

            <p className="mt-3 text-[var(--muted)]">
              若本服務的資料處理方式有所變更，
              本頁內容也可能隨之更新。
              最新版本會持續公布於此頁面。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">
              9. 聯絡方式
            </h2>

            <p className="mt-3 text-[var(--muted)]">
              如對本隱私權政策、Google Calendar 資料使用方式，
              或資料刪除有任何疑問，請聯絡本網站管理者。
            </p>
          </section>
        </div>

        <footer className="mt-14 border-t border-[var(--border)] pt-6">
          <p className="text-xs text-[var(--muted)]">
            © 2026 An & Yao
          </p>
        </footer>
      </div>
    </main>
  );
}
