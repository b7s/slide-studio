<?php

namespace App\Http\Requests\Slide;

use App\Data\Slide\ReorderSlidesData;
use Illuminate\Foundation\Http\FormRequest;

final class ReorderSlidesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'presentation_id' => ['required', 'integer'],
            'order' => ['required', 'array'],
            'order.*' => ['integer', 'min:0'],
        ];
    }

    public function payload(): ReorderSlidesData
    {
        /** @var array<string, int> $raw */
        $raw = $this->input('order');
        /** @var array<string, int> $order */
        $order = collect($raw)
            ->mapWithKeys(static fn ($position, string $filename): array => [$filename => (int) $position])
            ->all();

        return new ReorderSlidesData(
            presentationId: $this->integer('presentation_id'),
            order: $order,
        );
    }
}
