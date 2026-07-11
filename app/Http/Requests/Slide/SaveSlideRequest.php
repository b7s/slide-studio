<?php

namespace App\Http\Requests\Slide;

use App\Data\Slide\SaveSlideData;
use Illuminate\Foundation\Http\FormRequest;

final class SaveSlideRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'html' => ['required', 'string'],
            'revision' => ['nullable', 'string'],
            'overwrite' => ['nullable', 'boolean'],
        ];
    }

    public function payload(): SaveSlideData
    {
        return new SaveSlideData(
            html: $this->string('html')->toString(),
            revision: $this->filled('revision') ? $this->string('revision')->toString() : null,
            overwrite: $this->boolean('overwrite', false),
        );
    }
}
