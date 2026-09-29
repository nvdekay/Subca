import {
  CURRENCY_DECIMALS,
  CreateSubscriptionSchema,
  toMinor,
  type CatalogServiceDto,
  type CreateSubscriptionInput,
  type CurrencyCode,
  type IntervalUnit,
  type IsoDate,
  type ServicePlanDto,
  type SubscriptionDetailDto,
  type UpdateSubscriptionInput,
} from '@subca/shared';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ServiceLogo } from '@/components/service-logo';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Segmented } from '@/components/ui/segmented';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { formatAmount, perInterval } from '@/lib/format';
import { colors, shadow } from '@/theme';
import { PaymentMethodSheet } from '@/features/payments/payment-method-sheet';
import { paymentMethodLabel } from './labels';
import { useCatalog, usePaymentMethods } from './queries';

/** Dịch vụ hay dùng ở VN, hiện sẵn ở ô "Chọn nhanh" (theo logoKey trong thư viện). */
const QUICK_PICK = [
  'netflix',
  'spotify',
  'youtube',
  'icloud',
  'openai',
  'google',
  'canva',
  'notion',
];

const CURRENCIES: { value: CurrencyCode; label: string }[] = [
  { value: 'VND', label: 'VND' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'JPY', label: 'JPY' },
];

/** Chu kỳ thường gặp; gói có chu kỳ khác (VD 6 tháng) giữ nguyên nếu người dùng không đổi. */
const INTERVALS = [
  { value: 'WEEK', label: 'Tuần', unit: 'WEEK', count: 1 },
  { value: 'MONTH', label: 'Tháng', unit: 'MONTH', count: 1 },
  { value: 'QUARTER', label: 'Quý', unit: 'MONTH', count: 3 },
  { value: 'YEAR', label: 'Năm', unit: 'YEAR', count: 1 },
] as const satisfies readonly { value: string; label: string; unit: IntervalUnit; count: number }[];
type IntervalKey = (typeof INTERVALS)[number]['value'];

const REMINDERS = [
  { value: 1, label: '1 ngày' },
  { value: 3, label: '3 ngày' },
  { value: 7, label: '7 ngày' },
  { value: 30, label: '30 ngày' },
];

export type FormValues = {
  service: Pick<CatalogServiceDto, 'id' | 'name' | 'logoKey' | 'brandColor'> | null;
  servicePlanId: string | null;
  customName: string;
  planName: string;
  amount: string;
  currency: CurrencyCode;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  billingDate: IsoDate;
  isTrial: boolean;
  autoRenew: boolean;
  paymentMethodId: string | null;
  /** null = theo cài đặt chung. */
  reminder: number | null;
  notes: string;
};

