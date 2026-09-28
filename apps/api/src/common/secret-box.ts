import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Mã hóa các bí mật lưu trong database (hiện dùng cho refresh token OAuth của hộp thư).
 *
 * AES-256-GCM: mỗi lần mã hóa sinh IV riêng, kèm thẻ xác thực nên dữ liệu bị sửa sẽ giải mã lỗi.
 * Khóa lấy từ `SECRETS_KEY` (32 byte, base64) — đổi khóa thì phải mã hóa lại toàn bộ token.
 */
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

export class SecretBox {
  private readonly key: Buffer | null;

  constructor(base64Key: string | undefined) {
    this.key = base64Key ? parseKey(base64Key) : null;
  }

  /** Máy chủ đã có khóa chưa; chưa có thì không cho kết nối hộp thư. */
  get configured(): boolean {
    return this.key !== null;
  }

  /** Trả về chuỗi `iv.ciphertext.tag`, tất cả base64url. */
  encrypt(plaintext: string): string {
    const key = this.requireKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return [
      iv.toString('base64url'),
      ciphertext.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
    ].join('.');
  }

  decrypt(payload: string): string {
    const key = this.requireKey();
    const [iv, ciphertext, tag] = payload.split('.');
    if (!iv || !ciphertext || !tag)
      throw new Error('Chuỗi mã hóa không đúng định dạng');
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new Error('Thiếu SECRETS_KEY — không mã hóa được token hộp thư');
    }
    return this.key;
  }
}

function parseKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `SECRETS_KEY phải là 32 byte dạng base64 (đang là ${key.length} byte)`,
    );
  }
  return key;
}
