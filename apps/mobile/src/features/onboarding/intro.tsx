import { router, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme';
import { IntroArt } from './intro-art';

const stories = [
  {
    label: '',
    title: 'Gom gói,\nnhẹ đầu hơn.',
    detail: 'Tự tìm từ email hoặc thêm gói theo cách của bạn.',
  },
  {
    label: 'CHỦ ĐỘNG HƠN',
    title: 'Đến hẹn,\nđã có lời nhắc.',
    detail:
      'Theo dõi ngày gia hạn và hạn dùng thử. Có thêm thời gian để quyết định giữ lại hay dừng một gói.',
  },
  {
    label: 'NHẸ ĐẦU HƠN',
    title: 'Hiểu khoản chi.\nThảnh thơi tận hưởng.',
    detail:
      'Xem chi tiêu, đặt ngân sách và chia tiền gói chung. Những khoản nhỏ cũng trở nên rõ ràng.',
  },
];

export default function Intro() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const focused = useIsFocused();
  const initialReducedMotion = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);
  const [screenReader, setScreenReader] = useState(true);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [step, setStep] = useState(0);
  const [greetingPlayed, setGreetingPlayed] = useState(false);
  const story = stories[step - 1];

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (mounted) setScreenReader(value);
      })
      .catch(() => {});
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReducedMotion(value);
      })
      .catch(() => {});
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const app = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => {
      mounted = false;
      reader.remove();
      motion.remove();
      app.remove();
    };
  }, []);

  useEffect(() => {
    if (step !== 0 || greetingPlayed || reducedMotion || screenReader || !focused || !active)
      return;
    const timer = setTimeout(() => {
      setGreetingPlayed(true);
      setStep(1);
    }, 3000);
    return () => clearTimeout(timer);
  }, [step, greetingPlayed, reducedMotion, screenReader, focused, active]);

  const next = () => {
    setGreetingPlayed(true);
    if (step === stories.length) router.navigate('/sign-in');
    else setStep((value) => Math.min(value + 1, stories.length));
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <View className="mx-6 min-h-[60px] flex-row items-center justify-between">
        {step === 0 ? (
          <View className="h-11 w-11" />
        ) : (
          <BackButton
            onPress={() => {
              setGreetingPlayed(true);
              setStep((value) => Math.max(0, value - 1));
            }}
          />
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate('/sign-in')}
          className="min-h-12 justify-center px-3 active:opacity-60"
        >
          <Text weight="semibold" className="text-[14px] text-ink-2">
            Bỏ qua
          </Text>
        </Pressable>
      </View>
      <View className="flex-1 overflow-hidden">
        <Animated.View
          key={step}
          entering={reducedMotion ? undefined : FadeIn.duration(450)}
          exiting={reducedMotion ? undefined : FadeOut.duration(180)}
          style={{ flex: 1 }}
        >
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: step === 1 ? 'flex-start' : 'center',
              paddingHorizontal: 28,
              paddingVertical: 24,
            }}
          >
            {step === 0 ? (
              <View className="items-center py-10">
                <Animated.View
                  entering={reducedMotion ? undefined : FadeInDown.delay(180).duration(850)}
                >
                  <Text
                    accessibilityRole="header"
                    weight="extrabold"
                    style={{
                      fontSize: Math.min(76, (width - 56) / 4.5),
                      lineHeight: Math.min(96, (width - 56) / 4.5 + 20),
                      letterSpacing: -2.5,
                      textAlign: 'center',
                      color: colors['ink-brand'],
                    }}
                  >
                    Xin chào.
                  </Text>
                </Animated.View>
                <Animated.View
                  entering={reducedMotion ? undefined : FadeInDown.delay(650).duration(700)}
                  className="mt-5 items-center"
                >
                  <Text weight="bold" className="text-center text-[21px] leading-[30px]">
                    Một chút gọn gàng,
                  </Text>
                  <Text className="text-center text-[21px] leading-[30px] text-ink-2">
                    nhiều chút thảnh thơi.
                  </Text>
                  <View className="mb-5 mt-8 h-px w-12 bg-brass" />
                  <Text className="text-center text-[13px] text-ink-3">
                    Rất vui được gặp bạn. Mình là Subca.
                  </Text>
                </Animated.View>
              </View>
            ) : (
              <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
                <IntroArt scene={step} reducedMotion={reducedMotion} />
                <Animated.View
                  entering={reducedMotion ? undefined : FadeInDown.delay(180).duration(600)}
                  className="mt-8"
                >
                  {story.label ? (
                    <Text
                      weight="bold"
                      className="mb-3 text-[11px] text-ink-brand"
                      style={{ letterSpacing: 2 }}
                    >
                      {story.label}
                    </Text>
                  ) : null}
                  <Text
                    accessibilityRole="header"
                    accessibilityLiveRegion="polite"
                    weight="extrabold"
                    className="text-[32px] leading-[39px]"
                    style={{ letterSpacing: -0.8 }}
                  >
                    {story.title}
                  </Text>
                  <Text className="mt-4 text-[15px] leading-[24px] text-ink-2">{story.detail}</Text>
                </Animated.View>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
      <View
        className="px-7 pb-3 pt-3"
        style={{ width: '100%', maxWidth: 496, alignSelf: 'center' }}
      >
        <View
          accessible
          accessibilityLabel={step === 0 ? 'Lời chào' : `Giới thiệu ${step} trên ${stories.length}`}
          className="mb-5 flex-row items-center justify-center gap-2"
        >
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={{
                height: 5,
                width: index === step ? 28 : 7,
                borderRadius: 4,
                backgroundColor: index === step ? colors.accent : colors.line,
              }}
            />
          ))}
        </View>
        <Button
          title={
            step === 0
              ? 'Khám phá Subca'
              : step === stories.length
                ? 'Bắt đầu với Subca'
                : 'Tiếp tục'
          }
          onPress={next}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate('/sign-in')}
          className="min-h-12 items-center justify-center active:opacity-60"
        >
          <Text className="text-center text-[13px] text-ink-2">
            Đã có tài khoản?{' '}
            <Text weight="bold" className="text-[13px] text-ink-brand">
              Đăng nhập
            </Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
