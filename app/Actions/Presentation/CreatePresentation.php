<?php

namespace App\Actions\Presentation;

use App\Models\Presentation;
use App\Models\Team;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;

final class CreatePresentation
{
    /**
     * Create a fresh, empty presentation (no slides) in the given team. Used by
     * the Library "new presentation" action. The title falls back to the
     * localized "untitled" label when none is supplied.
     */
    public function __invoke(Team $team, ?string $title): Presentation
    {
        return DB::transaction(function () use ($team, $title): Presentation {
            $title ??= __('messages.presentation.untitled');

            $presentation = Presentation::createForTeam($team, $title);

            Audit::record('presentation.created', $presentation, [
                'team_id' => $team->id,
                'starter' => false,
            ], $team->owner);

            return $presentation;
        });
    }
}
