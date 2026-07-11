<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Request;

final class Audit
{
    /**
     * @param  array<string, mixed>  $context
     */
    public static function record(string $event, Model $subject, array $context = [], ?User $actor = null): AuditLog
    {
        return AuditLog::query()
            ->create([
                'event' => $event,
                'subject_type' => $subject->getMorphClass(),
                'subject_id' => $subject->getKey(),
                'actor_type' => $actor?->getMorphClass(),
                'actor_id' => $actor?->getKey(),
                'context' => $context,
                'request_id' => Request::header('X-Request-ID'),
            ]);
    }
}
