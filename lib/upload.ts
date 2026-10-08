/**
 * Ambil file gambar dari field `file` di form-data dan validasi tipe + ukurannya.
 * Mengembalikan `{ error }` (Response 400) kalau tidak valid, supaya route cukup:
 *
 *   const image = await readImageFile(request, { label: 'File KTP', maxBytes: 5 * MB });
 *   if ('error' in image) return image.error;
 */
export const MB = 1024 * 1024;

export async function readImageFile(
  request: Request,
  { label, maxBytes }: { label: string; maxBytes: number },
): Promise<{ buffer: Buffer } | { error: Response }> {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return { error: Response.json({ message: `${label} wajib diupload` }, { status: 400 }) };
  }

  if (!file.type.startsWith('image/')) {
    return { error: Response.json({ message: 'File harus berupa gambar' }, { status: 400 }) };
  }

  if (file.size > maxBytes) {
    return {
      error: Response.json({ message: `Ukuran file maksimal ${Math.round(maxBytes / MB)}MB` }, { status: 400 }),
    };
  }

  return { buffer: Buffer.from(await file.arrayBuffer()) };
}
