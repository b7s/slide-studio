<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Presentation\CreatePresentation;
use App\Actions\Presentation\ListPresentationGroups;
use App\Actions\Presentation\ListPresentations;
use App\Exceptions\ProblemJsonException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Presentation\CreatePresentationRequest;
use App\Http\Requests\Presentation\ListPresentationsRequest;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Lang;
use Symfony\Component\HttpFoundation\Response;

final class PresentationLibraryController extends Controller
{
    public function index(ListPresentationsRequest $request, ListPresentations $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json($action($user, $request->payload()));
    }

    public function groups(Request $request, ListPresentationGroups $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json(['groups' => $action($user)]);
    }

    public function store(CreatePresentationRequest $request, CreatePresentation $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $teamId = $request->teamId() ?? $user->current_team_id;

        if ($teamId === null || ! $user->teams()->where('id', $teamId)->exists()) {
            throw new ProblemJsonException(
                Lang::get('messages.errors.forbidden'),
                Lang::get('messages.library.not_member'),
                Response::HTTP_FORBIDDEN,
            );
        }

        /** @var Team $team */
        $team = Team::query()->findOrFail($teamId);

        $presentation = $action($team, $request->title());

        return response()->json($presentation)
            ->setStatusCode(Response::HTTP_CREATED);
    }
}
