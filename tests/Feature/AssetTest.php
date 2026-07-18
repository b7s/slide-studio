<?php

use App\Models\Asset;
use App\Models\Presentation;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

function makeUserFor(): User
{
    return User::factory()->create();
}

function makeDeckFor(User $user): Presentation
{
    return Presentation::query()->create([
        'user_id' => $user->id,
        'title' => 'Deck '.Str::random(4),
        'slug' => 'deck-'.Str::random(6),
        'deck_path' => '/presentation',
        'template_path' => '/templates',
    ]);
}

it('lists only the authenticated user assets', function () {
    Storage::fake('public');
    $owner = makeUserFor();
    $other = makeUserFor();

    Asset::factory()->count(2)->ownedBy($owner)->create();
    Asset::factory()->ownedBy($other)->create();

    $this->actingAs($owner);

    $response = $this->getJson(route('api.v1.assets.index'));

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(2);
});

it('uploads an image and stores it on disk with a relative path', function () {
    Storage::fake('public');
    $user = makeUserFor();
    $presentation = makeDeckFor($user);
    $this->actingAs($user);

    $file = UploadedFile::fake()->image('logo.png', 10, 10);

    $response = $this->postJson(route('api.v1.assets.store'), [
        'file' => $file,
        'presentation_id' => $presentation->id,
    ]);

    $response->assertCreated();
    $path = $response->json('data.path');
    expect($path)->toStartWith('media/');
    Storage::disk('public')->assertExists($path);

    $asset = Asset::query()->where('path', $path)->firstOrFail();
    expect($asset->user_id)->toBe($user->id);
    expect($asset->presentations()->where('presentation_id', $presentation->id)->exists())->toBeTrue();
});

it('stores the original file name and exposes it via the resource', function () {
    Storage::fake('public');
    $user = makeUserFor();
    $presentation = makeDeckFor($user);
    $this->actingAs($user);

    $file = UploadedFile::fake()->image('Company Logo.png', 10, 10);

    $response = $this->postJson(route('api.v1.assets.store'), [
        'file' => $file,
        'presentation_id' => $presentation->id,
    ]);

    $response->assertCreated();
    // The original filename is returned so the editor can name image boxes
    // from a human-readable label instead of the stored uuid path.
    expect($response->json('data.original_name'))->toBe('Company Logo.png');

    $asset = Asset::query()->where('path', $response->json('data.path'))->firstOrFail();
    expect($asset->original_name)->toBe('Company Logo.png');
});

it('rejects non image uploads', function () {
    Storage::fake('public');
    $user = makeUserFor();
    $this->actingAs($user);

    $file = UploadedFile::fake()->create('doc.pdf', 10, 'application/pdf');

    $this->postJson(route('api.v1.assets.store'), ['file' => $file])
        ->assertUnprocessable();
});

it('rejects oversized uploads', function () {
    Storage::fake('public');
    $user = makeUserFor();
    $this->actingAs($user);

    $file = UploadedFile::fake()->image('big.png', 10, 10)->size(11000);

    $this->postJson(route('api.v1.assets.store'), ['file' => $file])
        ->assertUnprocessable();
});

it('filters assets by presentation', function () {
    Storage::fake('public');
    $user = makeUserFor();
    $presentation = makeDeckFor($user);
    $this->actingAs($user);

    $mine = Asset::factory()->ownedBy($user)->create();
    $mine->presentations()->attach($presentation->id, ['last_used_at' => now()]);
    Asset::factory()->ownedBy($user)->create();

    $response = $this->getJson(route('api.v1.assets.index', ['presentation' => $presentation->id]));

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(1);
});

it('touches an asset to record last_used per presentation', function () {
    Storage::fake('public');
    $user = makeUserFor();
    $presentation = makeDeckFor($user);
    $this->actingAs($user);

    $asset = Asset::factory()->ownedBy($user)->create();

    $this->postJson(route('api.v1.assets.touch', ['asset' => $asset->id]), [
        'presentation_id' => $presentation->id,
    ])->assertOk();

    expect($asset->fresh()->last_used_at)->not->toBeNull();
    $pivot = $asset->presentations()->where('presentation_id', $presentation->id)->first();
    expect($pivot)->not->toBeNull();
    expect($pivot->pivot->last_used_at)->not->toBeNull();
});

it('denies destroying another users asset', function () {
    Storage::fake('public');
    $owner = makeUserFor();
    $other = makeUserFor();
    $asset = Asset::factory()->ownedBy($owner)->create();
    $this->actingAs($other);

    $this->deleteJson(route('api.v1.assets.destroy', ['asset' => $asset->id]))
        ->assertForbidden();

    expect(Asset::query()->find($asset->id))->not->toBeNull();
});

it('deletes the owners asset', function () {
    Storage::fake('public');
    $owner = makeUserFor();
    $asset = Asset::factory()->ownedBy($owner)->create();
    $this->actingAs($owner);

    $this->deleteJson(route('api.v1.assets.destroy', ['asset' => $asset->id]))
        ->assertOk();

    expect(Asset::query()->find($asset->id))->toBeNull();
});
