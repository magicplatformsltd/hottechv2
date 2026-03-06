"use client";

import { useCallback, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Images, LayoutGrid, LayoutList, Film, Pencil, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaPickerModal } from "@/app/components/admin/media/MediaPickerModal";
import type { ImageGalleryData, ImageGalleryItem, ImageGalleryLayout } from "@/components/admin/editor/extensions/ImageGallery";

function parseData(raw: string | undefined): ImageGalleryData {
  if (!raw || typeof raw !== "string") return { layout: "grid", images: [] };
  try {
    const parsed = JSON.parse(raw) as ImageGalleryData;
    return {
      layout: parsed.layout ?? "grid",
      images: Array.isArray(parsed.images)
        ? parsed.images.filter((i: unknown) => i && typeof i === "object" && "url" in i && typeof (i as { url: unknown }).url === "string")
        : [],
    };
  } catch {
    return { layout: "grid", images: [] };
  }
}

function SortableImageItem({
  item,
  onRemove,
}: {
  item: ImageGalleryItem;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-white/5",
        isDragging && "z-50 opacity-90 shadow-xl"
      )}
    >
      <img
        src={item.url}
        alt={item.alt ?? ""}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          className="rounded p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1.5 text-white/80 hover:bg-red-500/50 hover:text-white"
          aria-label="Remove image"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ImageGalleryNodeView({ node, getPos, editor }: NodeViewProps) {
  const data = parseData(node.attrs.data);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [layout, setLayout] = useState<ImageGalleryLayout>(data.layout);
  const [images, setImages] = useState<ImageGalleryItem[]>(data.images);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const updateNode = useCallback(
    (newData: Partial<ImageGalleryData>) => {
      const pos = typeof getPos === "function" ? getPos() : undefined;
      if (pos === undefined) return;
      const merged = {
        layout: newData.layout ?? layout,
        images: newData.images ?? images,
      };
      editor.commands.setNodeSelection(pos);
      editor.commands.updateAttributes("imageGallery", {
        data: JSON.stringify(merged),
      });
      setLayout(merged.layout);
      setImages(merged.images);
    },
    [editor, getPos, layout, images]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = images.findIndex((i) => i.id === active.id);
      const newIndex = images.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(images, oldIndex, newIndex);
      updateNode({ images: reordered });
    },
    [images, updateNode]
  );

  const handleSelectMultiple = useCallback(
    (items: { url: string; alt?: string }[]) => {
      const newItems: ImageGalleryItem[] = items.map((i) => ({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: i.url,
        alt: i.alt,
      }));
      updateNode({ images: [...images, ...newItems] });
      setPickerOpen(false);
    },
    [images, updateNode]
  );

  const handleRemove = useCallback(
    (id: string) => {
      updateNode({ images: images.filter((i) => i.id !== id) });
    },
    [images, updateNode]
  );

  const layoutOptions: { value: ImageGalleryLayout; icon: React.ReactNode; label: string }[] = [
    { value: "grid", icon: <LayoutGrid className="h-4 w-4" />, label: "Grid" },
    { value: "masonry", icon: <LayoutList className="h-4 w-4" />, label: "Masonry" },
    { value: "slideshow", icon: <Film className="h-4 w-4" />, label: "Slideshow" },
  ];

  return (
    <NodeViewWrapper className="my-4 block">
      <div className="relative rounded-lg border border-white/10 bg-hot-gray/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Images className="h-4 w-4 text-gray-400" />
            <span className="font-sans text-sm font-medium text-hot-white">Image Gallery</span>
          </div>
          <div className="flex items-center gap-1">
            {layoutOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateNode({ layout: opt.value })}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2 py-1.5 text-xs transition",
                  layout === opt.value
                    ? "bg-white/20 text-hot-white"
                    : "text-gray-400 hover:bg-white/10 hover:text-hot-white"
                )}
                title={opt.label}
              >
                {opt.icon}
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {images.length === 0 ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/20 py-12 text-gray-400 transition hover:border-white/40 hover:text-hot-white"
          >
            <Plus className="h-8 w-8" />
            <span className="font-sans text-sm">Add images</span>
          </button>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={images.map((i) => i.id)}>
              <div
                className={cn(
                  "grid gap-3",
                  layout === "grid" && "grid-cols-2 sm:grid-cols-3",
                  layout === "masonry" && "columns-2 sm:columns-3 gap-3 [&>*]:break-inside-avoid",
                  layout === "slideshow" && "grid-cols-1"
                )}
              >
                {layout === "masonry" ? (
                  images.map((item) => (
                    <div key={item.id} className="mb-3 break-inside-avoid">
                      <SortableImageItem item={item} onRemove={() => handleRemove(item.id)} />
                    </div>
                  ))
                ) : (
                  images.map((item) => (
                    <SortableImageItem key={item.id} item={item} onRemove={() => handleRemove(item.id)} />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {images.length > 0 && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-3 flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-gray-400 transition hover:bg-white/10 hover:text-hot-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Add more images
          </button>
        )}

        <MediaPickerModal
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={() => {}}
          multiSelect
          onSelectMultiple={handleSelectMultiple}
        />
      </div>
    </NodeViewWrapper>
  );
}
