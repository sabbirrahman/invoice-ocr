import { InvoiceReview } from "@/components/invoice-review";

type Params = { params: Promise<{ id: string }> };

export default async function InvoiceReviewPage({ params }: Params) {
  const { id } = await params;
  return <InvoiceReview id={id} />;
}
