<?php

namespace App\Jobs;

use App\Services\FirebaseCloudMessagingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendPushNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public array $tokens,
        public string $title,
        public string $body,
        public array $data = []
    ) {
        $this->onQueue('notifications');
    }

    public function handle(FirebaseCloudMessagingService $fcm): void
    {
        $tokens = array_values(array_unique(array_filter($this->tokens)));
        if (empty($tokens)) {
            return;
        }

        $fcm->sendToTokens($tokens, $this->title, $this->body, $this->data);
    }
}
