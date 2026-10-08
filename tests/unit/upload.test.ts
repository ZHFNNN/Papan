import { describe, expect, it } from "vitest";
import { MB, readImageFile } from "@/lib/upload";

function uploadRequest(file?: File | string) {
  const form = new FormData();
  if (file !== undefined) form.append("file", file);
  return new Request("http://localhost/api/uploads/test", { method: "POST", body: form });
}

const png = (bytes: number) => new File([new Uint8Array(bytes)], "foto.png", { type: "image/png" });

async function errorOf(result: Awaited<ReturnType<typeof readImageFile>>) {
  if (!("error" in result)) throw new Error("expected an error");
  return { status: result.error.status, body: await result.error.json() };
}

describe("readImageFile", () => {
  it("returns the file contents for a valid image", async () => {
    const result = await readImageFile(uploadRequest(png(10)), { label: "File KTP", maxBytes: 5 * MB });
    expect("buffer" in result && result.buffer.length).toBe(10);
  });

  it("rejects a missing file with the route's own label", async () => {
    const result = await readImageFile(uploadRequest(), { label: "File KTP", maxBytes: 5 * MB });
    expect(await errorOf(result)).toEqual({ status: 400, body: { message: "File KTP wajib diupload" } });
  });

  it("rejects a plain text field instead of a file", async () => {
    const result = await readImageFile(uploadRequest("bukan file"), { label: "File selfie", maxBytes: 5 * MB });
    expect((await errorOf(result)).body.message).toBe("File selfie wajib diupload");
  });

  it("rejects non-image files", async () => {
    const pdf = new File(["%PDF"], "doc.pdf", { type: "application/pdf" });
    const result = await readImageFile(uploadRequest(pdf), { label: "File", maxBytes: 5 * MB });
    expect((await errorOf(result)).body.message).toBe("File harus berupa gambar");
  });

  it("rejects files over the size limit and names the limit", async () => {
    const result = await readImageFile(uploadRequest(png(8 * MB + 1)), { label: "File", maxBytes: 8 * MB });
    expect(await errorOf(result)).toEqual({ status: 400, body: { message: "Ukuran file maksimal 8MB" } });
  });

  it("accepts a file exactly at the limit", async () => {
    const result = await readImageFile(uploadRequest(png(5 * MB)), { label: "File", maxBytes: 5 * MB });
    expect("buffer" in result).toBe(true);
  });
});
