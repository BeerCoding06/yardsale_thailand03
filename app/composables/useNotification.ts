import { push } from "notivue";

export type NotifyType = "success" | "error" | "warning" | "info";

/**
 * Frontend-only notifications (Notivue).
 * @example notify('Your order has been shipped 🚚', 'success')
 */
export function useNotification() {
  function notify(message: string, type: NotifyType = "info") {
    switch (type) {
      case "success":
        push.success(message);
        break;
      case "error":
        push.error(message);
        break;
      case "warning":
        push.warning(message);
        break;
      default:
        push.info(message);
    }
  }

  return { notify };
}
