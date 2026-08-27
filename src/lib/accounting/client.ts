import type { AccountingInvoicePayload } from "@/lib/domain/schema";

export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: ApiError | null;
};

export type Partner = {
  partner_code: string;
  name: string;
  aliases: string[];
  registration_no: string;
};

export type TaxCodeInfo = {
  tax_code: string;
  rate: number;
  label: string;
};

export type RegisteredInvoice = {
  accounting_id: string;
  partner_code: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  line_count: number;
};

export class AccountingApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | null | undefined;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = "AccountingApiError";
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

function baseUrl(): string {
  return (
    process.env.ACCOUNTING_API_URL?.replace(/\/$/, "") ??
    "http://localhost:8080"
  );
}

function apiKey(): string {
  return process.env.ACCOUNTING_API_KEY ?? "demo-key-1234";
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  auth = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (auth) {
    headers.set("X-API-Key", apiKey());
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers });
  const body = (await res.json()) as ApiEnvelope<T>;

  if (!body.success || body.error) {
    throw new AccountingApiError(
      res.status,
      body.error ?? {
        code: "UNKNOWN",
        message: `Request failed with status ${res.status}`,
      },
    );
  }

  return body.data as T;
}

export async function getHealth(): Promise<{
  status: string;
  registered_invoices: number;
}> {
  return request("/health", {}, false);
}

export async function listPartners(): Promise<Partner[]> {
  const data = await request<{ partners: Partner[] }>("/partners");
  return data.partners;
}

export async function listTaxCodes(): Promise<TaxCodeInfo[]> {
  const data = await request<{ tax_codes: TaxCodeInfo[] }>("/tax-codes");
  return data.tax_codes;
}

export async function listInvoices(): Promise<RegisteredInvoice[]> {
  const data = await request<{ invoices: RegisteredInvoice[] }>("/invoices");
  return data.invoices;
}

export async function registerInvoice(
  payload: AccountingInvoicePayload,
): Promise<RegisteredInvoice> {
  return request<RegisteredInvoice>("/invoices", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
