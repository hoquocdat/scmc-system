/**
 * VietQR (NAPAS 247) merchant-presented payload, EMVCo TLV with
 * CRC-16/CCITT-FALSE (design D2).
 */
const tlv = (id: string, value: string) =>
  `${id}${String(value.length).padStart(2, '0')}${value}`;

/** CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflection, no xor-out. */
export function crc16ccitt(input: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(input, 'utf8')) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** ASCII-only description (banks drop diacritics), max 25 characters. */
export const vietqrText = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 25)
    .trim();

export function buildVietQr(input: {
  bankBin: string;
  accountNumber: string;
  amount: number;
  description: string;
}): string {
  const beneficiary = tlv('00', input.bankBin) + tlv('01', input.accountNumber);
  const merchant =
    tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA');
  const body =
    tlv('00', '01') +
    tlv('01', '12') + // dynamic: one amount, one use
    tlv('38', merchant) +
    tlv('53', '704') +
    tlv('54', String(Math.round(input.amount))) +
    tlv('58', 'VN') +
    tlv('62', tlv('08', vietqrText(input.description)));
  const withCrcTag = `${body}6304`;
  return withCrcTag + crc16ccitt(withCrcTag);
}

/** Splits a TLV string (for tests and diagnostics). */
export function parseTlv(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < s.length) {
    const id = s.slice(i, i + 2);
    const len = Number(s.slice(i + 2, i + 4));
    out[id] = s.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}
