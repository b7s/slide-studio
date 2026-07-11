<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Generation\StartGeneration;
use App\Http\Controllers\Controller;
use App\Http\Requests\Generation\GenerateSlidesRequest;
use App\Jobs\Generation\GenerateSlides;
use App\Models\Generation;
use App\Models\Presentation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class GenerateController extends Controller
{
    public function store(GenerateSlidesRequest $request, Presentation $presentation, StartGeneration $action): JsonResponse
    {
        $generation = $action($presentation, $request->payload(), $request->user());

        GenerateSlides::dispatch($generation->id);

        return response()->json([
            'generation_id' => $generation->id,
            'status' => $generation->status->value,
        ])->setStatusCode(202);
    }

    public function show(Request $request, Generation $generation): JsonResponse
    {
        return response()->json([
            'id' => $generation->id,
            'status' => $generation->status->value,
            'slide_count' => $generation->slide_count,
            'error' => $generation->error,
        ]);
    }
}
