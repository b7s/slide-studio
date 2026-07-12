<?php

namespace App\Actions\Presentation;

use App\Data\Presentation\ListPresentationsData;
use App\Enums\Sharing\PresentationRole;
use App\Exceptions\ProblemJsonException;
use App\Models\Presentation;
use App\Models\User;
use Illuminate\Support\Facades\Lang;

final class ListPresentations
{
    /**
     * List presentations visible to the user, grouped by "personal" (their
     * personal team), a specific "team", or everything "shared" with them via
     * the presentation_user pivot. Supports search, sort (name|updated_at) and
     * direction (asc|desc), returned in chunks via pagination.
     *
     * @return array{presentations: array<int, array<string, mixed>>, pagination: array<string, mixed>}
     *
     * @throws ProblemJsonException
     */
    public function __invoke(User $user, ListPresentationsData $data): array
    {
        $sortColumn = match ($data->sort) {
            'name', 'title' => 'title',
            'created_at' => 'created_at',
            default => 'updated_at',
        };
        $dir = $data->dir === 'asc' ? 'asc' : 'desc';

        if ($data->group === 'shared') {
            $query = $user->sharedPresentations();
        } else {
            $teamId = $data->group === 'personal'
                ? $this->personalTeamId($user)
                : $data->teamId;

            if ($teamId === null) {
                throw new ProblemJsonException(
                    Lang::get('messages.errors.unprocessable'),
                    Lang::get('messages.library.unknown_team'),
                    422,
                );
            }

            if ($data->group !== 'personal' && ! $user->teams()->where('id', $teamId)->exists()) {
                throw new ProblemJsonException(
                    Lang::get('messages.errors.forbidden'),
                    Lang::get('messages.library.not_member'),
                    403,
                );
            }

            $query = Presentation::query()->where('team_id', $teamId);
        }

        if ($data->query !== null && $data->query !== '') {
            $query->where('title', 'like', '%'.$data->query.'%');
        }

        $paginator = $query->orderBy($sortColumn, $dir)->paginate($data->perPage, ['*'], 'page', $data->page);

        $presentations = array_map(
            fn (Presentation $presentation): array => $this->toItem($user, $presentation, $data->group === 'shared'),
            $paginator->items()
        );

        return [
            'presentations' => $presentations,
            'pagination' => [
                'page' => $paginator->currentPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'lastPage' => $paginator->lastPage(),
                'hasMore' => $paginator->hasMorePages(),
            ],
        ];
    }

    private function personalTeamId(User $user): ?int
    {
        $personal = $user->ownedTeams()->where('personal', true)->first();

        if ($personal === null) {
            return $user->current_team_id;
        }

        return $personal->id;
    }

    /**
     * @return array<string, mixed>
     */
    private function toItem(User $user, Presentation $presentation, bool $shared): array
    {
        $cover = $presentation->slides()->first();
        $role = PresentationRole::forUserOn($user, $presentation) ?? PresentationRole::default();
        $team = $presentation->team;

        return [
            'id' => $presentation->id,
            'slug' => $presentation->slug,
            'title' => $presentation->title,
            'cover_file' => $cover?->filename,
            'cover_html' => $cover?->html,
            'updated_at' => $presentation->updated_at?->toISOString(),
            'role' => $role->value,
            'shared' => $shared,
            'team' => $team !== null
                ? ['id' => $team->id, 'name' => $team->name, 'personal' => (bool) $team->personal]
                : null,
        ];
    }
}
