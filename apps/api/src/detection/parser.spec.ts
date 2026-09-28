import type { EmailCandidate } from '../integrations/mail/mail-provider.js';
import { classifyCandidate } from './candidate-filter.js';
import {
  extractAmount,
  extractDate,
  extractInterval,
  extractLineItems,
  toMinorFromRaw,
} from './extract.js';
import { parseEmail, parseEmails } from './parser.js';

const email = (over: Partial<EmailCandidate>): EmailCandidate => ({
  messageId: 'm1',
  threadId: 't1',
  sender: 'Netflix <info@account.netflix.com>',
  senderEmail: 'info@account.netflix.com',
  senderDomain: 'netflix.com',
  subject: '',
  receivedAt: new Date('2026-09-18T03:00:00Z'),
  textContent: '',
  ...over,
});

describe('lọc ứng viên', () => {
  it('email của merchant đã biết + có từ khóa → ứng viên', () => {
    const verdict = classifyCandidate(
      email({
        subject: 'Your Netflix bill',
        textContent: 'Your subscription renews on October 18.',
      }),
    );
    expect(verdict).toMatchObject({
      isCandidate: true,
      reason: 'merchant-domain',
    });
  });

  it('merchant lạ nhưng nhiều từ khóa → vẫn là ứng viên', () => {
    const verdict = classifyCandidate(
      email({
        senderDomain: 'somerandomapp.io',
        subject: 'Invoice for your subscription',
        textContent: 'Payment received. Your plan renews monthly.',
      }),
    );
    expect(verdict.isCandidate).toBe(true);
  });

  it('bản tin quảng cáo không phải ứng viên', () => {
    const verdict = classifyCandidate(
      email({
        senderDomain: 'news.example.com',
        subject: 'Bản tin tháng 9',
        textContent:
          'Ưu đãi đặc biệt cho bạn. Unsubscribe from this newsletter.',
      }),
    );
    expect(verdict.isCandidate).toBe(false);
  });
});

describe('trích số tiền', () => {
  it('đọc được các cách viết tiền hay gặp', () => {
    expect(extractAmount('Total: $20.00')).toEqual({
      amountMinor: 2000n,
      currency: 'USD',
    });
    expect(extractAmount('Tổng cộng 260.000₫')).toEqual({
      amountMinor: 260000n,
      currency: 'VND',
    });
    expect(extractAmount('Số tiền: 260,000 VND')).toEqual({
      amountMinor: 260000n,
      currency: 'VND',
    });
    expect(extractAmount('Giá 59.000đ mỗi tháng')).toEqual({
      amountMinor: 59000n,
      currency: 'VND',
    });
    expect(extractAmount('Amount US$12.99 charged')).toEqual({
      amountMinor: 1299n,
      currency: 'USD',
    });
  });

  it('VND không có phần lẻ nên mọi dấu chấm đều là ngăn nghìn', () => {
    expect(toMinorFromRaw('1.250.000', 'VND')).toBe(1250000n);
    expect(toMinorFromRaw('1,234.56', 'USD')).toBe(123456n);
    expect(toMinorFromRaw('19,99', 'EUR')).toBe(1999n);
  });

  it('bỏ qua chuỗi không phải tiền', () => {
    expect(extractAmount('Mã đơn 12345')).toBeNull();
  });
});

describe('trích ngày và chu kỳ', () => {
  it('đọc ngày ở nhiều định dạng, ưu tiên đoạn quanh từ khóa', () => {
    expect(extractDate('Next billing date: October 18, 2026')).toBe(
      '2026-10-18',
    );
    expect(extractDate('Gia hạn vào ngày 18 tháng 10 năm 2026')).toBe(
      '2026-10-18',
    );
    expect(extractDate('Ngày gia hạn 18/10/2026')).toBe('2026-10-18');
    expect(extractDate('renews on 2026-10-18')).toBe('2026-10-18');
  });

  it('nhận chu kỳ tháng / năm / quý', () => {
    expect(extractInterval('$20/month')).toEqual({
      intervalUnit: 'MONTH',
      intervalCount: 1,
    });
    expect(extractInterval('billed annually')).toEqual({
      intervalUnit: 'YEAR',
      intervalCount: 1,
    });
    expect(extractInterval('thanh toán mỗi 3 tháng')).toEqual({
      intervalUnit: 'MONTH',
      intervalCount: 3,
    });
  });
});

