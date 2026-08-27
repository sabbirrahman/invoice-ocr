import type { PartnerMatch } from "@/lib/domain/schema";
import type { Partner } from "@/lib/accounting/client";

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/株式会社|有限会社|合同会社/g, "")
    .toLowerCase();
}

/**
 * Match a printed supplier name / registration number to the partner master.
 * Never invents a partner_code - unmatched invoices stay needs_review.
 */
export function matchPartner(
  partners: Partner[],
  input: {
    supplier_name?: string | null;
    supplier_registration_no?: string | null;
  },
): PartnerMatch {
  const allCandidates = partners.map((p) => ({
    partner_code: p.partner_code,
    name: p.name,
  }));

  const reg = input.supplier_registration_no?.trim();
  if (reg) {
    const byReg = partners.find((p) => p.registration_no === reg);
    if (byReg) {
      return {
        partner_code: byReg.partner_code,
        confidence: "high",
        reason: `Matched registration number ${reg}`,
        candidates: [{ partner_code: byReg.partner_code, name: byReg.name }],
      };
    }
  }

  const name = input.supplier_name?.trim();
  if (!name) {
    return {
      partner_code: null,
      confidence: "low",
      reason: "No supplier name or registration number extracted",
      candidates: allCandidates,
    };
  }

  const exact = partners.find(
    (p) => p.name === name || p.aliases.includes(name),
  );
  if (exact) {
    return {
      partner_code: exact.partner_code,
      confidence: "high",
      reason: `Exact match on name/alias: ${name}`,
      candidates: [{ partner_code: exact.partner_code, name: exact.name }],
    };
  }

  const needle = normalize(name);
  const fuzzy = partners.filter((p) => {
    const names = [p.name, ...p.aliases].map(normalize);
    return names.some(
      (n) => n === needle || n.includes(needle) || needle.includes(n),
    );
  });

  if (fuzzy.length === 1) {
    const hit = fuzzy[0];
    return {
      partner_code: hit.partner_code,
      confidence: "medium",
      reason: `Normalized name match for "${name}" → ${hit.name}`,
      candidates: [{ partner_code: hit.partner_code, name: hit.name }],
    };
  }

  if (fuzzy.length > 1) {
    return {
      partner_code: null,
      confidence: "low",
      reason: `Ambiguous match for "${name}" - human must choose`,
      candidates: fuzzy.map((p) => ({
        partner_code: p.partner_code,
        name: p.name,
      })),
    };
  }

  return {
    partner_code: null,
    confidence: "low",
    reason: `No partner master match for "${name}"`,
    candidates: allCandidates,
  };
}
