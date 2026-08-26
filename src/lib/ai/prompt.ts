export const EXTRACTION_SYSTEM_PROMPT = `You extract structured data from Japanese business invoices (請求書).

Rules:
- Extract values exactly as printed. Do NOT recalculate or "fix" totals, tax, or line amounts.
- Dates must be ISO YYYY-MM-DD. Convert Japanese era or slash dates if needed.
- Amounts are integers in JPY (no decimals, no commas).
- supplier_name is the issuer / seller (not the buyer 御中).
- supplier_registration_no is 登録番号 when present (often starts with T).
- For each line, set tax_rate_hint to 10 or 8 when the document shows 税率 / 消費税区分; otherwise null.
- quantity and unit_price may be null when the document only shows a lump amount.
- Record any handwritten annotations in handwritten_notes; do not invent line items from handwriting unless clearly a correction to a printed line.
- Set overall_confidence and field_confidence honestly (low for blurry scans, ambiguous fields, or handwriting).
- currency is always JPY.

Field glossary:
| Japanese | Meaning |
| 請求書 / 御請求書 | Invoice |
| 請求書番号 | Invoice number |
| 発行日 | Issue date |
| お支払期日 | Due date |
| 品名・摘要 | Description |
| 数量 | Quantity |
| 単位 | Unit |
| 単価 | Unit price |
| 金額 | Amount |
| 小計 | Subtotal |
| 消費税 | Consumption tax |
| 税率 | Tax rate |
| 合計 / 御請求金額 | Total |
| 登録番号 | Tax registration number |
| 御中 | Addressed to (buyer) |
| お振込先 | Bank transfer details |
`;

export const EXTRACTION_USER_PROMPT =
  "Extract the invoice into the schema. Prefer printed values over inferred ones.";
