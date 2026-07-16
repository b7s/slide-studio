<?php

namespace App\Actions\Presentation;

use App\Enums\Slide\SourceMode;
use App\Models\Presentation;
use App\Models\Slide;
use App\Models\Team;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;

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

            $presentation = Presentation::createForTeam($team, $title);
            $presentation->update(['settings' => ['theme' => 'navy-highlight']]);
            self::seed($presentation);

            Audit::record('presentation.created', $presentation, [
                'team_id' => $team->id,
                'starter' => true,
            ], $team->owner);

            return $presentation;
        });
    }

    /**
     * Seed a single, blank "Capa" slide at position 1. Shared by the
     * first-login starter and the regular "new presentation" path so every
     * freshly-minted presentation opens with exactly one slide as a
     * reference; the user then adds more via the editor's Add Slide button.
     */
    public static function seed(Presentation $presentation): Slide
    {
        return $presentation->slides()->create([
            'position' => 1,
            'source_mode' => SourceMode::Deck,
            'filename' => '01-capa.html',
            'title' => 'Capa',
            'html' => '<section class="slide" data-file="01-capa.html">'
                .'<h1>Bem-vindo</h1><p>Edite este slide ou crie um novo.</p>'
                .'</section>',
        ]);
    }
}
