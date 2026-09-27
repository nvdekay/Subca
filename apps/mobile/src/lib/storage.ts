import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createMMKV } from 'react-native-mmkv';

const KEY_NAME = 'subca.mmkv-key';

/**
 * Khóa mã hóa MMKV nằm trong Keychain/Keystore (SecureStore), dữ liệu nằm trong MMKV.
 * Không để thẳng phiên đăng nhập vào SecureStore vì giới hạn ~2 KB, còn phiên Supabase thường dài hơn.
 */
function encryptionKey(): string {
  const existing = SecureStore.getItem(KEY_NAME);
  if (existing) return existing;
  // 16 byte ngẫu nhiên → 32 ký tự hex, đúng độ dài khóa tối đa của AES-256 trong MMKV.
  const bytes = Crypto.getRandomBytes(16);
  const key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  SecureStore.setItem(KEY_NAME, key);
  return key;
}

/** Kho mã hóa cho phiên đăng nhập. */
export const secureStorage = createMMKV({
  id: 'subca-secure',
  encryptionKey: encryptionKey(),
  encryptionType: 'AES-256',
});

/** Adapter theo interface storage của supabase-js. */
export const supabaseStorage = {
  getItem: (key: string) => secureStorage.getString(key) ?? null,
  setItem: (key: string, value: string) => secureStorage.set(key, value),
  removeItem: (key: string) => {
    secureStorage.remove(key);
  },
};
