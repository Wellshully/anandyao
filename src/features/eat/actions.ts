"use server";

import { revalidatePath } from "next/cache";

import { addRestaurant } from "@/features/eat/lib/add-restaurant";

import { deleteRestaurant } from "@/features/eat/lib/delete-restaurant";

import { pickRestaurant } from "@/features/eat/lib/pick-restaurant";

import { recordRestaurantVisit } from "@/features/eat/lib/record-visit";

import { setRestaurantHidden } from "@/features/eat/lib/set-restaurant-hidden";

import { updateRestaurant } from "@/features/eat/lib/update-restaurant";

import type {
  AddRestaurantInput,
  PickRestaurantOptions,
  RecordRestaurantVisitInput,
  UpdateRestaurantInput,
} from "@/features/eat/types";

export async function addRestaurantAction(input: AddRestaurantInput) {
  const restaurant = await addRestaurant(input);

  revalidatePath("/eat");

  return restaurant;
}

export async function updateRestaurantAction(input: UpdateRestaurantInput) {
  const restaurant = await updateRestaurant(input);

  revalidatePath("/eat");

  revalidatePath(`/eat/${input.restaurantId}`);

  return restaurant;
}

export async function setRestaurantHiddenAction(
  restaurantId: string,
  hidden: boolean,
) {
  await setRestaurantHidden(restaurantId, hidden);

  revalidatePath("/eat");

  revalidatePath(`/eat/${restaurantId}`);
}

export async function deleteRestaurantAction(restaurantId: string) {
  await deleteRestaurant(restaurantId);

  revalidatePath("/eat");
}

export async function pickRestaurantAction(options: PickRestaurantOptions) {
  return pickRestaurant(options);
}

export async function recordRestaurantVisitAction(
  input: RecordRestaurantVisitInput,
) {
  const visit = await recordRestaurantVisit(input);

  revalidatePath("/eat");

  revalidatePath(`/eat/${input.restaurantId}`);

  return visit;
}
