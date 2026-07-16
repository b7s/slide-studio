<?php

namespace App\Http\Controllers;

use App\Actions\Presentation\CreateStarterPresentation;
use App\Enums\Sharing\PresentationRole;
use App\Models\Presentation;
use App\Models\Slide;
use App\Models\Team;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class EditorController extends Controller
{
    public function index(Request $request, ?Presentation $presentation = null): Response
    {
        $user = $request->user();

        if ($presentation?->exists === true) {
            $presentation->load('slides');
            abort_unless($presentation->user_id === $user->id || $presentation->sharedUsers()->where('user_id', $user->id)->exists(), 403);
        } else {
            $presentation = Presentation::query()
                ->where(function ($q) use ($user) {
                    $q->where('team_id', $user->current_team_id)
                        ->orWhereHas('sharedUsers', fn ($sub) => $sub->where('user_id', $user->id));
                })
                ->with('slides')
                ->first();

            // First login / empty account: lazily create a starter "space"
            // for the user's current team instead of 403-ing.
            if ($presentation === null) {
                $team = $user->currentTeam ?? Team::query()->find($user->current_team_id);
                abort_unless($team !== null, 403);
                $presentation = (new CreateStarterPresentation)($team);
            }
        }

        $slides = $presentation->slides ?? collect();

        $role = PresentationRole::forUserOn($user, $presentation) ?? PresentationRole::default();

        return Inertia::render('Editor/Index', [
            'config' => [
                'mode' => 'local',
                'deckRoot' => $presentation->deck_path ?? '/presentation',
                'templateRoot' => $presentation->template_path ?? '/templates',
                'deckAvailable' => true,
                'templatesAvailable' => true,
            ],
            'slides' => $slides->map(static fn (Slide $slide): array => [
                'file' => $slide->filename,
                'title' => $slide->title,
                'number' => (string) $slide->position,
            ])->values()->all(),
            'presentationId' => $presentation->id,
            'presentationSlug' => $presentation->slug,
            'presentationTitle' => $presentation->title,
            'selectedFile' => $slides->first()?->filename,
            'permissions' => [
                'role' => $role->value,
                'canEdit' => $role->canWrite(),
                'canShare' => $role->canShare(),
                'canDelete' => $role->canDelete(),
            ],
        ]);
    }
}
