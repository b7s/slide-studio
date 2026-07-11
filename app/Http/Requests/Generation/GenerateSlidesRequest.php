<?php

namespace App\Http\Requests\Generation;

use App\Data\Generation\GenerateSlidesData;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Config;

final class GenerateSlidesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'prompt' => ['required', 'string', 'min:3', 'max:2000'],
            'max_slides' => ['nullable', 'integer', 'min:1', 'max:20'],
        ];
    }

    public function payload(): GenerateSlidesData
    {
        return new GenerateSlidesData(
            prompt: $this->string('prompt')->toString(),
            maxSlides: $this->filled('max_slides')
                ? $this->integer('max_slides')
                : (int) Config::get('slides.generation.max_slides', 8),
        );
    }
}
