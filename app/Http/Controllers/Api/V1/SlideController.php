<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Slide\CopyTemplateToDeck;
use App\Actions\Slide\DuplicateSlide;
use App\Actions\Slide\ReorderSlides;
use App\Actions\Slide\SaveSlide;
use App\Enums\Slide\SourceMode;
use App\Http\Controllers\Controller;
use App\Http\Requests\Slide\CopyTemplateRequest;
use App\Http\Requests\Slide\DuplicateSlideRequest;
use App\Http\Requests\Slide\ReorderSlidesRequest;
use App\Http\Requests\Slide\SaveSlideRequest;
use App\Http\Resources\SlideResource;
use App\Models\Presentation;
use App\Models\Slide;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Throwable;

final class SlideController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $root = $request->query('root', 'deck');

        $query = Slide::query()->orderBy('position');

        if ($root === 'templates') {
            $query->where('source_mode', SourceMode::Template);
        } else {
            $query->where('source_mode', SourceMode::Deck);
        }

        return response()->json([
            'root' => $root,
            'available' => true,
            'using_samples' => false,
            'slides' => SlideResource::collection($query->get()),
        ]);
    }

    public function htmlByFile(Request $request): Response
    {
        $file = (string) $request->query('file', '');
        $slide = Slide::query()->where('filename', $file)->firstOrFail();

        return response((string) $slide->html)->header('Content-Type', 'text/html; charset=utf-8');
    }

    public function save(SaveSlideRequest $request, Slide $slide, SaveSlide $action): JsonResponse
    {
        $payload = $request->payload();
        $slide = $action($slide, $payload->html, $payload->revision, $payload->overwrite);

        return new SlideResource($slide)->response()->setStatusCode(200);
    }

    /**
     * @throws Throwable
     */
    public function duplicate(DuplicateSlideRequest $request, Slide $slide, DuplicateSlide $action): JsonResponse
    {
        $copy = $action($slide, $request->payload());

        return new SlideResource($copy)->response()->setStatusCode(201);
    }

    /**
     * Copy a template slide into the target presentation as a new deck slide.
     *
     * @throws Throwable
     */
    public function copyToDeck(CopyTemplateRequest $request, Slide $slide, CopyTemplateToDeck $action): JsonResponse
    {
        $copy = $action($slide, $request->payload());

        return new SlideResource($copy)->response()->setStatusCode(201);
    }

    public function reorder(ReorderSlidesRequest $request, ReorderSlides $action): JsonResponse
    {
        $payload = $request->payload();
        $presentation = Presentation::query()->findOrFail($payload->presentationId);

        $action($presentation, $payload);

        return response()->json(['ok' => true]);
    }
}
