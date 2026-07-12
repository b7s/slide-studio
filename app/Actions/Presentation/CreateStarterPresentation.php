<?php

namespace App\Actions\Presentation;

use App\Enums\Slide\SourceMode;
use App\Models\Presentation;
use App\Models\Team;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CreateStarterPresentation
{
    /**
     * Ensure a team has at least one presentation ("space"). Creates a single
     * starter deck with one welcome slide. The freshly created presentation is
     * returned so the caller (e.g. the editor on first login) can open it
     * immediately instead of 403-ing on an empty account.
     */
    public function __invoke(Team $team, ?string $title = null): Presentation
    {
        return DB::transaction(function () use ($team, $title): Presentation {
            $title = $title ?? 'Apresentação';

            $presentation = Presentation::create([
                'user_id' => $team->user_id,
                'team_id' => $team->id,
                'title' => $title,
                'slug' => Str::slug($title).'-'.Str::random(4),
                'deck_path' => '/presentation',
                'template_path' => '/templates',
                'settings' => ['theme' => 'navy-gold'],
            ]);

            $presentation->slides()->create([
                'position' => 1,
                'source_mode' => SourceMode::Deck,
                'filename' => '01-capa.html',
                'title' => 'Capa',
                'html' => '<section class="slide" data-file="01-capa.html">'
                    .'<h1>Bem-vindo</h1><p>Edite este slide ou crie um novo.</p>'
                    .'</section>',
            ]);

            Audit::record('presentation.created', $presentation, [
                'team_id' => $team->id,
                'starter' => true,
            ], $team->owner);

            return $presentation;
        });
    }
}
