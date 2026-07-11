<?php

namespace App\Policies;

use App\Models\Presentation;
use App\Models\User;

class PresentationPolicy
{
    public function view(User $user, Presentation $presentation): bool
    {
        return $user->id === $presentation->user_id;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Presentation $presentation): bool
    {
        return $user->id === $presentation->user_id;
    }

    public function delete(User $user, Presentation $presentation): bool
    {
        return $user->id === $presentation->user_id;
    }
}
