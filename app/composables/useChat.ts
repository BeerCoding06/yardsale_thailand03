/**
 * Customer support chat — Yardsale Express API (requires NUXT_PUBLIC_CMS_API_BASE + JWT).
 */
export function useChat() {
  const { fetchYardsale } = useStorefrontCatalog();
  const { user } = useAuth();

  function withAuth(init: Record<string, unknown> = {}) {
    const tok = user.value?.token;
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> | undefined),
    };
    if (tok) headers.Authorization = `Bearer ${tok}`;
    const next = { ...init, headers };
    if (
      (init.method === "POST" || init.method === "PATCH" || init.method === "PUT") &&
      init.body != null &&
      !headers["Content-Type"] &&
      !headers["content-type"]
    ) {
      headers["Content-Type"] = "application/json";
    }
    return next;
  }

  async function startConversation(orderId?: string | null) {
    const body =
      orderId && String(orderId).trim() !== ""
        ? { order_id: String(orderId).trim() }
        : {};
    return await fetchYardsale("chat/start", withAuth({ method: "POST", body }));
  }

  async function fetchUnreadCount() {
    return await fetchYardsale("chat/unread", withAuth({ method: "GET" }));
  }

  async function fetchAdminConversations(query: { limit?: number; offset?: number } = {}) {
    return await fetchYardsale("chat/conversations", withAuth({ method: "GET", query }));
  }

  async function fetchMessages(
    conversationId: string,
    query: { limit?: number; offset?: number } = {}
  ) {
    const id = encodeURIComponent(String(conversationId).trim());
    return await fetchYardsale(`chat/${id}/messages`, withAuth({ method: "GET", query }));
  }

  async function sendMessage(conversationId: string, message: string) {
    const id = encodeURIComponent(String(conversationId).trim());
    return await fetchYardsale(
      `chat/${id}/send`,
      withAuth({
        method: "POST",
        body: { message },
      })
    );
  }

  async function resolveConversation(conversationId: string) {
    const id = encodeURIComponent(String(conversationId).trim());
    return await fetchYardsale(`chat/${id}/resolve`, withAuth({ method: "POST", body: {} }));
  }

  return {
    startConversation,
    fetchUnreadCount,
    fetchAdminConversations,
    fetchMessages,
    sendMessage,
    resolveConversation,
  };
}
