import Link from "next/link";

import Container from "@/components/ui/Container";

import NavigationTray from "@/components/layout/NavigationTray";
import RelationshipClock from "@/components/layout/RelationshipClock";
import ProfileMenu from "@/components/layout/ProfileMenu";

import InteractionButton from "@/features/interactions/components/InteractionButton";

import { siteConfig } from "@/config/site";

import { getTodayOverview } from "@/features/today/lib/get-today-overview";

import { getCurrentProfile } from "@/features/profile/lib/get-current-profile";
import { getProjectUsage } from "@/features/profile/lib/get-project-usage";
import { getCurrentSpaceRole } from "@/features/profile/lib/get-current-space-role";

import { getInteractionState } from "@/features/interactions/lib/get-interaction-state";

export default async function SiteHeader() {
  const [todayItems, profile, role, interactionState] = await Promise.all([
    getTodayOverview(),
    getCurrentProfile(),
    getCurrentSpaceRole(),
    getInteractionState(),
  ]);

  const usage = role === "owner" ? await getProjectUsage() : null;

  return (
    <header
      className="
        sticky
        top-0
        z-40
        border-b
        border-[var(--border)]
        bg-[color:var(--background)]/90
        backdrop-blur-md
      "
    >
      <Container>
        <div className="flex h-16 items-center justify-between gap-2 sm:gap-4">
          <Link
            href="/"
            className="
              font-story
              shrink-0
              text-xl
              font-semibold
              tracking-tight
            "
          >
            {siteConfig.name}
          </Link>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <NavigationTray />

            <InteractionButton
              initialActionName={interactionState.actionName}
              initialCooldownSeconds={interactionState.cooldownSeconds}
            />

            <div
              className="
                hidden
                h-8
                w-px
                bg-[var(--border)]
                sm:block
              "
            />

            <RelationshipClock items={todayItems} />

            <ProfileMenu
              displayName={profile.displayName}
              isOwner={role === "owner"}
              usage={usage}
              interactionActionName={interactionState.actionName}
            />
          </div>
        </div>
      </Container>
    </header>
  );
}
