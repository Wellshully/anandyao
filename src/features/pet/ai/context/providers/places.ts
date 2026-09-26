import "server-only";

import {
  getPlaceStatusLabel,
  isPlaceStatus,
} from "@/features/places/config/place-status";
import { requireSpace } from "@/lib/space/require-space";
import { createClient } from "@/lib/supabase/server";

import type { PetPlaceContextItem, PetPlacesContext } from "../types";

export async function getPetPlacesContext(): Promise<PetPlacesContext> {
  const [supabase, space] = await Promise.all([createClient(), requireSpace()]);

  const { data, error } = await supabase
    .from("places")
    .select(
      `
        name,
        status,
        address,
        note,
        visited_on
      `,
    )
    .eq("space_id", space.id)
    .order("updated_at", {
      ascending: false,
    })
    .limit(80);

  if (error) {
    throw new Error(`Failed to load pet places context: ${error.message}`);
  }

  const items: PetPlaceContextItem[] = data.map((place) => ({
    name: place.name,

    status: place.status,

    statusLabel: isPlaceStatus(place.status)
      ? getPlaceStatusLabel(place.status)
      : place.status,

    address: place.address,
    note: place.note,
    visitedOn: place.visited_on,
  }));

  return {
    total: items.length,

    wantToGo: items.filter((place) => place.status === "want_to_go"),

    visited: items.filter((place) => place.status === "visited"),

    revisit: items.filter((place) => place.status === "revisit"),
  };
}
