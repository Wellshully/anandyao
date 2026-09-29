SET local check_function_bodies = off;

CREATE EXTENSION "pg_cron";

CREATE EXTENSION "pg_net" SCHEMA "extensions";

CREATE TABLE "public"."interaction_settings" (
  "user_id"      uuid                     NOT NULL,
  "action_name"  text                     NOT NULL DEFAULT '戳一下'::text,
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "last_sent_at" timestamp with time zone,
  CONSTRAINT "interaction_settings_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "public"."interaction_settings"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."notification_deliveries" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"           uuid                     NOT NULL,
  "notification_key"  text                     NOT NULL,
  "notification_type" text                     NOT NULL,
  "source_id"         text,
  "sent_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY (id),
  CONSTRAINT "notification_deliveries_user_id_notification_key_key" UNIQUE (user_id, notification_key)
);

ALTER TABLE "public"."notification_deliveries"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."pet_daily_reports" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     uuid                     NOT NULL,
  "pet_id"      uuid                     NOT NULL,
  "report_date" date                     NOT NULL,
  "content"     text                     NOT NULL,
  "pose"        text                     NOT NULL DEFAULT 'normal'::text,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pet_daily_reports_pkey" PRIMARY KEY (id),
  CONSTRAINT "pet_daily_reports_user_date_key" UNIQUE (user_id, report_date)
);

ALTER TABLE "public"."pet_daily_reports"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."pet_events" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "pet_id"     uuid                     NOT NULL,
  "user_id"    uuid                     NOT NULL,
  "event_type" text                     NOT NULL,
  "metadata"   jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pet_events_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."pet_events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."pet_memories" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "pet_id"           uuid                     NOT NULL,
  "subject_user_id"  uuid,
  "created_by"       uuid                     NOT NULL,
  "memory_type"      text                     NOT NULL,
  "content"          text                     NOT NULL,
  "importance"       smallint                 NOT NULL,
  "expires_at"       timestamp with time zone,
  "recall_count"     integer                  NOT NULL DEFAULT 0,
  "last_recalled_at" timestamp with time zone,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pet_memories_content_check" CHECK (((char_length(content) >= 1) AND (char_length(content) <= 200))),
  CONSTRAINT "pet_memories_importance_check" CHECK (((importance >= 1) AND (importance <= 3))),
  CONSTRAINT "pet_memories_memory_type_check" CHECK ((memory_type = ANY (ARRAY['preference'::text, 'person_fact'::text, 'shared_memory'::text, 'temporary'::text]))),
  CONSTRAINT "pet_memories_pkey" PRIMARY KEY (id),
  CONSTRAINT "pet_memories_recall_count_check" CHECK ((recall_count >= 0))
);

ALTER TABLE "public"."pet_memories"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."pet_report_deliveries" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     uuid                     NOT NULL,
  "report_date" date                     NOT NULL,
  "sent_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pet_report_deliveries_pkey" PRIMARY KEY (id),
  CONSTRAINT "pet_report_deliveries_user_id_report_date_key" UNIQUE (user_id, report_date)
);

ALTER TABLE "public"."pet_report_deliveries"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."pet_report_settings" (
  "user_id"     uuid                     NOT NULL,
  "pet_id"      uuid                     NOT NULL,
  "enabled"     boolean                  NOT NULL DEFAULT false,
  "report_time" time without time zone   NOT NULL DEFAULT '08:00:00'::time WITHOUT time zone,
  "time_zone"   text                     NOT NULL DEFAULT 'Asia/Taipei'::text,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pet_report_settings_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "public"."pet_report_settings"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."pet_tasks" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "pet_id"       uuid                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "title"        text                     NOT NULL,
  "note"         text,
  "due_at"       timestamp with time zone,
  "status"       text                     NOT NULL DEFAULT 'pending'::text,
  "created_from" text                     NOT NULL DEFAULT 'chat'::text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pet_tasks_created_from_check" CHECK ((created_from = ANY (ARRAY['chat'::text, 'manual'::text]))),
  CONSTRAINT "pet_tasks_pkey" PRIMARY KEY (id),
  CONSTRAINT "pet_tasks_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'cancelled'::text])))
);

