const STANDARD_PHOTO_EDGE = 1600;

export default async function preparePhoto(file, hd) {
  if (hd || !["image/jpeg", "image/png", "image/webp"].includes(file?.type)) return file;

  let photo;
  try {
    photo = await createImageBitmap(file);
    const scale = Math.min(1, STANDARD_PHOTO_EDGE / Math.max(photo.width, photo.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(photo.width * scale));
    canvas.height = Math.max(1, Math.round(photo.height * scale));
    const context = canvas.getContext("2d");
    context.drawImage(photo, 0, 0, canvas.width, canvas.height);
    const result = await new Promise((resolve) => canvas.toBlob(resolve, file.type, 0.82));
    if (!result || result.type !== file.type || (scale === 1 && result.size >= file.size)) return file;
    return new File([result], file.name, { type: result.type, lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    photo?.close();
  }
}
