import { describe, expect, it } from 'vitest';
import {
  bankByBin,
  buildVietQrPayload,
  crc16Ccitt,
  sanitizeTransferNote,
  VIETQR_BANKS,
} from './vietqr.js';

describe('crc16Ccitt', () => {
  it('khớp giá trị kiểm tra chuẩn của CRC-16/CCITT-FALSE', () => {
    expect(crc16Ccitt('123456789')).toBe('29B1');
  });

  it('luôn trả về 4 ký tự hex in hoa', () => {
    for (const s of ['', 'A', 'subca', '00020101']) {
      expect(crc16Ccitt(s)).toMatch(/^[0-9A-F]{4}$/);
    }
  });
});

describe('buildVietQrPayload', () => {
  const base = { bankBin: '970422', accountNo: '0901234567' };

  it('sinh chuỗi EMVCo đúng thứ tự trường, có số tiền và nội dung', () => {
    const payload = buildVietQrPayload({
      ...base,
      amountMinor: 65000n,
      description: 'Subca Netflix T10',
    });
    expect(payload.startsWith('000201')).toBe(true);
    // Có số tiền → QR dùng một lần
    expect(payload).toContain('010212');
    expect(payload).toContain('0010A000000727');
    expect(payload).toContain('0006970422');
    expect(payload).toContain('01100901234567');
    expect(payload).toContain('0208QRIBFTTA');
    expect(payload).toContain('5303704');
    expect(payload).toContain('540565000');
    expect(payload).toContain('5802VN');
    expect(payload).toContain('0817SUBCA NETFLIX T10');
  });

  it('CRC ở cuối khớp với phần nội dung phía trước', () => {
    const payload = buildVietQrPayload({ ...base, amountMinor: 1n });
    const body = payload.slice(0, -4);
    expect(body.endsWith('6304')).toBe(true);
    expect(payload.slice(-4)).toBe(crc16Ccitt(body));
  });

  it('không có số tiền thì là QR dùng nhiều lần và không có trường 54', () => {
    const payload = buildVietQrPayload(base);
    expect(payload).toContain('010211');
    expect(payload).not.toContain('5405');
  });

  it('bỏ khoảng trắng trong số tài khoản', () => {
    expect(buildVietQrPayload({ ...base, accountNo: '1903 5566 7788' })).toContain(
      '0112190355667788',
    );
  });

  it('từ chối BIN, số tài khoản và số tiền không hợp lệ', () => {
    expect(() => buildVietQrPayload({ ...base, bankBin: '97042' })).toThrow();
    expect(() => buildVietQrPayload({ ...base, accountNo: '12' })).toThrow();
    expect(() => buildVietQrPayload({ ...base, amountMinor: 0n })).toThrow();
  });
});

describe('sanitizeTransferNote', () => {
  it('bỏ dấu, in hoa, gộp khoảng trắng', () => {
    expect(sanitizeTransferNote('Tiền nhóm Netflix – tháng 10')).toBe('TIEN NHOM NETFLIX THANG');
  });

  it('cắt còn tối đa 25 ký tự, không để lại khoảng trắng ở cuối', () => {
    const note = sanitizeTransferNote('SUBCA YOUTUBE PREMIUM FAMILY T10');
    expect(note.length).toBeLessThanOrEqual(25);
    expect(note).toBe('SUBCA YOUTUBE PREMIUM');
  });
});

describe('VIETQR_BANKS', () => {
  it('BIN gồm 6 số và không trùng', () => {
    const bins = VIETQR_BANKS.map((b) => b.bin);
    expect(new Set(bins).size).toBe(bins.length);
    for (const bin of bins) expect(bin).toMatch(/^\d{6}$/);
  });

  it('tra được ngân hàng theo BIN', () => {
    expect(bankByBin('970436')?.code).toBe('VCB');
    expect(bankByBin('123456')).toBeUndefined();
  });
});
