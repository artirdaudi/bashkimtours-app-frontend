const MONTHS_SQ = ["Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor", "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"];
const MONTHS_SHORT_SQ = ["JAN", "SHK", "MAR", "PRI", "MAJ", "QER", "KOR", "GUS", "SHT", "TET", "NËN", "DHJ"];

export const monthSq = (month, fallback = "") => MONTHS_SQ[Number(month) - 1] || fallback;
export const monthShortSq = (month, fallback = "") => MONTHS_SHORT_SQ[Number(month) - 1] || fallback;