describe('parseEmail', () => {
  it('hóa đơn Netflix → PAYMENT_SUCCESS kèm tiền, chu kỳ và ngày gia hạn', () => {
    const event = parseEmail(
      email({
        subject: 'Your Netflix receipt',
        textContent:
          'Thank you for your payment. Netflix Premium. Total: 260.000₫ monthly. Next billing date: October 18, 2026.',
      }),
    );
    expect(event).toMatchObject({
      eventType: 'PAYMENT_SUCCESS',
      merchantKey: 'netflix',
      merchantName: 'Netflix',
      amountMinor: 260000n,
      currency: 'VND',
      intervalUnit: 'MONTH',
      intervalCount: 1,
      renewalDate: '2026-10-18',
      parser: 'merchant:netflix',
    });
    expect(event!.confidence).toBeGreaterThanOrEqual(75);
  });

  it('email ChatGPT Plus của OpenAI gom về merchant openai', () => {
    const event = parseEmail(
      email({
        sender: 'OpenAI <billing@openai.com>',
        senderEmail: 'billing@openai.com',
        senderDomain: 'openai.com',
        subject: 'Your receipt from OpenAI',
        textContent:
          'Receipt for ChatGPT Plus subscription. Amount paid $20.00. Billed monthly.',
      }),
    );
    expect(event).toMatchObject({
      eventType: 'PAYMENT_SUCCESS',
      merchantKey: 'openai',
      amountMinor: 2000n,
      currency: 'USD',
      serviceSlug: 'chatgpt-plus',
    });
  });

  it('email dùng thử → TRIAL_STARTED kèm ngày hết dùng thử', () => {
    const event = parseEmail(
      email({
        sender: 'Anthropic <no-reply@anthropic.com>',
        senderEmail: 'no-reply@anthropic.com',
        senderDomain: 'anthropic.com',
        subject: 'Your free trial has started',
        textContent:
          'Welcome to Claude Pro. Your free trial ends on October 2, 2026. Then $20/month.',
      }),
    );
    expect(event).toMatchObject({
      eventType: 'TRIAL_STARTED',
      merchantKey: 'anthropic',
      trialEndDate: '2026-10-02',
    });
  });

  it('email hủy → SUBSCRIPTION_CANCELLED, thắng luật thanh toán', () => {
    const event = parseEmail(
      email({
        sender: 'Spotify <no-reply@spotify.com>',
        senderEmail: 'no-reply@spotify.com',
        senderDomain: 'spotify.com',
        subject: 'Your subscription has been cancelled',
        textContent:
          'Your Spotify Premium subscription has been cancelled. You can still use it until October 30, 2026. Last invoice 59.000₫.',
      }),
    );
    expect(event).toMatchObject({
      eventType: 'SUBSCRIPTION_CANCELLED',
      merchantKey: 'spotify',
      accessUntil: '2026-10-30',
    });
  });

  it('thanh toán lỗi → PAYMENT_FAILED', () => {
    const event = parseEmail(
      email({
        subject: 'We could not charge your card',
        textContent:
          'Your payment failed. Please update your payment method to keep your membership.',
      }),
    );
    expect(event?.eventType).toBe('PAYMENT_FAILED');
  });

  it('hóa đơn gộp của Apple lấy đúng dịch vụ bên trong', () => {
    const event = parseEmail(
      email({
        sender: 'Apple <no_reply@email.apple.com>',
        senderEmail: 'no_reply@email.apple.com',
        senderDomain: 'apple.com',
        subject: 'Your receipt from Apple',
        textContent:
          'Spotify Premium (Monthly) 59.000₫. Your subscription renews on 2026-10-18.',
      }),
    );
    expect(event).toMatchObject({
      merchantKey: 'spotify',
      // Tiêu đề là biên nhận nên đây là lần thanh toán; ngày gia hạn đọc từ nội dung
      eventType: 'PAYMENT_SUCCESS',
      renewalDate: '2026-10-18',
    });
  });

  it('merchant lạ vẫn ra sự kiện với khóa lấy từ tên miền', () => {
    const event = parseEmail(
      email({
        sender: 'Billing <billing@somerandomapp.io>',
        senderEmail: 'billing@somerandomapp.io',
        senderDomain: 'somerandomapp.io',
        subject: 'Invoice for your subscription',
        textContent: 'Payment received: $9.00. Your plan renews monthly.',
      }),
    );
    expect(event).toMatchObject({
      merchantKey: 'somerandomapp',
      merchantName: 'Somerandomapp',
      parser: 'generic',
      amountMinor: 900n,
    });
  });

  it('email không liên quan trả về null', () => {
    expect(
      parseEmail(
        email({
          senderDomain: 'friends.example.com',
          subject: 'Ảnh chuyến đi Đà Lạt',
          textContent: 'Gửi bạn vài tấm ảnh nhé.',
        }),
      ),
    ).toBeNull();
  });
});

