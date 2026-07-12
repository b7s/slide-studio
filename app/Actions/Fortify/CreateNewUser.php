<?php

namespace App\Actions\Fortify;

use App\Actions\Presentation\CreateStarterPresentation;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules;

    /**
     * Validate and create a newly registered user.
     *
     * @param  array<string, string>  $input
     *
     * @throws ValidationException
     */
    public function create(array $input): User
    {
        Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique(User::class),
            ],
            'password' => $this->passwordRules(),
        ])->validate();

        return DB::transaction(function () use ($input): User {
            $user = User::create([
                'name' => $input['name'],
                'email' => $input['email'],
                'password' => Hash::make($input['password']),
            ]);

            $team = Team::create([
                'user_id' => $user->id,
                'name' => $input['name'].'\'s Team',
                'slug' => Str::slug($input['name']).'-'.Str::random(4),
                'personal' => true,
            ]);

            $team->members()->attach($user->id, ['role' => 'admin']);

            $user->current_team_id = $team->id;
            $user->save();

            // Give every new account a starter "space" so the editor never
            // 403s on an empty account on first login.
            (new CreateStarterPresentation)($team);

            return $user;
        });
    }
}
