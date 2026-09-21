type MediaCategory = "memories" | "journal" | "places" | "birthday";

type CreateMediaPathParams = {
  spaceId: string;
  category: MediaCategory;
  extension: string;
};

export function createMediaPath({
  spaceId,
  category,
  extension,
}: CreateMediaPathParams) {
  const id = crypto.randomUUID();

  const safeExtension = extension.replace(".", "").toLowerCase();

  return `${spaceId}/${category}/${id}.${safeExtension}`;
}
