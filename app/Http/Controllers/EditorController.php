<?php

namespace App\Http\Controllers;

use App\Models\Presentation;
use App\Models\Slide;
use Inertia\Inertia;
use Inertia\Response;

final class EditorController extends Controller
{
    public function index(?Presentation $presentation = null): Response
    {
        $presentation ??= Presentation::query()->with('slides')->first();
        $slides = $presentation->slides ?? collect();

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
        ]);
    }
}
