<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FcmToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FcmTokenController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:255'],
            'device' => ['nullable', 'string', 'max:50'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $userId = $request->user()?->id ?? ($validated['user_id'] ?? null);

        $record = FcmToken::updateOrCreate(
            ['token' => $validated['token']],
            [
                'user_id' => $userId,
                'device' => $validated['device'] ?? 'web',
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'FCM token saved.',
            'data' => $record,
        ]);
    }
}
