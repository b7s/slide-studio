<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Presentation\ListAccessiblePresentations;
use App\Actions\Presentation\RenamePresentation;
use App\Enums\Sharing\PresentationRole;
use App\Exceptions\ProblemJsonException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Presentation\RenamePresentationRequest;
use App\Http\Resources\PresentationResource;
use App\Models\Presentation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Lang;
use Symfony\Component\HttpFoundation\Response;

final class PresentationController extends Controller
{
    public function accessible(Request $request, ListAccessiblePresentations $action): JsonResponse
    {
        return response()->json([
            'presentations' => $action($request->user()),
        ]);
    }

    /**
     * Rename a presentation. Only callers with write access (owner or editor)
     * may mutate the title; viewers get a 403 Problem+JSON.
     */
    public function rename(RenamePresentationRequest $request, Presentation $presentation, RenamePresentation $action): JsonResponse
    {
        $user = $request->user();
        $role = PresentationRole::forUserOn($user, $presentation);
        if ($role === null || ! $role->canWrite()) {
            throw new ProblemJsonException(
                Lang::get('messages.errors.forbidden'),
                Lang::get('messages.library.rename_forbidden'),
                Response::HTTP_FORBIDDEN,
            );
        }

        $presentation = $action($presentation, $request->title());

        return response()->json((new PresentationResource($presentation))->toArray($request));
    }
}
