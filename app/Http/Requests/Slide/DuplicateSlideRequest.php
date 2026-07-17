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
            'title' => ['required', 'string', 'min:1', 'max:255'],
        ];
    }

    public function payload(): DuplicateSlideData
    {
        return new DuplicateSlideData(
            title: trim((string) $this->string('title')->toString()),
        );
    }
}
