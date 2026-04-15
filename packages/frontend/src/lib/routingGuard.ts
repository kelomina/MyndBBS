export function getAccessRedirectPath(requiredRoleLevel: number, userRoleLevel: number): string | null {
  if (requiredRoleLevel > 0 && userRoleLevel < requiredRoleLevel) return '/403';
  return null;
}