describe('tách mục hàng trong hóa đơn', () => {
  it('đọc từng dòng "tên dịch vụ + tiền", bỏ dòng tổng và thuế', () => {
    const items = extractLineItems(
      [
        'Spotify Premium (Monthly)   59.000 ₫',
        'iCloud+ 200GB               59.000 ₫',
        'Subtotal                   118.000 ₫',
        'Thuế VAT                     9.000 ₫',
        'Tổng cộng                  127.000 ₫',
      ].join('\n'),
    );
    expect(items).toEqual([
      {
        label: 'Spotify Premium (Monthly)',
        amountMinor: 59000n,
        currency: 'VND',
        interval: { intervalUnit: 'MONTH', intervalCount: 1 },
      },
      { label: 'iCloud+ 200GB', amountMinor: 59000n, currency: 'VND' },
    ]);
  });

  it('tiền nằm ở dòng riêng (thư HTML dạng bảng) vẫn ghép được với tên phía trên', () => {
    const items = extractLineItems(
      ['Duolingo Super', 'Yearly', '$83.88', 'Notion Plus', '$10.00'].join(
        '\n',
      ),
    );
    expect(items).toMatchObject([
      {
        label: 'Yearly',
        amountMinor: 8388n,
        currency: 'USD',
        interval: { intervalUnit: 'YEAR', intervalCount: 1 },
      },
      { label: 'Notion Plus', amountMinor: 1000n, currency: 'USD' },
    ]);
  });
});

describe('hóa đơn gộp nhiều dịch vụ', () => {
  const appleReceipt = email({
    sender: 'Apple <no_reply@email.apple.com>',
    senderEmail: 'no_reply@email.apple.com',
    senderDomain: 'apple.com',
    subject: 'Your receipt from Apple',
    textContent: [
      'Spotify Premium (Monthly)      59.000 ₫',
      'iCloud+ 200GB                  59.000 ₫',
      'Bear Pro (Yearly)             399.000 ₫',
      'Tổng cộng                     517.000 ₫',
    ].join('\n'),
  });

  it('mỗi dịch vụ trong biên nhận Apple thành một sự kiện riêng', () => {
    const events = parseEmails(appleReceipt);
    expect(events.map((e) => e.merchantKey)).toEqual([
      'spotify',
      'icloud',
      'bear-pro',
    ]);
    expect(events.map((e) => e.amountMinor)).toEqual([59000n, 59000n, 399000n]);
    expect(events.every((e) => e.parser === 'aggregate:apple')).toBe(true);
    expect(events[0]).toMatchObject({
      eventType: 'PAYMENT_SUCCESS',
      serviceSlug: 'spotify',
      intervalUnit: 'MONTH',
    });
    expect(events[2]).toMatchObject({
      merchantName: 'Bear Pro',
      intervalUnit: 'YEAR',
      intervalCount: 1,
    });
  });

  it('dịch vụ lạ trong hóa đơn có độ tin cậy thấp hơn dịch vụ đã biết', () => {
    const events = parseEmails(appleReceipt);
    expect(events[2]!.confidence).toBeLessThan(events[0]!.confidence);
  });

  it('hóa đơn Google Play gộp hai app', () => {
    const events = parseEmails(
      email({
        sender: 'Google Play <googleplay-noreply@google.com>',
        senderEmail: 'googleplay-noreply@google.com',
        senderDomain: 'google.com',
        subject: 'Hóa đơn Google Play của bạn',
        textContent: [
          'Cảm ơn bạn đã thanh toán.',
          'YouTube Premium   79.000₫',
          'ELSA Speak        149.000₫',
        ].join('\n'),
      }),
    );
    expect(events.map((e) => e.merchantKey)).toEqual(['youtube', 'elsa']);
    expect(events.map((e) => e.serviceSlug)).toEqual([
      'youtube-premium',
      'elsa-speak',
    ]);
  });

  it('hóa đơn gộp chỉ có một dịch vụ vẫn đi đường thường (giữ được ngày gia hạn)', () => {
    const events = parseEmails(
      email({
        sender: 'Apple <no_reply@email.apple.com>',
        senderEmail: 'no_reply@email.apple.com',
        senderDomain: 'apple.com',
        subject: 'Your receipt from Apple',
        textContent:
          'Spotify Premium (Monthly) 59.000₫. Your subscription renews on 2026-10-18.',
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      merchantKey: 'spotify',
      renewalDate: '2026-10-18',
      parser: 'merchant:spotify',
    });
  });
});
