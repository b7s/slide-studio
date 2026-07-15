<?php

namespace Database\Seeders;

use App\Enums\Slide\SourceMode;
use App\Models\Presentation;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class SamplePresentationSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $user = User::factory()->create([
            'name' => 'Demo User',
            'email' => 'demo@example.com',
        ]);

        $presentation = Presentation::create([
            'user_id' => $user->id,
            'title' => 'Apresentação de demonstração',
            'slug' => 'presentation-demo',
            'deck_path' => '/presentation',
            'template_path' => '/templates',
            'settings' => ['theme' => 'navy-highlight'],
        ]);

        $slides = [
            ['filename' => '01-capa.html', 'title' => 'Capa', 'html' => '<section class="slide" data-file="01-capa.html">Capa</section>'],
            ['filename' => '02-agenda.html', 'title' => 'Agenda', 'html' => '<section class="slide" data-file="02-agenda.html">Agenda</section>'],
            ['filename' => '03-conteudo.html', 'title' => 'Conteúdo', 'html' => '<section class="slide" data-file="03-conteudo.html">Conteúdo</section>'],
            ['filename' => '04-contato.html', 'title' => 'Contato', 'html' => '<section class="slide" data-file="04-contato.html">Contato</section>'],
        ];

        foreach ($slides as $index => $slide) {
            $presentation->slides()->create([
                'position' => $index + 1,
                'source_mode' => SourceMode::Deck,
                'filename' => $slide['filename'],
                'title' => $slide['title'],
                'html' => $slide['html'],
            ]);
        }
    }
}
