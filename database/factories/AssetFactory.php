<?php

namespace Database\Factories;

use App\Models\Asset;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Asset>
 */
class AssetFactory extends Factory
{
    protected $model = Asset::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'path' => 'media/'.fake()->uuid().'.jpg',
            'mime' => 'image/jpeg',
            'last_used_at' => null,
        ];
    }

    public function ownedBy(User $user): static
    {
        return $this->state(fn (array $attributes) => [
            'user_id' => $user->id,
        ]);
    }

    public function used(): static
    {
        return $this->state(fn (array $attributes) => [
            'last_used_at' => fake()->dateTime(),
        ]);
    }
}