function todayLocal(): IsoDate {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** Số tiền (đơn vị nhỏ nhất) → chuỗi để sửa trong ô nhập: 1999 USD → "19.99", 260000 VND → "260000". */
function amountText(minor: string, currency: CurrencyCode): string {
  const decimals = CURRENCY_DECIMALS[currency];
  if (decimals === 0) return minor;
  const padded = minor.padStart(decimals + 1, '0');
  return `${padded.slice(0, -decimals)}.${padded.slice(-decimals)}`.replace(/\.?0+$/, '');
}

export function emptyValues(): FormValues {
  return {
    service: null,
    servicePlanId: null,
    customName: '',
    planName: '',
    amount: '',
    currency: 'VND',
    intervalUnit: 'MONTH',
    intervalCount: 1,
    billingDate: todayLocal(),
    isTrial: false,
    autoRenew: true,
    paymentMethodId: null,
    reminder: 3,
    notes: '',
  };
}

export function valuesFrom(sub: SubscriptionDetailDto): FormValues {
  return {
    service: sub.service,
    servicePlanId: sub.servicePlanId,
    customName: sub.service ? '' : sub.name,
    planName: sub.planName ?? '',
    amount: amountText(sub.amountMinor, sub.currency),
    currency: sub.currency,
    intervalUnit: sub.intervalUnit,
    intervalCount: sub.intervalCount,
    billingDate: (sub.status === 'TRIAL' ? sub.trialEndDate : sub.nextRenewalDate) ?? sub.startDate,
    isTrial: sub.status === 'TRIAL',
    autoRenew: sub.autoRenew,
    paymentMethodId: sub.paymentMethodId,
    reminder: sub.reminderOffsets[0] ?? null,
    notes: sub.notes ?? '',
  };
}

/**
 * Chuẩn hóa số người dùng gõ: VND/JPY không có số lẻ nên bỏ mọi dấu chấm/phẩy ("260.000" → "260000");
 * USD/EUR nhận cả dấu phẩy thập phân ("19,99" → "19.99").
 */
function normalizeAmount(text: string, currency: CurrencyCode): string {
  const t = text.replace(/\s/g, '');
  return CURRENCY_DECIMALS[currency] === 0 ? t.replace(/[.,]/g, '') : t.replace(',', '.');
}

type Errors = Partial<Record<'name' | 'amount' | 'form', string>>;

/** Đổi giá trị form sang body cho POST; lỗi thì trả về thông báo theo từng ô. */
function toCreateInput(v: FormValues): { input?: CreateSubscriptionInput; errors: Errors } {
  const errors: Errors = {};
  if (!v.service && !v.customName.trim()) errors.name = 'Nhập tên hoặc chọn một dịch vụ';
  let amountMinor = '';
  try {
    amountMinor = toMinor(normalizeAmount(v.amount, v.currency), v.currency).toString();
  } catch {
    errors.amount =
      CURRENCY_DECIMALS[v.currency] === 0
        ? 'Nhập số tiền, VD 260000'
        : `Nhập số tiền, VD 19.99 (tối đa ${CURRENCY_DECIMALS[v.currency]} số lẻ)`;
  }
  if (Object.keys(errors).length > 0) return { errors };

  const input: CreateSubscriptionInput = {
    serviceId: v.service?.id ?? null,
    servicePlanId: v.servicePlanId,
    customName: v.service ? null : v.customName.trim(),
    planName: v.planName.trim() || null,
    amountMinor,
    currency: v.currency,
    intervalUnit: v.intervalUnit,
    intervalCount: v.intervalCount,
    billingDate: v.billingDate,
    isTrial: v.isTrial,
    autoRenew: v.autoRenew,
    paymentMethodId: v.paymentMethodId,
    reminderOffsets: v.reminder == null ? [] : [v.reminder],
    notes: v.notes.trim() || null,
  };
  const parsed = CreateSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { errors: { form: parsed.error.issues[0]?.message ?? 'Thông tin chưa hợp lệ' } };
  }
  return { input, errors };
}

/**
 * Chỉ gửi các trường đã đổi khi sửa. Đặc biệt ngày gia hạn: gửi lại sẽ làm server đổi ngày bắt đầu
 * của lịch gia hạn, nên chỉ gửi khi người dùng thật sự chọn ngày khác.
 */
function toUpdateInput(
  initial: FormValues,
  v: FormValues,
): { input?: UpdateSubscriptionInput; errors: Errors } {
  const created = toCreateInput(v);
  if (!created.input) return { errors: created.errors };
  const next = created.input;
  const before = toCreateInput(initial).input;
  const input: UpdateSubscriptionInput = {};
  const keys = Object.keys(next) as (keyof CreateSubscriptionInput)[];
  for (const key of keys) {
    if (JSON.stringify(next[key]) !== JSON.stringify(before?.[key])) {
      (input as Record<string, unknown>)[key] = next[key];
    }
  }
  // Không gửi billingDate khi không đổi ngày: đổi chu kỳ thì server tự tính lại từ ngày bắt đầu cũ.
  return { input, errors: {} };
}

