<?php

namespace App\Actions\Presentation;

use App\Models\Presentation;
use App\Models\User;

final class ListAccessiblePresentations
{
    /**
     * All presentations the user can reach: those owned by their teams (the
     * teams they own or belong to) plus any shared with them directly via the
     * presentation_user pivot — even when the sharing team is not one they
     * belong to.
     *
     * @return array<int, array{id: int, title: string, slug: string}>
     */
    public function __invoke(User $user): array
    {
        $teamIds = $user->ownedTeams()->pluck('id')
            ->merge($user->teams()->pluck('id'))
            ->unique()
            ->all();

        $ids = Presentation::query()
            ->whereIn('team_id', $teamIds)
            ->orWhereIn('id', $user->sharedPresentations()->pluck('id'))
            ->pluck('id')
            ->unique()
            ->all();

        return Presentation::query()
            ->whereIn('id', $ids)
            ->orderBy('title')
            ->get(['id', 'title', 'slug'])
            ->map(static fn (Presentation $presentation): array => [
                'id' => $presentation->id,
                'title' => $presentation->title,
                'slug' => $presentation->slug,
            ])
            ->all();
    }
}
