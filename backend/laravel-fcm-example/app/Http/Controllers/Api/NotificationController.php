<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendPushNotificationJob;
use App\Models\FcmToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function send(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:500'],
            'data' => ['nullable', 'array'],
            'user_ids' => ['nullable', 'array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'tokens' => ['nullable', 'array'],
            'tokens.*' => ['string'],
        ]);

        $tokens = collect($validated['tokens'] ?? [])
            ->merge(
                FcmToken::query()
                    ->when(
                        !empty($validated['user_ids']),
                        fn ($q) => $q->whereIn('user_id', $validated['user_ids'])
                    )
                    ->pluck('token')
            )
            ->filter()
            ->unique()
            ->values()
            ->all();

        SendPushNotificationJob::dispatch(
            $tokens,
            $validated['title'],
            $validated['body'],
            $validated['data'] ?? []
        );

        return response()->json([
            'success' => true,
            'message' => 'Notification job queued.',
            'queued_tokens' => count($tokens),
        ]);
    }
}
