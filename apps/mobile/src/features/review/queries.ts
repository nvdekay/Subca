import type { ReviewDecision, ReviewDto } from '@subca/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const reviewKey = ['reviews'] as const;

/** Đánh giá tháng hiện tại (server tự lấy tháng theo múi giờ người dùng). */
export function useReview() {
  return useQuery({ queryKey: reviewKey, queryFn: () => api<ReviewDto>('/reviews') });
}

/** Tính lại số đã đánh giá và số có thể tiết kiệm sau khi đổi quyết định trên máy. */
function recompute(review: ReviewDto): ReviewDto {
  const reviewedCount = review.items.filter((i) => i.decision !== null).length;
  const savings = review.items
    .filter((i) => i.decision === 'CANCEL')
    .reduce((sum, i) => sum + BigInt(i.monthlyMinor), 0n);
  return { ...review, reviewedCount, potentialSavingsMinor: savings.toString() };
}

/**
 * Chọn Giữ / Xem lại / Hủy; bấm lại lựa chọn đang chọn thì bỏ chọn (decision = null).
 * Cập nhật giao diện ngay rồi mới gọi API; lỗi thì trả lại như cũ.
 */
export function useSetDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: ReviewDecision | null }) =>
      decision
        ? api(`/reviews/${id}`, { method: 'PUT', body: JSON.stringify({ decision }) })
        : api(`/reviews/${id}`, { method: 'DELETE' }),
    onMutate: async ({ id, decision }) => {
      await queryClient.cancelQueries({ queryKey: reviewKey });
      const previous = queryClient.getQueryData<ReviewDto>(reviewKey);
      if (previous) {
        queryClient.setQueryData<ReviewDto>(
          reviewKey,
          recompute({
            ...previous,
            items: previous.items.map((i) => (i.subscriptionId === id ? { ...i, decision } : i)),
          }),
        );
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(reviewKey, context.previous);
    },
    onSettled: () => {
      // "Xem lại" đổi trạng thái gói sang REVIEW → Trang chủ / danh sách / chi tiết cũng đổi.
      queryClient.invalidateQueries({ queryKey: reviewKey });
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}
