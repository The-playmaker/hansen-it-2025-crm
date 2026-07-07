export const roleRank = {
  viewer: 10,
  employee: 20,
  admin: 30,
  owner: 40
};

export function hasMinimumRole(role, minRole = "viewer") {
  return (roleRank[role] || 0) >= (roleRank[minRole] || 0);
}

export function safeAdminUser(user, profile) {
  if (!user || !profile) return null;
  return {
    id: user.id,
    email: user.email || profile.email,
    name: profile.name || user.user_metadata?.name || user.email,
    role: profile.role,
    is_active: profile.is_active !== false
  };
}
