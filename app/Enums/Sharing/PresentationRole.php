<?php

namespace App\Enums\Sharing;

use App\Models\Presentation;
use App\Models\PresentationUser;
use App\Models\User;

enum PresentationRole: string
{
    case Owner = 'owner';
    case Editor = 'editor';
    case Viewer = 'viewer';

    public static function default(): self
    {
        return self::Viewer;
    }

    public function canWrite(): bool
    {
        return $this === self::Owner || $this === self::Editor;
    }

    public function canShare(): bool
    {
        return $this === self::Owner;
    }

    public function canDelete(): bool
    {
        return $this === self::Owner;
    }

    public static function forUserOn(User $user, Presentation $presentation): ?PresentationRole
    {
        if ($presentation->user_id === $user->id) {
            return self::Owner;
        }

        $pivot = PresentationUser::query()
            ->where('presentation_id', $presentation->id)
            ->where('user_id', $user->id)
            ->first();

        return $pivot?->role;
    }
}
