import type { Partner } from "@/lib/accounting/client";

import { describe, expect, it } from "vitest";

import { matchPartner } from "@/lib/domain/match-partner";

const partners: Partner[] = [
  {
    partner_code: "P-1001",
    name: "株式会社山田製作所",
    aliases: ["ヤマダ製作所", "山田製作所"],
    registration_no: "T1010001000101",
  },
  {
    partner_code: "P-1002",
    name: "有限会社佐藤商店",
    aliases: ["佐藤商店"],
    registration_no: "T2020002000202",
  },
  {
    partner_code: "P-1003",
    name: "東京フーズ株式会社",
    aliases: ["東京フーズ"],
    registration_no: "T3030003000303",
  },
];

describe("matchPartner", () => {
  it("matches by registration number first, even if the name is wrong", () => {
    const result = matchPartner(partners, {
      supplier_name: "wrong",
      supplier_registration_no: "T1010001000101",
    });
    expect(result.partner_code).toBe("P-1001");
    expect(result.confidence).toBe("high");
  });

  it("matches exact legal name", () => {
    const result = matchPartner(partners, {
      supplier_name: "株式会社山田製作所",
    });
    expect(result.partner_code).toBe("P-1001");
    expect(result.confidence).toBe("high");
  });

  it("matches exact alias", () => {
    const result = matchPartner(partners, { supplier_name: "佐藤商店" });
    expect(result.partner_code).toBe("P-1002");
    expect(result.confidence).toBe("high");
  });

  it("matches a normalized name without the company suffix", () => {
    const result = matchPartner(partners, {
      supplier_name: "山田製作所　株式会社",
    });
    expect(result.partner_code).toBe("P-1001");
    expect(result.confidence).toBe("medium");
  });

  it("does not guess when several names could match", () => {
    const overlapping: Partner[] = [
      ...partners,
      {
        partner_code: "P-9999",
        name: "佐藤商店ホールディングス",
        aliases: [],
        registration_no: "T999",
      },
    ];
    const result = matchPartner(overlapping, { supplier_name: "佐藤" });
    expect(result.partner_code).toBeNull();
    expect(result.confidence).toBe("low");
    expect(result.candidates.length).toBeGreaterThan(1);
  });

  it("returns null when unmatched, with the full master as candidates", () => {
    const result = matchPartner(partners, { supplier_name: "Unknown Co" });
    expect(result.partner_code).toBeNull();
    expect(result.confidence).toBe("low");
    expect(result.candidates).toHaveLength(partners.length);
  });
});
