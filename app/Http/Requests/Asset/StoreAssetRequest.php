<?php

namespace App\Http\Requests\Asset;

use App\Data\Asset\StoreAssetData;
use Illuminate\Foundation\Http\FormRequest;

final class StoreAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'file' => ['required', 'image', 'max:10240'],
            'presentation_id' => ['nullable', 'integer', 'exists:presentations,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'file.required' => __('messages.asset.validation_file_required'),
            'file.image' => __('messages.asset.validation_file_image'),
            'file.max' => __('messages.asset.validation_file_max'),
        ];
    }

    public function payload(): StoreAssetData
    {
        return new StoreAssetData(
            file: $this->file('file'),
            presentationId: $this->filled('presentation_id') ? (int) $this->integer('presentation_id') : null,
        );
    }
}
