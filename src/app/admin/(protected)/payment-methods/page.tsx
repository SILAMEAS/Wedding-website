import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { parseLocalized } from "@/lib/validation/localized";
import { requireAdmin } from "@/server/policies/admin";
import { listPaymentMethods } from "@/server/services/gift.service";
import { PaymentMethodManager } from "./payment-method-forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.payments"))("title") };
}

export default async function PaymentMethodsPage() {
  const ctx = await requireAdmin();
  const [t, methods] = await Promise.all([getTranslations("Admin.payments"), listPaymentMethods(ctx)]);
  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <PaymentMethodManager
        items={methods.map((m) => ({
          id: m.id,
          method: m.method === "KHQR" ? "KHQR" : "BANK_TRANSFER",
          label: parseLocalized(m.label),
          bankName: m.bankName ?? "",
          accountHolder: m.accountHolder ?? "",
          accountNumber: m.accountNumber ?? "",
          currencies: m.currencies,
          qrAssetId: m.qrAssetId,
          qr: m.qr,
          instructions: parseLocalized(m.instructions),
          isActive: m.isActive,
        }))}
      />
    </>
  );
}