ALTER TABLE "public"."pet_tasks"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."pets" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "space_id"            uuid                     NOT NULL,
  "name"                text                     NOT NULL DEFAULT '萌蛋'::text,
  "hunger"              double precision         NOT NULL DEFAULT 80,
  "happiness"           double precision         NOT NULL DEFAULT 80,
  "energy"              double precision         NOT NULL DEFAULT 80,
  "xp"                  integer                  NOT NULL DEFAULT 0,
  "state_calculated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pets_energy_check" CHECK (((energy >= (0)::double precision) AND (energy <= (100)::double precision))),
  CONSTRAINT "pets_happiness_check" CHECK (((happiness >= (0)::double precision) AND (happiness <= (100)::double precision))),
  CONSTRAINT "pets_hunger_check" CHECK (((hunger >= (0)::double precision) AND (hunger <= (100)::double precision))),
  CONSTRAINT "pets_one_per_space" UNIQUE (space_id),
  CONSTRAINT "pets_pkey" PRIMARY KEY (id),
  CONSTRAINT "pets_xp_check" CHECK ((xp >= 0))
);

ALTER TABLE "public"."pets"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."push_subscriptions" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    uuid                     NOT NULL,
  "endpoint"   text                     NOT NULL,
  "p256dh"     text                     NOT NULL,
  "auth_key"   text                     NOT NULL,
  "user_agent" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY (id),
  CONSTRAINT "push_subscriptions_user_id_endpoint_key" UNIQUE (user_id, endpoint)
);

ALTER TABLE "public"."push_subscriptions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."study_sync_runs" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"             uuid                     NOT NULL,
  "provider"            text                     NOT NULL DEFAULT 'cool'::text,
  "trigger_source"      text                     NOT NULL,
  "status"              text                     NOT NULL,
  "courses_count"       integer                  NOT NULL DEFAULT 0,
  "assignments_count"   integer                  NOT NULL DEFAULT 0,
  "announcements_count" integer                  NOT NULL DEFAULT 0,
  "error_message"       text,
  "started_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "finished_at"         timestamp with time zone,
  CONSTRAINT "study_sync_runs_pkey" PRIMARY KEY (id),
  CONSTRAINT "study_sync_runs_provider_check" CHECK ((provider = 'cool'::text)),
  CONSTRAINT "study_sync_runs_status_check" CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'error'::text]))),
  CONSTRAINT "study_sync_runs_trigger_source_check" CHECK ((trigger_source = ANY (ARRAY['app'::text, 'background'::text])))
);

