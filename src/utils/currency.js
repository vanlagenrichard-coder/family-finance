// src/utils/currency.js
export function formatCurrency(amount, currency = "CAD", locale = "en-CA") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(amount) || 0);
}