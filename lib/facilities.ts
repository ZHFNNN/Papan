import { prisma } from '@/lib/prisma';
import { customFacilityCode } from '@/lib/property-input';

/**
 * Ubah input fasilitas dari form owner menjadi id Facility.
 * Input bisa berupa kode preset (mis. "AC") atau nama yang diketik owner
 * (mis. "Kolam Renang"), yang dibuat sebagai fasilitas custom bila belum ada.
 */
export async function resolveFacilityRecords(inputs: string[]): Promise<{ id: string }[]> {
  return Promise.all(
    inputs.map(async (input) => {
      const byCode = await prisma.facility.findUnique({ where: { code: input } });
      if (byCode) return { id: byCode.id };

      const code = customFacilityCode(input);
      const result = await prisma.facility.upsert({
        where: { code },
        update: {},
        create: { code, name: input },
      });
      return { id: result.id };
    })
  );
}
