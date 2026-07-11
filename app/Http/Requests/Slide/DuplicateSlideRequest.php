<?php

namespace App\Http\Requests\Slide;

use App\Data\Slide\DuplicateSlideData;
use Illuminate\Foundation\Http\FormRequest;

final class DuplicateSlideRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'filename' => ['required', 'string', 'max:255'],
            'title' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function payload(): DuplicateSlideData
    {
        return new DuplicateSlideData(
            filename: $this->string('filename')->toString(),
            title: $this->filled('title') ? $this->string('title')->toString() : null,
        );
    }
}
