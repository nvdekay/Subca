import type { GroupMemberDto } from '@subca/shared';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';

/** Chữ đầu của tên để làm avatar (mockup: .mav). "Chờ tham gia" → dấu "+". */
export function initials(displayName: string, status: string): string {
  if (status === 'INVITED' && displayName === 'Chờ tham gia') return '+';
  const words = displayName.trim().split(/\s+/);
  const last = words.at(-1) ?? '';
  return (last[0] ?? '?').toUpperCase();
}

const TONE = ['bg-sky-soft', 'bg-mint', 'bg-peach', 'bg-stone', 'bg-coral', 'bg-muted-bg'];

export function MemberAvatar({
  member,
  index = 0,
  size = 'md',
}: {
  member: { displayName: string; status: string };
  index?: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const box = size === 'lg' ? 'h-11 w-11' : size === 'sm' ? 'h-7 w-7' : 'h-[34px] w-[34px]';
  const text = size === 'lg' ? 'text-[16px]' : size === 'sm' ? 'text-[11px]' : 'text-[13px]';
  const waiting = member.status === 'INVITED';
  return (
    <View
      className={cn(
        'items-center justify-center rounded-full',
        box,
        waiting ? 'border border-dashed border-sage bg-bg' : TONE[index % TONE.length],
      )}
    >
      <Text weight="bold" className={cn(text, waiting ? 'text-ink-3' : 'text-ink-2')}>
        {initials(member.displayName, member.status)}
      </Text>
    </View>
  );
}

/** Dãy avatar chồng nhau (mockup: .mstack). */
export function MemberStack({
  members,
  max = 5,
}: {
  members: Pick<GroupMemberDto, 'id' | 'displayName' | 'status'>[];
  max?: number;
}) {
  return (
    <View className="flex-row">
      {members.slice(0, max).map((m, i) => (
        <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -10 }}>
          <MemberAvatar member={m} index={i} size="sm" />
        </View>
      ))}
    </View>
  );
}
