-- =========================================================
-- Background Job Worker Cron
-- =========================================================
--
-- Wake the generic durable queue worker once per minute.
--
-- One worker invocation currently claims at most one job.
-- This is intentional while the application is small and
-- while each claimed job owns its own heartbeat lifecycle.
--
-- Existing feature-specific cron jobs remain responsible
-- only for producing jobs.
-- =========================================================

select cron.schedule_in_database(
  'anandyao-background-job-worker',
  '* * * * *',
  '
    select net.http_post(
      url :=
        ''https://anandyao.vercel.app/api/system/jobs/worker'',

      headers :=
        jsonb_build_object(
          ''Content-Type'',
          ''application/json'',

          ''Authorization'',
          ''Bearer '' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = ''anandyao_cron_secret''
            limit 1
          )
        ),

      body :=
        ''{}''::jsonb,

      timeout_milliseconds :=
        120000
    );
  ',
  'postgres',
  null,
  true
);
