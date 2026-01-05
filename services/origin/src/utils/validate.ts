export function validateCreateContent(data: any) {
  if (!data.title || typeof data.title !== "string") {
    throw new Error("Title is required");
  }
  if (!data.slug || typeof data.slug !== "string") {
    throw new Error("Slug is required");
  }
  if (!data.body || typeof data.body !== "string") {
    throw new Error("Body is required");
  }
  return true;
}
