<?php

namespace App\Observers;

use App\Jobs\SendPushNotificationJob;
use App\Models\FcmToken;
use App\Models\Order;

class OrderObserver
{
    public function created(Order $order): void
    {
        // ตัวอย่าง: แจ้งเตือนเจ้าของสินค้าเมื่อมีออเดอร์ใหม่
        $sellerId = $order->seller_id ?? null;
        if (!$sellerId) {
            return;
        }

        $tokens = FcmToken::where('user_id', $sellerId)->pluck('token')->all();
        SendPushNotificationJob::dispatch(
            $tokens,
            'New Order Received',
            "Order #{$order->id} has been placed.",
            [
                'type' => 'new_order',
                'order_id' => (string) $order->id,
                'status' => (string) $order->status,
            ]
        );
    }

    public function updated(Order $order): void
    {
        if (!$order->wasChanged('inspection_status')) {
            return;
        }

        $buyerId = $order->user_id ?? null;
        if (!$buyerId) {
            return;
        }

        $tokens = FcmToken::where('user_id', $buyerId)->pluck('token')->all();
        SendPushNotificationJob::dispatch(
            $tokens,
            'Inspection Status Updated',
            "Order #{$order->id}: {$order->inspection_status}",
            [
                'type' => 'inspection_status',
                'order_id' => (string) $order->id,
                'inspection_status' => (string) $order->inspection_status,
            ]
        );
    }
}
