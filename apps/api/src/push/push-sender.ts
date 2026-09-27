import {
  Expo,
  type ExpoPushMessage,
  type ExpoPushReceipt,
  type ExpoPushTicket,
} from 'expo-server-sdk';

/** Gửi thông báo push. Tách interface để test không phải gọi Expo thật. */
export interface PushSender {
  send(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]>;
  /** Biên nhận của các ticket; ticket chưa có biên nhận thì không có trong kết quả. */
  getReceipts(ticketIds: string[]): Promise<Record<string, ExpoPushReceipt>>;
}

export const PUSH_SENDER = Symbol('PUSH_SENDER');

export class ExpoPushSender implements PushSender {
  private readonly expo: Expo;

  constructor(accessToken?: string) {
    this.expo = new Expo(accessToken ? { accessToken } : {});
  }

  /** Gửi theo từng lô tối đa 100 thông báo như Expo khuyến nghị; vé trả về theo đúng thứ tự tin nhắn. */
  async send(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    const tickets: ExpoPushTicket[] = [];
    for (const chunk of this.expo.chunkPushNotifications(messages)) {
      tickets.push(...(await this.expo.sendPushNotificationsAsync(chunk)));
    }
    return tickets;
  }

  async getReceipts(
    ticketIds: string[],
  ): Promise<Record<string, ExpoPushReceipt>> {
    const receipts: Record<string, ExpoPushReceipt> = {};
    for (const chunk of this.expo.chunkPushNotificationReceiptIds(ticketIds)) {
      Object.assign(
        receipts,
        await this.expo.getPushNotificationReceiptsAsync(chunk),
      );
    }
    return receipts;
  }
}

export const isExpoPushToken = (token: string): boolean =>
  Expo.isExpoPushToken(token);
