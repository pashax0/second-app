export const queryKeys = {
  drops: {
    active: () => ['drops', 'active'] as const,
  },
  reservations: {
    active: () => ['reservations', 'active'] as const,
    mine: () => ['reservations', 'mine'] as const,
  },
  profile: {
    me: () => ['profile', 'me'] as const,
  },
  orders: {
    my: () => ['orders', 'my'] as const,
  },
};
