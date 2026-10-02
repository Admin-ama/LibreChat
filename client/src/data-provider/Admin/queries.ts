import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MutationKeys, QueryKeys, dataService } from 'librechat-data-provider';
import type {
  TAdminUsersResponse,
  TAdminUserBalance,
  TAdminUserSearchResponse,
  TAdminUserBalanceUpdate,
} from 'librechat-data-provider';

export function useAdminUsersQuery(params: { limit?: number; offset?: number } = {}) {
  return useQuery<TAdminUsersResponse>(
    [QueryKeys.adminUsers, params.limit ?? 50, params.offset ?? 0],
    () => dataService.listAdminUsers(params),
    { refetchOnWindowFocus: false },
  );
}

export function useAdminUserSearchQuery(query: string, limit = 20) {
  const normalized = query.trim();
  return useQuery<TAdminUserSearchResponse>(
    [QueryKeys.adminUsers, 'search', normalized, limit],
    () => dataService.searchAdminUsers(normalized, limit),
    { enabled: normalized.length >= 2, refetchOnWindowFocus: false },
  );
}

export function useAdminUserBalanceQuery(userId: string | null) {
  return useQuery<TAdminUserBalance>(
    [QueryKeys.adminUserBalance, userId],
    () => dataService.getAdminUserBalance(userId as string),
    { enabled: userId != null, refetchOnWindowFocus: false },
  );
}

export function useUpdateAdminUserBalanceMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    TAdminUserBalance,
    Error,
    { userId: string; balance: TAdminUserBalanceUpdate }
  >(
    [MutationKeys.updateAdminUserBalance],
    ({ userId, balance }) => dataService.updateAdminUserBalance(userId, balance),
    {
      onSuccess: (balance) => {
        queryClient.setQueryData([QueryKeys.adminUserBalance, balance.userId], balance);
        queryClient.invalidateQueries([QueryKeys.balance]);
      },
    },
  );
}
