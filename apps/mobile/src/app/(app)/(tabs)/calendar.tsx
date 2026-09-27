import { ComingSoon } from '@/components/coming-soon';

export default function Calendar() {
  return (
    <ComingSoon
      tabBar
      title="Lịch gia hạn"
      icon="cal"
      note="Lịch các ngày bị trừ tiền trong tháng sẽ có ở đây."
    />
  );
}
