import { formatMoney, FREE_LIMITS } from '@subca/shared';
import { StyleSheet, Text, View } from 'react-native';

/** Màn tạm để kiểm tra app chạy được và dùng được package @subca/shared. */
export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Subca</Text>
      <Text style={styles.tagline}>Mọi subscription, gọn trong một nơi.</Text>
      <Text style={styles.meta}>
        Ví dụ: {formatMoney(260000n, 'VND')} · Gói Free tối đa {FREE_LIMITS.maxSubscriptions}{' '}
        subscription
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  brand: { fontSize: 36, fontWeight: '800', color: '#2F3A31', letterSpacing: -1 },
  tagline: { fontSize: 16, color: '#4F5B51' },
  meta: { fontSize: 13, color: '#657166', marginTop: 16, textAlign: 'center' },
});