ALTER TABLE "public"."study_sync_runs"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."interaction_settings"
  ADD CONSTRAINT "interaction_settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."pet_daily_reports"
  ADD CONSTRAINT "pet_daily_reports_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."pet_events"
  ADD CONSTRAINT "pet_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."pet_memories"
  ADD CONSTRAINT "pet_memories_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."pet_memories"
  ADD CONSTRAINT "pet_memories_subject_user_id_fkey" FOREIGN KEY (subject_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."pet_report_deliveries"
  ADD CONSTRAINT "pet_report_deliveries_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."pet_report_settings"
  ADD CONSTRAINT "pet_report_settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."pet_tasks"
  ADD CONSTRAINT "pet_tasks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."pet_daily_reports"
  ADD CONSTRAINT "pet_daily_reports_pet_id_fkey" FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;

ALTER TABLE "public"."pet_events"
  ADD CONSTRAINT "pet_events_pet_id_fkey" FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;

ALTER TABLE "public"."pet_memories"
  ADD CONSTRAINT "pet_memories_pet_id_fkey" FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;

ALTER TABLE "public"."pet_report_settings"
  ADD CONSTRAINT "pet_report_settings_pet_id_fkey" FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;

ALTER TABLE "public"."pet_tasks"
  ADD CONSTRAINT "pet_tasks_pet_id_fkey" FOREIGN KEY (pet_id) REFERENCES public.pets(id) ON DELETE CASCADE;

ALTER TABLE "public"."pets"
  ADD CONSTRAINT "pets_space_id_fkey" FOREIGN KEY (space_id) REFERENCES public.spaces(id) ON DELETE CASCADE;

ALTER TABLE "public"."push_subscriptions"
  ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."study_sync_runs"
  ADD CONSTRAINT "study_sync_runs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX notification_deliveries_sent_at_idx ON public.notification_deliveries USING btree (sent_at);

CREATE INDEX notification_deliveries_user_id_idx ON public.notification_deliveries USING btree (user_id);

CREATE INDEX pet_daily_reports_user_created_idx ON public.pet_daily_reports USING btree (user_id, created_at DESC);

CREATE INDEX pet_events_pet_id_created_at_idx ON public.pet_events USING btree (pet_id, created_at DESC);

CREATE INDEX pet_events_user_id_created_at_idx ON public.pet_events USING btree (user_id, created_at DESC);

CREATE INDEX pet_memories_expiry_idx ON public.pet_memories USING btree (expires_at)
  WHERE (expires_at IS NOT NULL);

CREATE INDEX pet_memories_pet_id_idx ON public.pet_memories USING btree (pet_id);

CREATE INDEX pet_memories_retrieval_idx ON public.pet_memories USING btree (pet_id, importance DESC, created_at DESC);

CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions USING btree (user_id);

CREATE INDEX study_sync_runs_started_at_idx ON public.study_sync_runs USING btree (started_at DESC);

CREATE INDEX study_sync_runs_user_id_idx ON public.study_sync_runs USING btree (user_id);

CREATE POLICY "Users can insert own interaction settings" ON "public"."interaction_settings"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can read own interaction settings" ON "public"."interaction_settings"
  FOR SELECT
  TO "authenticated"
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can update own interaction settings" ON "public"."interaction_settings"
  FOR UPDATE
  TO "authenticated"
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can read own pet daily reports" ON "public"."pet_daily_reports"
  FOR SELECT
  TO "authenticated"
  USING ((auth.uid() = user_id));

CREATE POLICY "Space members can create own pet events" ON "public"."pet_events"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (public.pets p
     JOIN public.space_members sm ON ((sm.space_id = p.space_id)))
  WHERE ((p.id = pet_events.pet_id) AND (sm.user_id = auth.uid()))))));

CREATE POLICY "Space members can read pet events" ON "public"."pet_events"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.pets p
     JOIN public.space_members sm ON ((sm.space_id = p.space_id)))
  WHERE ((p.id = pet_events.pet_id) AND (sm.user_id = auth.uid())))));

CREATE POLICY "Space members can create pet memories" ON "public"."pet_memories"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (public.pets
     JOIN public.space_members ON ((space_members.space_id = pets.space_id)))
  WHERE ((pets.id = pet_memories.pet_id) AND (space_members.user_id = auth.uid()))))));

CREATE POLICY "Space members can delete pet memories" ON "public"."pet_memories"
  FOR DELETE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.pets
     JOIN public.space_members ON ((space_members.space_id = pets.space_id)))
  WHERE ((pets.id = pet_memories.pet_id) AND (space_members.user_id = auth.uid())))));

CREATE POLICY "Space members can read pet memories" ON "public"."pet_memories"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.pets
     JOIN public.space_members ON ((space_members.space_id = pets.space_id)))
  WHERE ((pets.id = pet_memories.pet_id) AND (space_members.user_id = auth.uid())))));

CREATE POLICY "Space members can update pet memories" ON "public"."pet_memories"
  FOR UPDATE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.pets
     JOIN public.space_members ON ((space_members.space_id = pets.space_id)))
  WHERE ((pets.id = pet_memories.pet_id) AND (space_members.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.pets
     JOIN public.space_members ON ((space_members.space_id = pets.space_id)))
  WHERE ((pets.id = pet_memories.pet_id) AND (space_members.user_id = auth.uid())))));

