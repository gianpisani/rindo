const EMAIL_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "yahoo.com",
  "live.com",
];

export function getDomainSuggestion(email: string): string | null {
  const atIndex = email.indexOf("@");
  if (atIndex === -1 || atIndex === 0) return null;
  const partial = email.slice(atIndex + 1);
  if (!partial) return EMAIL_DOMAINS[0];
  const match = EMAIL_DOMAINS.find((d) => d.startsWith(partial.toLowerCase()));
  if (match && match !== partial.toLowerCase()) return match;
  return null;
}

export function getVisibleDomains(email: string): string[] {
  const atIndex = email.indexOf("@");
  if (atIndex === -1 || atIndex === 0) return [];
  const partial = email.slice(atIndex + 1).toLowerCase();
  if (!partial) return EMAIL_DOMAINS.slice(0, 4);
  return EMAIL_DOMAINS.filter((d) => d.startsWith(partial) && d !== partial).slice(0, 4);
}

export function hasEmailLocalPart(email: string): boolean {
  return email.includes("@") && email.indexOf("@") > 0;
}

export function withDomain(email: string, domain: string): string {
  return email.slice(0, email.indexOf("@") + 1) + domain;
}
