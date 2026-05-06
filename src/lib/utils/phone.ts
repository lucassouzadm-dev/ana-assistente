export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) {
    return `+${digits}`
  }
  if (digits.length === 11 || digits.length === 10) {
    return `+55${digits}`
  }
  return `+${digits}`
}

/**
 * Returns all equivalent phone formats for a Brazilian number (with and without
 * the mobile 9 prefix). Useful for DB queries that need to match both formats.
 */
export function phoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, '')
  const variants = new Set<string>([phone, `+${digits}`, digits])

  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4)
    const rest = digits.slice(4)
    if (rest.startsWith('9') && rest.length === 9) {
      const without9 = `55${ddd}${rest.slice(1)}`
      variants.add(without9)
      variants.add(`+${without9}`)
    }
  } else if (digits.length === 12 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4)
    const rest = digits.slice(4)
    if (rest.length === 8) {
      const with9 = `55${ddd}9${rest}`
      variants.add(with9)
      variants.add(`+${with9}`)
    }
  }
  return Array.from(variants)
}

/**
 * Reduces a Brazilian phone (any common format) to a canonical 13-digit form
 * starting with country code 55 and including the mobile 9 prefix.
 * Returns the digits-only string if it can't be canonicalized.
 *
 * Handles:
 *   - "+5575982405262" / "5575982405262"   → "5575982405262"
 *   - "+557582405262" / "557582405262"     → "5575982405262" (adds 9)
 *   - "75982405262" / "(75) 98240-5262"    → "5575982405262" (adds 55)
 *   - "7582405262" / "(75) 8240-5262"      → "5575982405262" (adds 55 and 9)
 *   - "982405262" / "98240-5262"           → "982405262" (no DDD, can't canonicalize)
 */
function brCanonical(phone: string): string {
  let d = phone.replace(/\D/g, '')

  // Strip country code if present
  if (d.length === 13 && d.startsWith('55')) d = d.slice(2)
  else if (d.length === 12 && d.startsWith('55')) d = d.slice(2)

  // Now d should be 10 (DDD + 8) or 11 (DDD + 9 + 8) digits for BR mobile
  if (d.length === 11 && d[2] === '9') {
    return `55${d}`
  }
  if (d.length === 10) {
    // Legacy 8-digit number without the 9 — add it
    return `55${d.slice(0, 2)}9${d.slice(2)}`
  }

  // Not a recognizable BR mobile — fall back to digits-only
  return phone.replace(/\D/g, '')
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const digitsA = a.replace(/\D/g, '')
  const digitsB = b.replace(/\D/g, '')
  if (digitsA === digitsB) return true
  return brCanonical(a) === brCanonical(b)
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) {
    const ddd = digits.slice(2, 4)
    const number = digits.slice(4)
    if (number.length === 9) {
      return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`
    }
    return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`
  }
  return phone
}
