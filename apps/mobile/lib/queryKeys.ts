export const queryKeys = {
  drops: {
    active: () => ['drops', 'active'] as const,
    list: () => ['drops', 'list'] as const,
    byId: (id: string) => ['drops', 'id', id] as const,
    archived: () => ['drops', 'archived'] as const,
  },
  profile: {
    me: () => ['profile', 'me'] as const,
  },
  orders: {
    my: () => ['orders', 'my'] as const,
  },
};
