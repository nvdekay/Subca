import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '@/components/brand-mark';
import { ServiceLogo } from '@/components/service-logo';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, shadow } from '@/theme';

/** Hai bước đầu V2 trước đăng nhập; bước kết nối Gmail tiếp tục sau khi có phiên người dùng. */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'welcome' | 'value'>('welcome');

  if (step === 'value') {
    return (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 28,
        }}
        style={{ backgroundColor: colors.bg }}
        bounces={false}
      >
        <View className="flex-1 px-6">
          <View className="h-11 flex-row items-center justify-between">
            <Pressable
              onPress={() => setStep('welcome')}
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
              className="h-11 w-11 items-center justify-center rounded-xl bg-surface"
            >
              <Icon name="back" size={20} color={colors['ink-2']} />
            </Pressable>
            <View className="flex-row items-center gap-[6px]">
              <View className="h-1 w-[18px] rounded bg-ink-brand" />
              <View className="h-1 w-[6px] rounded bg-line" />
              <View className="h-1 w-[6px] rounded bg-line" />
            </View>
            <View className="h-11 w-11" />
          </View>
          <Text weight="extrabold" className="mb-2 mt-7 text-[27px] leading-[35px]">
            Subca làm phần việc nhàm chán cho bạn
          </Text>
          <Text className="mb-6 text-[14px] leading-[21px] text-ink-3">
            Bạn chỉ cần quyết định khi thật sự cần.
          </Text>
          <View className="flex-1 gap-3">
            <ValueCard
              icon="sparkle"
              title="Tự động phát hiện"
              detail="Tìm subscription từ email thanh toán và hóa đơn."
              tone="mint"
            />
            <ValueCard
              icon="bell"
              title="Không bỏ lỡ gia hạn"
              detail="Nhắc trước trial, renewal và các khoản sắp bị trừ."
              tone="peach"
            />
            <ValueCard
              icon="piggy"
              title="Giảm chi phí không cần thiết"
              detail="Phát hiện subscription ít sử dụng hoặc có thể xem lại."
              tone="sky"
            />
          </View>
          <Button title="Tiếp tục" className="mt-6" onPress={() => router.push('/sign-in')} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 32 }}
      style={{ backgroundColor: colors.bg }}
      bounces={false}
    >
      <View className="h-[286px] overflow-hidden" style={{ marginTop: insets.top + 4 }} aria-hidden>
        <FloatCard left={34} right={0} top={0} delay={0}>
          <ServiceLogo
            name="Netflix"
            service={{ logoKey: 'netflix', brandColor: '#E50914' }}
            size="sm"
          />
          <CardText title="Netflix" note="Gia hạn sau 3 ngày" />
        </FloatCard>
        <FloatCard left={16} right={18} top={68} delay={2000}>
          <ServiceLogo
            name="Spotify"
            service={{ logoKey: 'spotify', brandColor: '#1ED760' }}
            size="sm"
          />
          <CardText title="Spotify Family" note="Chia 4 · 22.250đ / người" />
        </FloatCard>
        <FloatCard left={0} right={36} top={136} delay={4000}>
          <View className="h-[30px] w-[30px] items-center justify-center rounded-[10px] bg-peach">
            <Icon name="hourglass" size={15} color="#8A4B1E" />
          </View>
          <CardText title="Trial Notion AI" note="Còn 2 ngày — hủy kịp nhé" />
        </FloatCard>
        <FloatCard left={68} right={0} top={204} delay={1000}>
          <View className="h-[30px] w-[30px] items-center justify-center rounded-[10px] bg-ink-brand">
            <Icon name="piggy" size={15} color="#FFFFFF" />
          </View>
          <CardText title="Tiết kiệm" note="374.000đ / tháng" />
        </FloatCard>
      </View>

      <View className="px-7">
        <BrandMark />
        <Text
          weight="extrabold"
          className="mb-2 mt-[14px] text-[34px] leading-[42px]"
          style={{ letterSpacing: -1 }}
        >
          Quản lý subscription gần như tự động.
        </Text>
        <Text className="text-[14px] leading-[21px] text-ink-2">
          Kết nối email để Subca tự tìm, theo dõi và cập nhật các khoản đăng ký của bạn.
        </Text>
        <Button title="Bắt đầu" className="mt-6" onPress={() => router.push('/sign-in')} />
        <Button
          title="Tìm hiểu cách hoạt động"
          variant="ghost"
          className="mt-2"
          onPress={() => setStep('value')}
        />
      </View>
    </ScrollView>
  );
}

/** Thẻ nổi lên xuống nhẹ (animation "bob" 6 giây trong mockup), chạy trên UI thread. */
function FloatCard({
  children,
  delay,
  ...pos
}: {
  children: ReactNode;
  delay: number;
  left?: number;
  right?: number;
  top: number;
}) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(
      delay % 3000,
      withRepeat(withTiming(-8, { duration: 3000, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [delay, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View
      className="flex-row items-center gap-[10px] rounded-[22px] bg-surface px-[14px] py-3"
      style={[{ position: 'absolute', boxShadow: shadow.md, ...pos }, style]}
    >
      {children}
    </Animated.View>
  );
}

function CardText({ title, note }: { title: string; note: string }) {
  return (
    <View>
      <Text weight="semibold" className="text-[13px] leading-[18px]">
        {title}
      </Text>
      <Text weight="medium" className="text-[11.5px] leading-[16px] text-ink-3">
        {note}
      </Text>
    </View>
  );
}

function ValueCard({
  icon,
  title,
  detail,
  tone,
}: {
  icon: 'sparkle' | 'bell' | 'piggy';
  title: string;
  detail: string;
  tone: 'mint' | 'peach' | 'sky';
}) {
  const toneClass = { mint: 'bg-mint', peach: 'bg-peach', sky: 'bg-sky-soft' }[tone];
  return (
    <View className="flex-row gap-3 rounded-[22px] bg-surface p-4" style={{ boxShadow: shadow.md }}>
      <View className={`h-11 w-11 flex-none items-center justify-center rounded-xl ${toneClass}`}>
        <Icon name={icon} size={21} color={colors['ink-2']} />
      </View>
      <View className="flex-1">
        <Text weight="semibold" className="mb-1 text-[15px]">
          {title}
        </Text>
        <Text className="text-[13px] leading-[19px] text-ink-3">{detail}</Text>
      </View>
    </View>
  );
}
