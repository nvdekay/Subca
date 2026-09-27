import type { ReminderRuleDto, RemindersDto } from '@subca/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useReminders() {
  return useQuery({ queryKey: ['reminders'], queryFn: () => api<RemindersDto>('/reminders') });
}

export function useReminderRules() {
  return useQuery({
    queryKey: ['reminder-rules'],
    queryFn: () => api<ReminderRuleDto[]>('/reminders/rules'),
  });
}

/** Lưu cả danh sách quy tắc; giao diện đổi ngay, lỗi thì trả lại như cũ. */
export function useSaveReminderRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rules: ReminderRuleDto[]) =>
      api<ReminderRuleDto[]>('/reminders/rules', {
        method: 'PUT',
        body: JSON.stringify({ rules }),
      }),
    onMutate: async (rules) => {
      await queryClient.cancelQueries({ queryKey: ['reminder-rules'] });
      const previous = queryClient.getQueryData<ReminderRuleDto[]>(['reminder-rules']);
      queryClient.setQueryData(['reminder-rules'], rules);
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(['reminder-rules'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder-rules'] });
      // Quy tắc đổi → danh sách nhắc sắp tới đổi.
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}
