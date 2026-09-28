import { INVITE_CODE_LENGTH } from '@subca/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { useJoinGroup } from './queries';

/** Vào nhóm bằng mã trong link mời (khi bấm link chưa mở được app, VD trên máy chưa cài). */
export function JoinGroupSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const join = useJoinGroup();
  const [code, setCode] = useState('');
  const ready = code.trim().length === INVITE_CODE_LENGTH;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Vào nhóm chia tiền"
      subtitle={`Nhập ${INVITE_CODE_LENGTH} ký tự cuối của link mời, VD subca.app/j/ABCD2345.`}
    >
      <Input
        label="Mã mời"
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={INVITE_CODE_LENGTH}
        placeholder="ABCD2345"
        error={join.isError ? join.error.message : null}
      />
      <Text className="ml-1 mt-2 text-[12.5px] leading-[18px] text-ink-3">
        Chủ nhóm thấy bạn trong danh sách ngay sau khi vào, và bạn nhận nhắc chuyển tiền mỗi tháng.
      </Text>
      <Button
        title="Vào nhóm"
        icon="chev"
        disabled={!ready}
        loading={join.isPending}
        className="mt-4"
        onPress={() =>
          join.mutate(
            { inviteCode: code.trim() },
            {
              onSuccess: (group) => {
                onClose();
                router.push({ pathname: '/groups/[id]', params: { id: group.id } });
              },
            },
          )
        }
      />
    </Sheet>
  );
}
