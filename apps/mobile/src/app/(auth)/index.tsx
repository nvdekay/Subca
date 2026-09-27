import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
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

/** Màn chào (Onboarding) — dựng theo màn 1 của mockup. */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 32 }}
      style={{ experimental_backgroundImage: 'linear-gradient(180deg, #E6F3F1 0%, #F8F7F3 58%)' }}
      bounces={false}
    >
      <View
        className="h-[430px] overflow-hidden"
        style={{ marginTop: insets.top - 20 }}
        aria-hidden
      >
        <Blob size={260} color="#C4E3E9" left={-60} top={70} />
        <Blob size={220} color="#FDE8D3" right={-50} top={170} />
        <Blob size={120} color="#F3C3B2" left={150} top={40} opacity={0.7} />
        <FloatCard left={28} top={96} delay={0}>
          <ServiceLogo
            name="Netflix"
            service={{ logoKey: 'netflix', brandColor: '#E50914' }}
            size="sm"
          />
          <CardText title="Netflix" note="Gia hạn sau 3 ngày" />
        </FloatCard>
        <FloatCard right={22} top={176} delay={2000}>
          <ServiceLogo
            name="Spotify"
            service={{ logoKey: 'spotify', brandColor: '#1ED760' }}
            size="sm"
          />
          <CardText title="Spotify Family" note="Chia 4 · 22.250đ / người" />
        </FloatCard>
        <FloatCard left={46} top={262} delay={4000}>
          <View className="h-[30px] w-[30px] items-center justify-center rounded-[10px] bg-peach">
            <Icon name="hourglass" size={15} color="#8A4B1E" />
          </View>
          <CardText title="Trial Notion AI" note="Còn 2 ngày — hủy kịp nhé" />
        </FloatCard>
        <FloatCard right={36} top={350} delay={1000}>
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
          className="mb-3 mt-[22px] text-[32px] leading-[37px]"
          style={{ letterSpacing: -1.1 }}
        >
          Mọi subscription,{'\n'}
          <Text
            weight="extrabold"
            className="text-[32px] leading-[37px]"
            style={{ backgroundColor: colors.sky }}
          >
            gọn trong một nơi.
          </Text>
        </Text>
        <Text className="text-[14px] leading-[21px] text-ink-2">
          Biết mình trả bao nhiêu mỗi tháng, được nhắc trước khi bị trừ tiền và cắt bớt những gói
          không còn dùng.
        </Text>
        <View className="my-[22px] flex-row gap-[6px]">
          <View className="h-2 w-6 rounded bg-ink" />
          <View className="h-2 w-2 rounded bg-sage" />
          <View className="h-2 w-2 rounded bg-sage" />
        </View>
        <Button title="Bắt đầu ngay" icon="chev" onPress={() => router.push('/sign-in')} />
        <Button
          title="Tôi đã có tài khoản"
          variant="ghost"
          className="mt-2"
          onPress={() => router.push('/sign-in')}
        />
      </View>
    </ScrollView>
  );
}

function Blob({
  size,
  color,
  opacity = 1,
  ...pos
}: {
  size: number;
  color: string;
  opacity?: number;
  left?: number;
  right?: number;
  top: number;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        ...pos,
      }}
    />
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
