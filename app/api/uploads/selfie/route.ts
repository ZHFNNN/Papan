import { randomUUID } from "node:crypto";
import { requireAuth } from "@/lib/require-user";
import { uploadImageBuffer } from "@/lib/cloudinary";
import { buildKycImagePublicId } from "@/lib/kyc-image";
import { MB, readImageFile } from "@/lib/upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return auth.error;
  }

  const image = await readImageFile(request, { label: "File selfie", maxBytes: 5 * MB });
  if ("error" in image) return image.error;

  // Tipe `authenticated`: foto selfie tidak bisa dibuka lewat URL publik,
  // hanya lewat GET /api/kyc/image/selfie.
  const uploaded = await uploadImageBuffer(image.buffer, {
    public_id: buildKycImagePublicId("selfie", auth.session.user.id, randomUUID()),
    type: "authenticated",
  });

  return Response.json({
    message: "Upload berhasil",
    data: { ref: uploaded.public_id }
  });
}
