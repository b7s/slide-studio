<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Slide\CopyTemplateToDeck;
use App\Actions\Slide\CreateSlide;
use App\Actions\Slide\DeleteSlide;
use App\Actions\Slide\DuplicateSlide;
use App\Actions\Slide\RenameSlide;
use App\Actions\Slide\ReorderSlides;
use App\Actions\Slide\RestoreSlide;
use App\Actions\Slide\SaveSlide;
use App\Enums\Slide\SourceMode;
use App\Http\Controllers\Controller;
use App\Http\Requests\Slide\CopyTemplateRequest;
use App\Http\Requests\Slide\CreateSlideRequest;
use App\Http\Requests\Slide\DuplicateSlideRequest;
use App\Http\Requests\Slide\RenameSlideRequest;
use App\Http\Requests\Slide\ReorderSlidesRequest;
use App\Http\Requests\Slide\RestoreSlideRequest;
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
            if ($request->filled('presentation_id')) {
                $query->where('presentation_id', (int) $request->query('presentation_id'));
            }
        }

        return response()->json([
            'root' => $root,
            'available' => true,
            'using_samples' => false,
            'slides' => SlideResource::collection($query->get()),
        ]);
    }

    public function create(CreateSlideRequest $request, CreateSlide $action): JsonResponse
    {
        $slide = $action($request->payload());

        return new SlideResource($slide)->response()->setStatusCode(201);
    }

    public function htmlByFile(Request $request): Response
    {
        $query = Slide::query()->where('filename', (string) $request->query('file', ''));
        if ($request->filled('presentation_id')) {
            $query->where('presentation_id', (int) $request->query('presentation_id'));
        }
        $slide = $query->firstOrFail();

        if ($request->query('embed') === '1') {
            // Keep these defaults in sync with resources/js/lib/slideStyle.js
            // (SLIDE_BG / SLIDE_COLOR / SLIDE_FONT) and BASE_CSS.
            $html = (string) $slide->html;
            $document = '<!DOCTYPE html>'
                .'<html lang="'.e(str_replace('_', '-', app()->getLocale())).'">'
                .'<head>'
                .'<meta charset="utf-8">'
                .'<meta name="viewport" content="width=device-width, initial-scale=1">'
                .'<link rel="preconnect" href="https://fonts.googleapis.com">'
                .'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
                .'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">'
                .'<style>'
                .'html,body{margin:0;padding:0;background:#fff}'
                .'body{width:1600px;height:900px;overflow:hidden;background:#fff;color:#1e1e1e;font-family:"Inter",system-ui,-apple-system,sans-serif}'
                .'.slide,.slide *{pointer-events:none!important}'
                .'ul,ol{margin:0;padding-left:1.4em}li{margin:0}'
                .'</style>'
                .'</head>'
                .'<body>'.$html.'</body>'
                .'</html>';

            return response($document)->header('Content-Type', 'text/html; charset=utf-8');
        }

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

    public function destroy(Slide $slide, DeleteSlide $action): JsonResponse
    {
        $action($slide);

        return response()->json(['ok' => true]);
    }

    public function restore(RestoreSlideRequest $request, RestoreSlide $action): JsonResponse
    {
        $slide = $action($request->payload());

        return new SlideResource($slide)->response()->setStatusCode(201);
    }

    public function rename(RenameSlideRequest $request, Slide $slide, RenameSlide $action): JsonResponse
    {
        $renamed = $action($slide, (string) $request->input('title'));

        return new SlideResource($renamed)->response()->setStatusCode(200);
    }
}
