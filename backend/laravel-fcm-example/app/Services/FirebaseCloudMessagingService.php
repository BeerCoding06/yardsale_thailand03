<?php

namespace App\Services;

use Google\Auth\Credentials\ServiceAccountCredentials;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class FirebaseCloudMessagingService
{
    public function sendToTokens(array $tokens, string $title, string $body, array $data = []): array
    {
        $projectId = (string) config('services.firebase.project_id');
        if ($projectId === '') {
            throw new RuntimeException('Missing FIREBASE_PROJECT_ID configuration.');
        }

        $accessToken = $this->getAccessToken();
        $endpoint = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";

        $results = [];
        foreach ($tokens as $token) {
            $response = Http::withToken($accessToken)->post($endpoint, [
                'message' => [
                    'token' => $token,
                    'notification' => [
                        'title' => $title,
                        'body' => $body,
                    ],
                    'data' => $this->stringifyData($data),
                ],
            ]);

            $results[] = [
                'token' => $token,
                'ok' => $response->successful(),
                'response' => $response->json() ?: $response->body(),
            ];
        }

        return $results;
    }

    protected function getAccessToken(): string
    {
        $credentialsPath = (string) config('services.firebase.credentials');
        if ($credentialsPath === '' || !is_file($credentialsPath)) {
            throw new RuntimeException('Invalid FIREBASE_CREDENTIALS path.');
        }

        $scopes = ['https://www.googleapis.com/auth/firebase.messaging'];
        $credentials = new ServiceAccountCredentials($scopes, $credentialsPath);
        $token = $credentials->fetchAuthToken();
        $accessToken = $token['access_token'] ?? null;

        if (!$accessToken) {
            throw new RuntimeException('Unable to retrieve Firebase access token.');
        }

        return $accessToken;
    }

    protected function stringifyData(array $data): array
    {
        $result = [];
        foreach ($data as $key => $value) {
            $result[(string) $key] = is_scalar($value) ? (string) $value : json_encode($value);
        }

        return $result;
    }
}