export function SubscriptionForm({
  initial,
  mode,
  submitting,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  initial: FormValues;
  mode: 'create' | 'edit';
  submitting: boolean;
  onSubmitCreate?: (input: CreateSubscriptionInput) => void;
  onSubmitUpdate?: (input: UpdateSubscriptionInput) => void;
}) {
  const [v, setV] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [optionsOpen, setOptionsOpen] = useState(mode === 'edit');
  const [pickerOpen, setPickerOpen] = useState(false);
  const catalog = useCatalog();
  const paymentMethods = usePaymentMethods();

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setV((old) => ({ ...old, [key]: value }));
    if (key === 'amount' && errors.amount) setErrors((e) => ({ ...e, amount: undefined }));
    if (key === 'customName' && errors.name) setErrors((e) => ({ ...e, name: undefined }));
  };

  // Thêm mới: chọn sẵn phương thức mặc định cho tới khi người dùng tự chọn (tính ra, không ghi đè state).
  const [pmTouched, setPmTouched] = useState(mode === 'edit');
  const defaultPmId =
    mode === 'create' ? (paymentMethods.data?.find((m) => m.isDefault)?.id ?? null) : null;
  const paymentMethodId = pmTouched ? v.paymentMethodId : (v.paymentMethodId ?? defaultPmId);
  // key để dựng lại sheet (reset ô nhập) mỗi lần mở; null = đang đóng.
  const [pmSheetKey, setPmSheetKey] = useState<number | null>(null);
  const pickPaymentMethod = (id: string | null) => {
    setPmTouched(true);
    set('paymentMethodId', id);
  };

  const selectedService = useMemo(
    () => catalog.data?.find((s) => s.id === v.service?.id) ?? null,
    [catalog.data, v.service],
  );
  const quickPick = useMemo(
    () =>
      QUICK_PICK.map((key) => catalog.data?.find((s) => s.logoKey === key)).filter(
        (s): s is CatalogServiceDto => Boolean(s),
      ),
    [catalog.data],
  );

  function pickService(service: CatalogServiceDto) {
    setV((old) => ({
      ...old,
      service,
      customName: '',
      servicePlanId: null,
    }));
    setErrors((e) => ({ ...e, name: undefined }));
    // Dịch vụ chỉ có 1 gói thì điền luôn giá.
    if (service.plans.length === 1) pickPlan(service.plans[0]!);
  }

  function pickPlan(plan: ServicePlanDto) {
    setV((old) => ({
      ...old,
      servicePlanId: plan.id,
      planName: plan.name,
      amount: amountText(plan.amountMinor, plan.currency),
      currency: plan.currency,
      intervalUnit: plan.intervalUnit,
      intervalCount: plan.intervalCount,
    }));
    setErrors((e) => ({ ...e, amount: undefined }));
  }

  function clearService() {
    setV((old) => ({ ...old, service: null, servicePlanId: null, planName: '' }));
  }

  function submit() {
    if (mode === 'create') {
      const { input, errors: e } = toCreateInput({ ...v, paymentMethodId });
      setErrors(e);
      if (input) onSubmitCreate?.(input);
    } else {
      const { input, errors: e } = toUpdateInput(initial, v);
      setErrors(e);
      if (input) onSubmitUpdate?.(input);
    }
  }

  const intervalKey: IntervalKey | null =
    INTERVALS.find((i) => i.unit === v.intervalUnit && i.count === v.intervalCount)?.value ?? null;

  return (
    <>
      {/* ── Dịch vụ ── */}
      {v.service ? (
        <View
          className="mb-4 flex-row items-center gap-3 rounded-md bg-surface p-[14px]"
          style={{ boxShadow: shadow.sm }}
        >
          <ServiceLogo name={v.service.name} service={v.service} />
          <View className="flex-1">
            <Text weight="bold">{v.service.name}</Text>
            <Text className="text-[12.5px] text-ink-3">Từ thư viện dịch vụ</Text>
          </View>
          <Button title="Đổi" size="sm" variant="soft" onPress={clearService} />
        </View>
      ) : (
        <>
          <Text weight="semibold" className="mb-[7px] ml-1 text-[13px] leading-[18px] text-ink-2">
            Chọn nhanh
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-5 mb-4"
            contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingVertical: 2 }}
          >
            {quickPick.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => pickService(s)}
                accessibilityRole="button"
                accessibilityLabel={s.name}
                className="w-[72px] items-center gap-[6px] rounded-[18px] bg-surface py-3 active:scale-[0.96]"
                style={{ boxShadow: shadow.sm }}
              >
                <ServiceLogo name={s.name} service={s} size="sm" />
                <Text
                  weight="semibold"
                  className="text-[11.5px] leading-[15px] text-ink-2"
                  numberOfLines={1}
                >
                  {s.name.split(' ')[0]}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              className="w-[72px] items-center justify-center gap-[6px] rounded-[18px] bg-sky-soft py-3 active:scale-[0.96]"
            >
              <Icon name="search" color={colors['sky-deep']} />
              <Text weight="semibold" className="text-[11.5px] leading-[15px] text-sky-deep">
                Tìm thêm
              </Text>
            </Pressable>
          </ScrollView>
          <Input
            label="Tên dịch vụ"
            value={v.customName}
            onChangeText={(t) => set('customName', t)}
            placeholder="VD: Phòng gym, Netflix Premium"
            error={errors.name}
            className="mb-4"
          />
        </>
      )}

      {selectedService && selectedService.plans.length > 0 ? (
        <View className="mb-4">
          <Text weight="semibold" className="mb-[7px] ml-1 text-[13px] leading-[18px] text-ink-2">
            Gói
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {selectedService.plans.map((p) => (
              <Chip
                key={p.id}
                label={`${p.name} · ${formatAmount(p.amountMinor, p.currency)}${perInterval(p.intervalUnit, p.intervalCount)}`}
                selected={v.servicePlanId === p.id}
                onPress={() => pickPlan(p)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View className="mb-4 mt-1 border-t border-line pt-4">
        <Text weight="extrabold" className="text-[18px] leading-[24px]">
          Giá và lịch thanh toán
        </Text>
        <Text className="mt-1 text-[12.5px] leading-[18px] text-ink-3">
          Đây là thông tin Subca dùng để tính chi phí và nhắc đúng ngày.
        </Text>
      </View>

      {/* ── Giá ── */}
      <View className="mb-4">
        <Input
          label="Giá"
          value={v.amount}
          onChangeText={(t) => {
            set('amount', t);
            // Tự sửa giá thì không còn khớp gói trong thư viện nữa.
            if (v.servicePlanId) set('servicePlanId', null);
          }}
          placeholder="0"
          keyboardType={CURRENCY_DECIMALS[v.currency] === 0 ? 'number-pad' : 'decimal-pad'}
          error={errors.amount}
        />
      </View>
      <View className="mb-4">
        <Text weight="semibold" className="mb-[7px] ml-1 text-[13px] leading-[18px] text-ink-2">
          Tiền tệ
        </Text>
        <Segmented options={CURRENCIES} value={v.currency} onChange={(c) => set('currency', c)} />
      </View>

      {/* ── Chu kỳ & ngày ── */}
      <View className="mb-4">
        <Text weight="semibold" className="mb-[7px] ml-1 text-[13px] leading-[18px] text-ink-2">
          Chu kỳ thanh toán
        </Text>
        <Segmented
          options={INTERVALS.map((i) => ({ value: i.value, label: i.label }))}
          value={intervalKey}
          onChange={(key) => {
            const i = INTERVALS.find((x) => x.value === key)!;
            setV((old) => ({ ...old, intervalUnit: i.unit, intervalCount: i.count }));
          }}
        />
        {intervalKey === null ? (
          <Text className="ml-1 mt-2 text-[12.5px] text-ink-3">
            Đang dùng chu kỳ riêng {perInterval(v.intervalUnit, v.intervalCount)}
          </Text>
        ) : null}
      </View>

      <View className="mb-4">
        <DateField
          label={v.isTrial ? 'Ngày hết dùng thử (bắt đầu tính phí)' : 'Ngày gia hạn tiếp theo'}
          value={v.billingDate}
          onChange={(d) => set('billingDate', d)}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: optionsOpen }}
        onPress={() => setOptionsOpen((open) => !open)}
        className="mt-2 min-h-[70px] flex-row items-center gap-3 border-y border-line py-3"
      >
        <View className="h-10 w-10 items-center justify-center rounded-[13px] bg-brass-soft">
          <Icon name="settings" size={19} color={colors['ink-brand']} />
        </View>
        <View className="flex-1">
          <Text weight="bold" className="text-[14px]">
            Nhắc nhở và tuỳ chọn
          </Text>
          <Text className="text-[12px] text-ink-3">
            {optionsOpen ? 'Thiết lập cách theo dõi gói này' : 'Thanh toán, lời nhắc và ghi chú'}
          </Text>
        </View>
        <Icon name="chev" size={17} color={colors['ink-3']} />
      </Pressable>

      {optionsOpen ? (
        <View className="pt-4">
          {/* ── Thanh toán ── */}
          <View className="mb-4">
            <Text weight="semibold" className="mb-[7px] ml-1 text-[13px] leading-[18px] text-ink-2">
              Thanh toán bằng
            </Text>
            {/* Tạo thẻ / ví ngay tại đây, không phải rời form (màn quản lý đầy đủ nằm trong Cài đặt). */}
            <View className="flex-row flex-wrap gap-2">
              <Chip
                label="Chưa chọn"
                selected={paymentMethodId === null}
                onPress={() => pickPaymentMethod(null)}
              />
              {(paymentMethods.data ?? []).map((pm) => (
                <Chip
                  key={pm.id}
                  label={paymentMethodLabel(pm)}
                  selected={paymentMethodId === pm.id}
                  onPress={() => pickPaymentMethod(pm.id)}
                />
              ))}
              <Chip
                label="Thêm"
                left={<Icon name="plus" size={15} color={colors['ink-2']} strokeWidth={2.2} />}
                onPress={() => setPmSheetKey(Date.now())}
              />
            </View>
          </View>

          {/* ── Nhắc nhở ── */}
          <View className="mb-4">
            <Text weight="semibold" className="mb-[7px] ml-1 text-[13px] leading-[18px] text-ink-2">
              Nhắc tôi trước
            </Text>
            <Segmented
              options={REMINDERS}
              value={v.reminder}
              onChange={(d) => set('reminder', d)}
            />
            {v.reminder === null ? (
              <Text className="ml-1 mt-2 text-[12.5px] text-ink-3">Đang theo cài đặt chung</Text>
            ) : null}
          </View>

          <View className="gap-[10px]">
            <ToggleRow
              title="Tự động gia hạn"
              note="Dịch vụ tự trừ tiền mỗi kỳ"
              value={v.autoRenew}
              onChange={(x) => set('autoRenew', x)}
            />
            <ToggleRow
              title="Đây là gói dùng thử"
              note="Theo dõi ngày hết trial, nhắc trước khi bị tính phí"
              value={v.isTrial}
              onChange={(x) => set('isTrial', x)}
            />
          </View>

          <Input
            label="Ghi chú"
            value={v.notes}
            onChangeText={(t) => set('notes', t)}
            placeholder="VD: dùng chung với gia đình, chia 4 người"
            multiline
            className="mt-4"
            style={{ height: 88, paddingTop: 14, textAlignVertical: 'top' }}
          />
        </View>
      ) : null}

      {errors.form ? (
        <Text className="mt-3 text-center text-[13px] text-coral-deep">{errors.form}</Text>
      ) : null}

      <Button
        title={mode === 'create' ? 'Lưu subscription' : 'Lưu thay đổi'}
        icon="check"
        className="mt-6"
        loading={submitting}
        onPress={submit}
      />

      {pmSheetKey !== null ? (
        <PaymentMethodSheet
          key={pmSheetKey}
          visible
          method={null}
          onClose={() => setPmSheetKey(null)}
          onSaved={(saved) => pickPaymentMethod(saved.id)}
        />
      ) : null}

      <ServicePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        services={catalog.data ?? []}
        onPick={(s) => {
          pickService(s);
          setPickerOpen(false);
        }}
      />
    </>
  );
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();
}

/** Bottom sheet tìm dịch vụ trong thư viện. */
function ServicePicker({
  visible,
  onClose,
  services,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  services: CatalogServiceDto[];
  onPick: (s: CatalogServiceDto) => void;
}) {
  const [q, setQ] = useState('');
  const needle = normalize(q.trim());
  const found = needle ? services.filter((s) => normalize(s.name).includes(needle)) : services;
  return (
    <Sheet visible={visible} onClose={onClose} title="Thư viện dịch vụ">
      <SearchInput value={q} onChangeText={setQ} placeholder="Tìm dịch vụ…" autoFocus />
      <View className="mt-3 gap-2">
        {found.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => onPick(s)}
            accessibilityRole="button"
            className="flex-row items-center gap-3 rounded-[16px] bg-surface p-3 active:opacity-80"
          >
            <ServiceLogo name={s.name} service={s} size="sm" />
            <Text weight="semibold" className="flex-1">
              {s.name}
            </Text>
            <Icon name="chev" size={18} color={colors['ink-3']} />
          </Pressable>
        ))}
        {found.length === 0 ? (
          <Text className="py-6 text-center text-ink-3">
            Không thấy dịch vụ này — đóng lại và nhập tên ở ô “Tên dịch vụ”.
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}
