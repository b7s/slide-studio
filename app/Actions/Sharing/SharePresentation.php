<?php

namespace App\Actions\Sharing;

use App\Enums\Sharing\PresentationRole;
use App\Exceptions\ProblemJsonException;
use App\Models\Presentation;
use App\Models\PresentationUser;
use App\Models\User;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;

final class SharePresentation
{
    /**
     * Share a presentation with a user, setting their role.
     * The authenticated user must be an owner of the presentation.
     *
     * @throws ProblemJsonException
     */
    public function __invoke(Presentation $presentation, User $targetUser, PresentationRole $role, User $sharedBy): PresentationUser
    {
        return DB::transaction(function () use ($presentation, $targetUser, $role, $sharedBy): PresentationUser {
            $share = PresentationUser::query()->updateOrCreate(
                ['presentation_id' => $presentation->id, 'user_id' => $targetUser->id],
                ['role' => $role, 'shared_by' => $sharedBy->id, 'team_id' => $targetUser->current_team_id],
            );

            Audit::record('presentation.shared', $presentation, [
                'target_user_id' => $targetUser->id,
                'role' => $role->value,
                'shared_by' => $sharedBy->id,
            ], $sharedBy);

            return $share;
        });
    }
}
