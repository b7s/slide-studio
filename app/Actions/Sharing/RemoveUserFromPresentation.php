<?php

namespace App\Actions\Sharing;

use App\Models\Presentation;
use App\Models\User;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;

final class RemoveUserFromPresentation
{
    public function __invoke(Presentation $presentation, User $targetUser): void
    {
        DB::transaction(function () use ($presentation, $targetUser): void {
            $presentation->sharedUsers()->detach($targetUser->id);

            Audit::record('presentation.unshared', $presentation, [
                'target_user_id' => $targetUser->id,
            ]);
        });
    }
}
