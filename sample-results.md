# Sample invoice results

Canonical write-up is [SUBMISSION.md](./SUBMISSION.md) §6. Scratch copy of the 12-file run:

Captured from a run of the 12 bundled samples. Status is after extraction +
deterministic verify, before human register.

| Invoice        | Result                                    | How we handled it                                                                 |
| -------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| invoice_01.pdf | Ready - P-1001 / YM-2026-0107 / ¥334,400  | Registration number match. Same number as invoice_07.jpg (PDF vs scan).           |
| invoice_02.pdf | Ready - P-1004 / OSK-26-0112 / ¥1,560,988 | Registration number match. Totals matched printed.                                |
| invoice_03.pdf | Ready - P-1003 / TF-2026-0115 / ¥125,357  | Mixed T08/T10 lines; tax recomputed per code with floor.                          |
| invoice_04.jpg | Ready - P-1002 / SATO-260118 / ¥240,900   | Handwriting warning (`受領 1/20 経理`) - not booked as a line.                    |
| invoice_05.jpg | Ready - P-1005 / MIT-2026-011 / ¥436,700  | Registration number match.                                                        |
| invoice_06.jpg | Ready - P-1001 / YM-2026-0122 / ¥102,300  | Same partner as 01, different invoice number.                                     |
| invoice_07.jpg | Ready - P-1001 / YM-2026-0107 / ¥334,400  | Same partner+number as invoice_01.pdf. Queue warning, not auto-posted.            |
| invoice_08.jpg | Ready - P-1003 / TF-2026-0125 / ¥118,936  | Handwriting warning (`至急`, quantity change). Human must confirm.                |
| invoice_09.pdf | Ready - P-1004 / OSK-26-0128 / ¥147,496   | Printed total ¥147,497. We keep floor-tax total so the accounting API accepts it. |
| invoice_10.jpg | Needs review - 新星ロジスティクス株式会社 | Supplier not in partner master (`T9090009000909`). No guessed `partner_code`.     |
| invoice_11.jpg | Ready - P-1002 / SATO-260205 / ¥125,070   | Registration number match.                                                        |
| invoice_12.jpg | Ready - P-1005 / MIT-2026-014 / ¥594,000  | Includes a discount line (negative amount); totals still match.                   |

Register of the same partner+invoice number is refused by `GET /invoices` in our app and by the API `409 DUPLICATE_INVOICE`.
