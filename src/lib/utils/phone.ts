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

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const digitsA = a.replace(/\D/g, '')
  const digitsB = b.replace(/\D/g, '')
  if (digitsA === digitsB) return true

  // Handle BR mobile: 13-digit (with 9 prefix) vs 12-digit (legacy without 9)
  // Format: 55 + DDD(2) + [9] + number(8)
  const stripBr9 = (p: string) => {
    if (p.length === 13 && p.startsWith('55')) {
      const ddd = p.slice(2, 4)
      const rest = p.slice(4)
      if (rest.startsWith('9') && rest.length === 9) {
        return `55${ddd}${rest.slice(1)}`
      }
    }
    return p
  }
  const addBr9 = (p: string) => {
    if (p.length === 12 && p.startsWith('55')) {
      const ddd = p.slice(2, 4)
      const rest = p.slice(4)
      if (rest.length === 8) {
        return `55${ddd}9${rest}`
      }
    }
    return p
  }
  return stripBr9(digitsA) === stripBr9(digitsB) || addBr9(digitsA) === addBr9(digitsB)
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