CREATE POLICY "Users can read own report deliveries" ON "public"."pet_report_deliveries"
  FOR SELECT
  TO "authenticated"
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert own pet report settings" ON "public"."pet_report_settings"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can read own pet report settings" ON "public"."pet_report_settings"
  FOR SELECT
  TO "authenticated"
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can update own pet report settings" ON "public"."pet_report_settings"
  FOR UPDATE
  TO "authenticated"
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can delete own pet tasks" ON "public"."pet_tasks"
  FOR DELETE
  TO "authenticated"
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert own pet tasks" ON "public"."pet_tasks"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can read own pet tasks" ON "public"."pet_tasks"
  FOR SELECT
  TO "authenticated"
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can update own pet tasks" ON "public"."pet_tasks"
  FOR UPDATE
  TO "authenticated"
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Space members can create pet" ON "public"."pets"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.space_members sm
  WHERE ((sm.space_id = pets.space_id) AND (sm.user_id = auth.uid())))));

CREATE POLICY "Space members can read pet" ON "public"."pets"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.space_members sm
  WHERE ((sm.space_id = pets.space_id) AND (sm.user_id = auth.uid())))));

CREATE POLICY "Space members can update pet" ON "public"."pets"
  FOR UPDATE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.space_members sm
  WHERE ((sm.space_id = pets.space_id) AND (sm.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.space_members sm
  WHERE ((sm.space_id = pets.space_id) AND (sm.user_id = auth.uid())))));

CREATE POLICY "Space owner can delete pet" ON "public"."pets"
  FOR DELETE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.space_members sm
  WHERE ((sm.space_id = pets.space_id) AND (sm.user_id = auth.uid()) AND (sm.role = 'owner'::text)))));

CREATE POLICY "Users can create own push subscriptions" ON "public"."push_subscriptions"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can delete own push subscriptions" ON "public"."push_subscriptions"
  FOR DELETE
  TO "authenticated"
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can read own push subscriptions" ON "public"."push_subscriptions"
  FOR SELECT
  TO "authenticated"
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can update own push subscriptions" ON "public"."push_subscriptions"
  FOR UPDATE
  TO "authenticated"
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Space owner can read Study sync runs" ON "public"."study_sync_runs"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.space_members viewer
     JOIN public.space_members subject ON ((subject.space_id = viewer.space_id)))
  WHERE ((viewer.user_id = auth.uid()) AND (viewer.role = 'owner'::text) AND (subject.user_id = study_sync_runs.user_id)))));

COMMENT ON EXTENSION "pg_cron" IS 'Job scheduler for PostgreSQL';

COMMENT ON EXTENSION "pg_net" IS 'Async HTTP';

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."interaction_settings" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notification_deliveries" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pet_daily_reports" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pet_events" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pet_memories" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pet_report_deliveries" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pet_report_settings" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pet_tasks" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pets" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."push_subscriptions" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."study_sync_runs" TO "anon", "authenticated", "postgres", "service_role";

SELECT cron.schedule_in_database('anandyao-cool-background-sync', '0 */6 * * *', '
  select net.http_post(
    url :=
      ''https://anandyao.vercel.app/api/study/background-sync'',

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
  ', 'postgres', NULL, true);

SELECT cron.schedule_in_database('anandyao-mail-background-sync', '*/5 * * * *', '
  select net.http_post(
    url := ''https://anandyao.vercel.app/api/study/mail-background-sync'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''Authorization'', ''Bearer '' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = ''anandyao_cron_secret''
        limit 1
      )
    ),
    body := ''{}''::jsonb
  );
  ', 'postgres', NULL, true);

SELECT cron.schedule_in_database('anandyao-notification-reminders', '* * * * *', '
  select net.http_post(
    url := ''https://anandyao.vercel.app/api/notifications/reminders'',

    headers := jsonb_build_object(
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

    body := ''{}''::jsonb,

    timeout_milliseconds := 10000
  );
  ', 'postgres', NULL, true);

SELECT cron.schedule_in_database('anandyao-pet-daily-report', '* * * * *', '
    select net.http_post(
      url := ''https://anandyao.vercel.app/api/pet/daily-report'',

      headers := jsonb_build_object(
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

      body := ''{}''::jsonb,

      timeout_milliseconds := 120000
    );
  ', 'postgres', NULL, true);

