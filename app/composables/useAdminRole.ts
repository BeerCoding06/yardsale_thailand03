export function useAdminRole() {
  const { user } = useAuth();

  function userIsAdmin(u: any): boolean {
    if (!u) return false;
    if (u.role === "admin") return true;
    const r = u.roles;
    if (Array.isArray(r)) {
      return r.some(
        (x: any) =>
          x === "admin" ||
          (typeof x === "object" && x && String(x.name || "").toLowerCase() === "admin")
      );
    }
    if (typeof r === "string") return r === "admin";
    return false;
  }

  const isAdmin = computed(() => userIsAdmin(user.value));

  return { isAdmin, userIsAdmin };
}
