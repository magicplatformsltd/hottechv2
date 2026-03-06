"use client";

import { useState } from "react";
import { MediaPickerModal } from "@/app/components/admin/media/MediaPickerModal";

type UniversalImagePickerProps = {
  value: string | null | undefined;
  onChange: (url: string) => void;
  label?: string;
};

export function UniversalImagePicker({
  value,
  onChange,
  label,
}: UniversalImagePickerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const url = value?.trim() || null;

  function handleSelect(selectedUrl: string) {
    onChange(selectedUrl);
    setModalOpen(false);
  }

  function handleRemove() {
    onChange("");
  }

  return (
    <div className="space-y-2">
      {label && (
        <label className="block font-sans text-sm font-medium text-gray-400">
          {label}
        </label>
      )}
      {url ? (
        <div className="space-y-2">
          <img
            src={url}
            alt=""
            className="max-h-40 w-full rounded-md object-cover"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="font-sans text-sm text-gray-400 hover:text-hot-white"
            >
              Change image
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="font-sans text-sm text-gray-400 hover:text-red-400"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex w-full items-center justify-center rounded-md border border-dashed border-white/20 py-8 font-sans text-sm text-gray-400 transition-colors hover:border-white/30 hover:text-hot-white"
        >
          Select image
        </button>
      )}

      <MediaPickerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handleSelect}
        context="picker"
        multiSelect={false}
      />
    </div>
  );
}
