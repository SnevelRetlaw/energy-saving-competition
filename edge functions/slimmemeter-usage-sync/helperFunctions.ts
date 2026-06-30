function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function formatDateSMP(d: Date) {
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function formatDate(d: Date) {
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

export function parseDutchNumber(dutch_number_str: string) {
    if (!dutch_number_str) return null;
    const cleanStr = String(dutch_number_str)
        .replace(/\./g, '')      // Remove thousands separators (dots)
        .replace(',', '.');      // Replace decimal comma with dot
    return parseFloat(cleanStr) || null;
};

export function getEnvVar(variable: string): string {
  const v = Deno.env.get(variable)
  if (!v) throw new Error(`Missing required environment variable: ${variable}`)
  return v
}