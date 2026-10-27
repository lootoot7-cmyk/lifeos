export function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function defaultCurrencyFor(country: string): string {
  const map: Record<string, string> = {
    PK: "PKR",
    IN: "INR",
    AE: "AED",
    SA: "SAR",
    GB: "GBP",
    US: "USD",
    CA: "CAD",
    AU: "AUD",
    DE: "EUR",
    FR: "EUR",
  };
  return map[country.toUpperCase()] ?? "USD";
}
