/* Every price on the site is NET. The customer pays GROSS = net + 23% VAT — shown at the product step,
   in every total and charged by Tpay (the server computes the same numbers, see admin-api startPayment). */
export const VAT_RATE = 0.23;
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const gross = (net) => round2((Number(net) || 0) * (1 + VAT_RATE));
export const vatOf = (net) => round2(gross(net) - (Number(net) || 0));
/* "3 013,50 zł" / "1 229,99 €" — always two decimals, so net and gross line up */
export const fmtMoney = (n, currency = "PLN") =>
  `${(Number(n) || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency === "EUR" ? "€" : "zł"}`;
export const fmtGross = (net, currency = "PLN") => fmtMoney(gross(net), currency);
