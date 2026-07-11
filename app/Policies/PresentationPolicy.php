<?php

namespace App\Policies;

use App\Enums\Sharing\PresentationRole;
use App\Models\Presentation;
use App\Models\User;

final class PresentationPolicy
{
    public function view(User $user, Presentation $presentation): bool
    {
        return PresentationRole::forUserOn($user, $presentation) !== null;
    }

    public function edit(User $user, Presentation $presentation): bool
    {
        return PresentationRole::forUserOn($user, $presentation)?->canWrite() ?? false;
    }

    public function share(User $user, Presentation $presentation): bool
    {
        return PresentationRole::forUserOn($user, $presentation)?->canShare() ?? false;
    }

    public function delete(User $user, Presentation $presentation): bool
    {
        return PresentationRole::forUserOn($user, $presentation)?->canDelete() ?? false;
    }
}
