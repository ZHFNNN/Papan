import { describe, expect, it } from "vitest";
import { formatWhatsAppNumber } from "@/lib/whatsapp";

/**
 * Whitebox tests untuk formatWhatsAppNumber (link wa.me di detail properti).
 * Nomor HP pemilik diisi bebas saat register (hanya dicek panjang 8-20),
 * jadi formatter harus menerima berbagai gaya penulisan nomor Indonesia
 * dan selalu menghasilkan digit berawalan kode negara 62.
 */

describe("formatWhatsAppNumber", () => {
  it("converts a local number starting with 0 to the 62 prefix", () => {
    expect(formatWhatsAppNumber("081234567890")).toBe("6281234567890");
  });

  it("keeps a number that already starts with 62", () => {
    expect(formatWhatsAppNumber("6281234567890")).toBe("6281234567890");
  });

  it("strips +, spaces, dashes and parentheses", () => {
    expect(formatWhatsAppNumber("+62 812-3456-7890")).toBe("6281234567890");
    expect(formatWhatsAppNumber("(0812) 3456 7890")).toBe("6281234567890");
  });

  it("adds 62 to a number written without leading 0 or country code", () => {
    expect(formatWhatsAppNumber("81234567890")).toBe("6281234567890");
    expect(formatWhatsAppNumber("812-3456-7890")).toBe("6281234567890");
  });

  it("drops the extra 0 when the country code is followed by 0", () => {
    expect(formatWhatsAppNumber("+62 0812 3456 7890")).toBe("6281234567890");
    expect(formatWhatsAppNumber("6208123456789")).toBe("628123456789");
  });
});
