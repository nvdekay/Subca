import { z } from 'zod';

/** Định dạng token của Expo: ExponentPushToken[...] hoặc ExpoPushToken[...]. */
const ExpoPushTokenString = z
  .string()
  .max(200)
  .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'Token push không hợp lệ');

export const RegisterPushTokenSchema = z.object({
  token: ExpoPushTokenString,
  platform: z.enum(['IOS', 'ANDROID']),
  deviceName: z.string().trim().max(80).nullable().optional(),
  appVersion: z.string().trim().max(20).nullable().optional(),
});
export type RegisterPushToken = z.infer<typeof RegisterPushTokenSchema>;

export const UnregisterPushTokenSchema = z.object({ token: ExpoPushTokenString });
export type UnregisterPushToken = z.infer<typeof UnregisterPushTokenSchema>;
