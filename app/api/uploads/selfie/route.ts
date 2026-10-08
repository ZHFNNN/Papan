import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { requireAuth } from "@/lib/require-user";
import { cloudinary } from "@/lib/cloudinary";
import { buildKycImagePublicId } from "@/lib/kyc-image";

export const runtime = "nodejs";

// Tipe `authenticated`: foto selfie tidak bisa dibuka lewat URL publik,
// hanya lewat GET /api/kyc/image/selfie.
function uploadBufferToCloudinary(buffer: Buffer, userId: string) {
  return new Promise<string>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: buildKycImagePublicId("selfie", userId, randomUUID()),
        type: "authenticated",
        resource_type: "image"
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Cloudinary upload failed"));
          return;
        }

        resolve(result.public_id);
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return auth.error;
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ message: "File selfie wajib diupload" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return Response.json({ message: "File harus berupa gambar" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ message: "Ukuran file maksimal 5MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ref = await uploadBufferToCloudinary(buffer, auth.session.user.id);

  return Response.json({
    message: "Upload berhasil",
    data: { ref }
  });
}
