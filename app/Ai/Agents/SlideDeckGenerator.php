<?php

namespace App\Ai\Agents;

use App\Models\Presentation;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;
use Stringable;

class SlideDeckGenerator implements Agent, HasStructuredOutput
{
    use Promptable;

    public function __construct(
        public readonly Presentation $presentation,
        public readonly int $maxSlides = 8,
    ) {}

    public function instructions(): Stringable|string
    {
        return __('messages.ai.system_prompt');
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'title' => $schema->string()->required(),
            'slides' => $schema->array()
                ->items($schema->object(fn (JsonSchema $s): array => [
                    'title' => $s->string()->required(),
                    'html' => $s->string()->required(),
                ]))
                ->required(),
        ];
    }
}
