<?php

namespace App\Policies;

use App\Models\Asset;
use App\Models\User;

final class AssetPolicy
{
    public function delete(User $user, Asset $asset): bool
    {
        return $asset->user_id === $user->id;
    }

    public function touch(User $user, Asset $asset): bool
    {
        return $asset->user_id === $user->id;
    }
}
