<?php

namespace App\Http\Controllers;

use App\Enums\Sharing\PresentationRole;
use App\Models\Presentation;
use App\Models\Slide;
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
                ->where('team_id', $user->current_team_id)
                ->orWhereHas('sharedUsers', fn ($q) => $q->where('user_id', $user->id))
                ->with('slides')
                ->first();
            abort_unless($presentation !== null, 403);
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
