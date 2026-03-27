export const SHIPMENT_STEP_KEYS = [
  "placed",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
] as const;

export type ShipmentStepKey = (typeof SHIPMENT_STEP_KEYS)[number];

export const SHIPMENT_STEP_ICONS: Record<ShipmentStepKey, string> = {
  placed: "i-heroicons-shopping-bag",
  packed: "i-heroicons-cube",
  shipped: "i-heroicons-truck",
  out_for_delivery: "i-heroicons-map-pin",
  delivered: "i-heroicons-check-badge",
};

export type OrderLike = {
  status?: string | null;
  date_created?: string | null;
  shipping_status?: string | null;
};

function norm(s: string | null | undefined): string {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/-/g, "_");
}

/**
 * Active step index 0–4. -1 = cancelled / no timeline.
 */
export function getShipmentActiveStepIndex(order: OrderLike): number {
  const st = norm(order.status);
  if (st === "cancelled" || st === "canceled") return -1;

  const ship = norm(order.shipping_status);
  if (ship === "delivered") return 4;
  if (ship === "out_for_delivery" || ship === "in_transit") return 3;
  if (ship === "shipped") return 2;
  if (ship === "preparing" || ship === "packed") return 1;
  if (ship === "pending") return 0;

  if (st === "completed") return 4;
  if (st === "processing") return 3;
  if (st === "paid") return 1;
  if (st === "pending") return 0;

  return 0;
}

function offsetIso(baseIso: string | undefined, hours: number): string | null {
  if (!baseIso) return null;
  const d = new Date(baseIso);
  if (Number.isNaN(d.getTime())) return null;
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return d.toISOString();
}

export type TimelineStepVm = {
  key: ShipmentStepKey;
  icon: string;
  timestampIso: string | null;
  variant: "done" | "active" | "pending";
};

export function buildShipmentTimelineSteps(order: OrderLike): TimelineStepVm[] {
  const active = getShipmentActiveStepIndex(order);
  const base = order.date_created || undefined;

  return SHIPMENT_STEP_KEYS.map((key, i) => {
    let variant: TimelineStepVm["variant"];
    if (active < 0) {
      variant = "pending";
    } else if (i < active) {
      variant = "done";
    } else if (i === active) {
      variant = "active";
    } else {
      variant = "pending";
    }

    let timestampIso: string | null = null;
    if (variant === "done" || variant === "active") {
      if (i === 0) {
        timestampIso = base ? new Date(base).toISOString() : null;
      } else {
        timestampIso = offsetIso(base, 2 * i);
      }
    }

    return {
      key,
      icon: SHIPMENT_STEP_ICONS[key],
      timestampIso,
      variant,
    };
  });
}

/** Fingerprint for detecting status changes (frontend notifications). */
export function orderShipmentFingerprint(order: OrderLike | null | undefined): string {
  if (!order) return "";
  return `${norm(order.status)}|${norm(order.shipping_status)}`;
}
