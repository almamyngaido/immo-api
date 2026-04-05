/** Supprime balises HTML et caractères d'injection NoSQL */
export function sanitiserTexte(input: string, maxLen = 5000): string {
  return input
    .trim()
    .replace(/<[^>]*>/g, '')      // balises HTML
    .replace(/[{}$]/g, '')        // injection NoSQL MongoDB
    .substring(0, maxLen);
}

export function sanitiserEmail(email: string): string {
  return email.trim().toLowerCase().substring(0, 255);
}

export function sanitiserTelephone(tel: string): string {
  return tel.replace(/[^\d+]/g, '').substring(0, 15);
}
