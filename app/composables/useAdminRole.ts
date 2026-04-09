/** คงชื่อเดิม — ตรรกะอยู่ที่ useRoles */
export function useAdminRole() {
  const { isAdmin, userIsAdmin } = useRoles();
  return { isAdmin, userIsAdmin };
}
