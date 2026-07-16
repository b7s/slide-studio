<?php

namespace App\Http\Requests\Slide;

use Illuminate\Foundation\Http\FormRequest;

final class RenameSlideRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
        ];
    }
}
