<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Sharing\RemoveUserFromPresentation;
use App\Actions\Sharing\SharePresentation;
use App\Enums\Sharing\PresentationRole;
use App\Exceptions\ProblemJsonException;
use App\Http\Controllers\Controller;
use App\Models\Presentation;
use App\Models\PresentationUser;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

final class SharingController extends Controller
{
    public function index(Request $request, Presentation $presentation): JsonResponse
    {
        Gate::authorize('view', $presentation);

        $shares = PresentationUser::query()
            ->where('presentation_id', $presentation->id)
            ->get()
            ->map(function (PresentationUser $share): array {
                $sharedUser = $share->user;

                return [
                    'id' => $share->user_id,
                    'name' => $sharedUser !== null ? $sharedUser->name : '',
                    'email' => $sharedUser !== null ? $sharedUser->email : '',
                    'role' => $share->role->value,
                ];
            });

        return response()->json(['shares' => $shares]);
    }

    public function update(Request $request, Presentation $presentation, User $user, SharePresentation $action): JsonResponse
    {
        Gate::authorize('share', $presentation);

        $role = PresentationRole::tryFrom((string) $request->input('role', 'viewer'));
        if (! $role) {
            throw new ProblemJsonException(
                __('messages.errors.unprocessable'),
                __('messages.sharing.invalid_role'),
                422,
            );
        }

        $share = $action($presentation, $user, $role, $request->user());

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $share->role->value,
        ]);
    }

    public function destroy(Request $request, Presentation $presentation, User $user, RemoveUserFromPresentation $action): JsonResponse
    {
        Gate::authorize('share', $presentation);

        $action($presentation, $user);

        return response()->json(['ok' => true]);
    }

    public function search(Request $request): JsonResponse
    {
        $caller = $request->user();
        $query = (string) $request->query('q', '');

        // Cross-team sharing: search every user in the workspace (not only the
        // active team) so a presentation can be granted to someone on another
        // team. The owner is excluded from their own search results.
        $users = User::query()
            ->where('id', '!=', $caller?->id)
            ->where(function ($q) use ($query): void {
                $q->where('name', 'like', "%{$query}%")
                    ->orWhere('email', 'like', "%{$query}%");
            })
            ->limit(20)
            ->get()
            ->map(function (User $user): array {
                $team = $user->currentTeam;

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'team' => $team !== null ? $team->name : null,
                ];
            });

        return response()->json(['users' => $users]);
    }
}
