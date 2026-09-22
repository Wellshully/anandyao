"use server";

import { revalidatePath } from "next/cache";

import { createDate } from "@/features/dates/lib/create-date";

import { respondToDateInvitation } from "@/features/dates/lib/respond-to-invitation";

import { addItineraryItem } from "@/features/dates/lib/add-itinerary-item";

import { deleteItineraryItem } from "@/features/dates/lib/delete-itinerary-item";
import { reorderItinerary } from "@/features/dates/lib/reorder-itinerary";
import type {
  AddItineraryInput,
  CreateDateInput,
} from "@/features/dates/types";

export type CreateDateActionResult =
  | {
      success: true;
      dateId: string;
    }
  | {
      success: false;
      error: string;
    };

export async function createDateAction(
  input: CreateDateInput,
): Promise<CreateDateActionResult> {
  try {
    const dateId = await createDate(input);

    revalidatePath("/dates");

    return {
      success: true,
      dateId,
    };
  } catch (cause) {
    console.error("createDateAction error:", cause);

    return {
      success: false,

      error: cause instanceof Error ? cause.message : "建立約會失敗。",
    };
  }
}

export type RespondToDateInvitationActionResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

export async function respondToDateInvitationAction(
  dateId: string,
  response: "accepted" | "declined",
): Promise<RespondToDateInvitationActionResult> {
  try {
    await respondToDateInvitation(dateId, response);

    revalidatePath("/dates");

    revalidatePath(`/dates/${dateId}`);

    return {
      success: true,
    };
  } catch (cause) {
    console.error("respondToDateInvitationAction error:", cause);

    return {
      success: false,

      error: cause instanceof Error ? cause.message : "回覆邀請失敗。",
    };
  }
}

export type AddItineraryActionResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

export async function addItineraryItemAction(
  input: AddItineraryInput,
): Promise<AddItineraryActionResult> {
  try {
    await addItineraryItem(input);

    revalidatePath(`/dates/${input.dateId}`);

    return {
      success: true,
    };
  } catch (cause) {
    console.error("addItineraryItemAction error:", cause);

    return {
      success: false,

      error: cause instanceof Error ? cause.message : "新增行程失敗。",
    };
  }
}

export type DeleteItineraryActionResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

export async function deleteItineraryItemAction(
  dateId: string,
  itineraryItemId: string,
): Promise<DeleteItineraryActionResult> {
  try {
    await deleteItineraryItem(itineraryItemId);

    revalidatePath(`/dates/${dateId}`);

    return {
      success: true,
    };
  } catch (cause) {
    console.error("deleteItineraryItemAction error:", cause);

    return {
      success: false,

      error: cause instanceof Error ? cause.message : "刪除行程失敗。",
    };
  }
}
export type ReorderItineraryActionResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

export async function reorderItineraryAction(
  dateId: string,
  dateDayId: string,
  itemIds: string[],
): Promise<ReorderItineraryActionResult> {
  try {
    await reorderItinerary(dateDayId, itemIds);

    revalidatePath(`/dates/${dateId}`);

    return {
      success: true,
    };
  } catch (cause) {
    console.error("reorderItineraryAction error:", cause);

    return {
      success: false,

      error: cause instanceof Error ? cause.message : "調整行程順序失敗。",
    };
  }
}
