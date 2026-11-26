import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { WEDDING_TIME_ZONE } from "./locales";
import { LOCALE_COOKIE, routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  // Public routes provide the locale from the [locale] segment.
  // Admin routes have no segment, so fall back to the persisted cookie.
  let requested = await requestLocale;
  if (!requested) {
    requested = (await cookies()).get(LOCALE_COOKIE)?.value;
  }
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    timeZone: WEDDING_TIME_ZONE,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
