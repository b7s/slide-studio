<?php

namespace App\Services\Generation;

use App\Ai\Agents\SlideDeckGenerator;
use App\Models\Presentation;

final class SlideGenerator
{
    /**
     * Generate a slide deck for the given presentation using the configured
     * primary AI provider, automatically failing over to the configured
     * fallback provider when the primary is rate limited or unavailable.
     *
     * @return array{title: string, slides: array<int, array{title: string, html: string}>}
     */
    public function generate(Presentation $presentation, string $prompt, int $maxSlides): array
    {
        $providers = $this->providerChain();

        $response = (new SlideDeckGenerator($presentation, $maxSlides))
            ->prompt($prompt, provider: $providers);

        return [
            'title' => (string) ($response['title'] ?? $presentation->title),
            'slides' => $response['slides'] ?? [],
        ];
    }

    /**
     * Build the provider failover chain from configuration.
     *
     * @return array<string, string>
     */
    private function providerChain(): array
    {
        $primary = (string) config('slides.generation.provider', 'openai');
        $primaryModel = (string) config('slides.generation.model', 'gpt-4o');
        $fallback = (string) config('slides.generation.fallback_provider', 'anthropic');
        $fallbackModel = (string) config('slides.generation.fallback_model', 'claude-3-5-sonnet-latest');

        $chain = [$primary => $primaryModel];

        if ($fallback !== '' && $fallback !== $primary) {
            $chain[$fallback] = $fallbackModel;
        }

        return $chain;
    }
}
