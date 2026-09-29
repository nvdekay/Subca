import { IconButton } from './icon-button';

/** Một kiểu nút quay lại duy nhất cho navigation và các bước onboarding. */
export function BackButton({ onPress }: { onPress: () => void }) {
  return <IconButton icon="back" label="Quay lại" onPress={onPress} />;
}
