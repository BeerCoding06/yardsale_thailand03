<?php

use App\Http\Controllers\Api\FcmTokenController;
use App\Http\Controllers\Api\NotificationController;
use Illuminate\Support\Facades\Route;

Route::post('/save-token', [FcmTokenController::class, 'store']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/send-notification', [NotificationController::class, 'send']);
});
