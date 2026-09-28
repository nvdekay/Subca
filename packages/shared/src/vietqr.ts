/**
 * Sinh nội dung mã QR chuyển khoản theo chuẩn VietQR (NAPAS) — định dạng EMVCo QR
 * cho dịch vụ chuyển nhanh NAPAS247 tới số tài khoản (QRIBFTTA).
 *
 * Chuỗi trả về là dữ liệu để app vẽ thành QR (không phải ảnh): app dùng thư viện QR
 * vẽ lại chuỗi này. Chỉ hỗ trợ VND vì NAPAS247 chỉ chuyển tiền đồng.
 */

/** BIN 6 số của ngân hàng theo danh sách NAPAS. */
export const BankBinSchemaRegex = /^\d{6}$/;

export interface VietQrInput {
  /** BIN ngân hàng nhận (6 số, theo danh sách NAPAS). */
  bankBin: string;
  /** Số tài khoản người nhận. */
  accountNo: string;
  /** Số tiền (đồng). Bỏ trống = QR để người chuyển tự nhập. */
  amountMinor?: bigint;
  /** Nội dung chuyển khoản, VD "SUBCA NETFLIX T10". */
  description?: string;
}

/** CRC-16/CCITT-FALSE (khởi tạo 0xFFFF, đa thức 0x1021) — chuẩn CRC của EMVCo. */
export function crc16Ccitt(text: string): string {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Một trường EMVCo: mã 2 số + độ dài 2 số + giá trị. */
function field(id: string, value: string): string {
  if (value.length > 99) throw new Error(`Trường ${id} dài quá 99 ký tự`);
  return id + String(value.length).padStart(2, '0') + value;
}

const DIACRITICS: Record<string, string> = {
  a: 'àáạảãâầấậẩẫăằắặẳẵ',
  e: 'èéẹẻẽêềếệểễ',
  i: 'ìíịỉĩ',
  o: 'òóọỏõôồốộổỗơờớợởỡ',
  u: 'ùúụủũưừứựửữ',
  y: 'ỳýỵỷỹ',
  d: 'đ',
};

/**
 * Nội dung chuyển khoản: bỏ dấu, chỉ giữ chữ/số/khoảng trắng, in hoa, tối đa 25 ký tự
 * (giới hạn của phần lớn ngân hàng Việt Nam).
 */
export function sanitizeTransferNote(text: string, maxLength = 25): string {
  let out = '';
  for (const raw of text.toLowerCase()) {
    let ch = raw;
    for (const [plain, marked] of Object.entries(DIACRITICS)) {
      if (marked.includes(ch)) {
        ch = plain;
        break;
      }
    }
    if (/[a-z0-9]/.test(ch)) out += ch;
    else if (/\s/.test(ch) && !out.endsWith(' ')) out += ' ';
  }
  out = out.trim();
  if (out.length > maxLength) {
    // Cắt ở ranh giới từ để nội dung không bị đứt giữa chữ ("... THANG 1")
    const cut = out.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(' ');
    out = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  }
  return out.trim().toUpperCase();
}

/**
 * Chuỗi dữ liệu QR VietQR. Có số tiền → QR dùng một lần (point of initiation 12),
 * không có số tiền → QR dùng nhiều lần (11).
 */
export function buildVietQrPayload(input: VietQrInput): string {
  if (!BankBinSchemaRegex.test(input.bankBin)) {
    throw new Error(`BIN ngân hàng không hợp lệ: ${input.bankBin}`);
  }
  const accountNo = input.accountNo.replace(/\s/g, '');
  if (!/^[0-9A-Za-z]{4,19}$/.test(accountNo)) {
    throw new Error(`Số tài khoản không hợp lệ: ${input.accountNo}`);
  }
  if (input.amountMinor !== undefined && input.amountMinor <= 0n) {
    throw new Error('Số tiền trên QR phải lớn hơn 0');
  }

  const beneficiary = field('00', input.bankBin) + field('01', accountNo);
  const merchantAccount =
    field('00', 'A000000727') + field('01', beneficiary) + field('02', 'QRIBFTTA');
  const note = input.description ? sanitizeTransferNote(input.description) : '';

  const body =
    field('00', '01') +
    field('01', input.amountMinor === undefined ? '11' : '12') +
    field('38', merchantAccount) +
    field('53', '704') +
    (input.amountMinor === undefined ? '' : field('54', input.amountMinor.toString())) +
    field('58', 'VN') +
    (note ? field('62', field('08', note)) : '');

  const withCrcTag = `${body}6304`;
  return withCrcTag + crc16Ccitt(withCrcTag);
}

/**
 * Các ngân hàng hay dùng để người dùng chọn khi nhập thông tin nhận tiền.
 * BIN theo danh sách NAPAS — **cần đối chiếu lại với bảng công bố của NAPAS/VietQR trước khi ra mắt**.
 */
export const VIETQR_BANKS: readonly { bin: string; code: string; name: string }[] = [
  { bin: '970436', code: 'VCB', name: 'Vietcombank' },
  { bin: '970415', code: 'ICB', name: 'VietinBank' },
  { bin: '970418', code: 'BIDV', name: 'BIDV' },
  { bin: '970405', code: 'VBA', name: 'Agribank' },
  { bin: '970407', code: 'TCB', name: 'Techcombank' },
  { bin: '970422', code: 'MB', name: 'MB Bank' },
  { bin: '970416', code: 'ACB', name: 'ACB' },
  { bin: '970432', code: 'VPB', name: 'VPBank' },
  { bin: '970423', code: 'TPB', name: 'TPBank' },
  { bin: '970403', code: 'STB', name: 'Sacombank' },
  { bin: '970437', code: 'HDB', name: 'HDBank' },
  { bin: '970441', code: 'VIB', name: 'VIB' },
  { bin: '970443', code: 'SHB', name: 'SHB' },
  { bin: '970448', code: 'OCB', name: 'OCB' },
  { bin: '970426', code: 'MSB', name: 'MSB' },
  { bin: '970468', code: 'SEAB', name: 'SeABank' },
  { bin: '970431', code: 'EIB', name: 'Eximbank' },
  { bin: '970449', code: 'LPB', name: 'LPBank' },
  { bin: '970412', code: 'PVCB', name: 'PVcomBank' },
  { bin: '970425', code: 'ABB', name: 'ABBANK' },
  { bin: '970428', code: 'NAB', name: 'Nam A Bank' },
  { bin: '970409', code: 'BAB', name: 'BacA Bank' },
  { bin: '970419', code: 'NCB', name: 'NCB' },
  { bin: '970427', code: 'VAB', name: 'VietABank' },
];

export const bankByBin = (bin: string): (typeof VIETQR_BANKS)[number] | undefined =>
  VIETQR_BANKS.find((b) => b.bin === bin);
