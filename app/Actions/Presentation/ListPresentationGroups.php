<?php

namespace App\Actions\Presentation;

use App\Models\Presentation;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Collection;

final class ListPresentationGroups
{
    /**
     * Build the left-panel accordion: the user's personal space first, then
     * every team they belong to, then a "shared with me" group. Each entry
     * carries a live count of presentations.
     *
     * @return array<int, array<string, mixed>>
     */
    public function __invoke(User $user): array
    {
        $groups = [];

        $personal = $user->ownedTeams()->where('personal', true)->first() ?? $user->currentTeam;
        if ($personal !== null) {
            $groups[] = [
                'key' => 'personal',
                'team_id' => $personal->id,
                'label' => $personal->name,
                'personal' => true,
                'count' => Presentation::query()->where('team_id', $personal->id)->count(),
            ];
        }

        /** @var Collection<int, Team> $teams */
        $teams = $user->teams()
            ->where('personal', false)
            ->orderBy('name')
            ->get();

        foreach ($teams as $team) {
            $groups[] = [
                'key' => 'team',
                'team_id' => $team->id,
                'label' => $team->name,
                'personal' => false,
                'count' => Presentation::query()->where('team_id', $team->id)->count(),
            ];
        }

        $sharedCount = $user->sharedPresentations()->count();
        if ($sharedCount > 0) {
            $groups[] = [
                'key' => 'shared',
                'team_id' => null,
                'label' => __('messages.library.shared_with_me'),
                'personal' => false,
                'count' => $sharedCount,
            ];
        }

        return $groups;
    }
}
