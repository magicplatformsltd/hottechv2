"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { upsertTemplate } from "@/lib/actions/template";
import type { ProductTemplate } from "@/lib/types/product";
import type { SpecGroup, SpecItem, SpecItemType } from "@/lib/types/template";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Normalize API spec_schema (empty, string[], or SpecGroup[]) into SpecGroup[]. */
function normalizeSpecSchema(
  raw: ProductTemplate["spec_schema"] | undefined,
  keySpecs: string[] = []
): SpecGroup[] {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [];
  const first = raw[0];
  // Legacy flat string array
  if (typeof first === "string") {
    const specs: SpecItem[] = (raw as string[])
      .filter((s) => typeof s === "string" && String(s).trim() !== "")
      .map((name) => ({
        id: generateId(),
        name: String(name).trim(),
        isKey: keySpecs.includes(String(name).trim()),
      }));
    if (specs.length === 0) return [];
    return [
      {
        id: generateId(),
        groupName: "General",
        specs,
      },
    ];
  }
  // Already SpecGroup[] — preserve type, matrixConfig, and all spec fields
  if (typeof first === "object" && first !== null && "groupName" in first && "specs" in first) {
    return (raw as SpecGroup[]).map((g) => ({
      id: g.id || generateId(),
      groupName: g.groupName ?? "",
      specs: (g.specs ?? []).map((s) => ({
        ...s,
        id: s.id || generateId(),
        name: typeof s.name === "string" ? s.name : String(s.name ?? ""),
        isKey: Boolean(s.isKey),
        type: s.type,
        matrixConfig: s.matrixConfig,
      })),
    }));
  }
  return [];
}

type TemplateFormProps = {
  template: ProductTemplate | null;
};

const inputClass =
  "w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:border-hot-white/50 focus:outline-none focus:ring-1 focus:ring-hot-white/30";
const labelClass = "block font-sans text-sm font-medium text-gray-400 mb-1";

function SortableSpecItem({
  spec,
  onUpdate,
  onRemove,
  inputClass: cls,
}: {
  spec: SpecItem;
  onUpdate: (updates: Partial<SpecItem>) => void;
  onRemove: () => void;
  inputClass: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: spec.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-wrap items-center gap-2 rounded border border-white/5 bg-white/5 p-2 ${isDragging ? "z-10 opacity-90 shadow-lg" : ""}`}
    >
      <button
        type="button"
        className="touch-none cursor-grab rounded p-1 text-gray-400 hover:bg-white/10 hover:text-hot-white active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <input
        type="text"
        value={spec.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className={cls}
        placeholder="e.g. Processor"
      />
      <select
        value={spec.type ?? "text"}
        onChange={(e) => {
          const v = (e.target.value || "text") as SpecItemType;
          onUpdate({ type: v });
        }}
        className={`${cls} shrink-0 w-auto min-w-[180px]`}
        title="Spec type"
        aria-label="Spec type"
      >
        <option value="text">Standard Text</option>
        <option value="variant_matrix">Variant Matrix (RAM + Storage)</option>
        <option value="boolean">Yes/No Toggle (with details)</option>
        <option value="camera_lens">Camera Lens (Structured Form)</option>
        <option value="display_panel">Display Panel (Structured Form)</option>
        <option value="ip_rating">IP Rating (Dust/Water Pairs)</option>
      </select>
      {(spec.type ?? "text") === "variant_matrix" && (
        <div className="flex flex-wrap items-center gap-2 w-full basis-full">
          <input
            type="text"
            value={spec.matrixConfig?.col1Label ?? ""}
            onChange={(e) =>
              onUpdate({
                matrixConfig: {
                  col1Label: e.target.value,
                  col2Label: spec.matrixConfig?.col2Label ?? "",
                  hideLabelsPublicly: spec.matrixConfig?.hideLabelsPublicly ?? false,
                },
              })
            }
            className={`${cls} max-w-[180px]`}
            placeholder="Column 1 (e.g. RAM, Resolution)"
            aria-label="Column 1 label"
          />
          <input
            type="text"
            value={spec.matrixConfig?.col2Label ?? ""}
            onChange={(e) =>
              onUpdate({
                matrixConfig: {
                  col1Label: spec.matrixConfig?.col1Label ?? "",
                  col2Label: e.target.value,
                  hideLabelsPublicly: spec.matrixConfig?.hideLabelsPublicly ?? false,
                },
              })
            }
            className={`${cls} max-w-[180px]`}
            placeholder="Column 2 (e.g. Storage, Frame Rate)"
            aria-label="Column 2 label"
          />
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
            <input
              type="checkbox"
              checked={spec.matrixConfig?.hideLabelsPublicly ?? false}
              onChange={(e) =>
                onUpdate({
                  matrixConfig: {
                    col1Label: spec.matrixConfig?.col1Label ?? "",
                    col2Label: spec.matrixConfig?.col2Label ?? "",
                    hideLabelsPublicly: e.target.checked,
                  },
                })
              }
              className="rounded border-white/20"
              aria-label="Hide labels on front-end"
            />
            Hide labels on front-end (useful for Video/Pairs)
          </label>
        </div>
      )}
      <label className="flex shrink-0 items-center gap-1.5 text-sm text-gray-400">
        <input
          type="checkbox"
          checked={spec.isKey}
          onChange={(e) => onUpdate({ isKey: e.target.checked })}
          className="rounded border-white/20"
        />
        Key
      </label>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
        aria-label="Remove spec"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function SortableGroupBlock({
  group,
  defaultOpen,
  onUpdateGroupName,
  onRemoveGroup,
  onAddSpec,
  onRemoveSpec,
  onUpdateSpec,
  onSpecDragEnd,
  inputClass: cls,
}: {
  group: SpecGroup;
  defaultOpen?: boolean;
  onUpdateGroupName: (name: string) => void;
  onRemoveGroup: () => void;
  onAddSpec: () => void;
  onRemoveSpec: (specId: string) => void;
  onUpdateSpec: (specId: string, updates: Partial<SpecItem>) => void;
  onSpecDragEnd: (newSpecs: SpecItem[]) => void;
  inputClass: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSpecDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = group.specs.findIndex((s) => s.id === active.id);
      const newIndex = group.specs.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      onSpecDragEnd(arrayMove(group.specs, oldIndex, newIndex));
    },
    [group.specs, onSpecDragEnd]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-white/10 bg-hot-gray/30 overflow-hidden ${isDragging ? "z-20 opacity-95 shadow-xl" : ""}`}
    >
      <details
        className="group mb-4 bg-white/5 border border-white/10 rounded-xl overflow-hidden"
        open={defaultOpen}
      >
        <summary className="p-4 bg-white/5 hover:bg-white/10 list-none flex justify-between items-center cursor-pointer border-b border-white/5">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <button
              type="button"
              className="touch-none cursor-grab rounded p-1 text-gray-400 hover:bg-white/10 hover:text-hot-white active:cursor-grabbing shrink-0"
              {...attributes}
              {...listeners}
              aria-label="Drag to reorder group"
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <input
              type="text"
              value={group.groupName}
              onChange={(e) => onUpdateGroupName(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className={`${cls} max-w-[200px]`}
              placeholder="Group name (e.g. Display)"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddSpec();
              }}
              onKeyDown={(e) => e.stopPropagation()}
              className="flex items-center gap-1 rounded-md border border-white/20 bg-white/5 px-2 py-1.5 font-sans text-sm text-gray-400 hover:bg-white/10 hover:text-hot-white"
            >
              <Plus className="h-4 w-4" />
              Add Spec
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveGroup();
              }}
              onKeyDown={(e) => e.stopPropagation()}
              className="rounded p-1.5 text-red-400 hover:bg-red-500/10 shrink-0"
              aria-label="Remove group"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <span className="text-gray-400 group-open:rotate-180 transition-transform ml-4 shrink-0" aria-hidden>
            ▼
          </span>
        </summary>
        <div className="p-4 space-y-3">
          {group.specs.length === 0 ? (
            <p className="text-sm text-gray-500">No specs. Click &quot;Add Spec&quot; above.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSpecDragEnd}>
              <SortableContext items={group.specs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {group.specs.map((spec) => (
                  <SortableSpecItem
                    key={spec.id}
                    spec={spec}
                    onUpdate={(updates) => onUpdateSpec(spec.id, updates)}
                    onRemove={() => onRemoveSpec(spec.id)}
                    inputClass={cls}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </details>
    </div>
  );
}

export function TemplateForm({ template }: TemplateFormProps) {
  const router = useRouter();
  const isNew = !template;
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const keySpecsFromApi = Array.isArray(template?.key_specs) ? template.key_specs : [];
  const [name, setName] = useState(template?.name ?? "");
  const [slug, setSlug] = useState(template?.slug ?? "");
  const [groups, setGroups] = useState<SpecGroup[]>(() =>
    normalizeSpecSchema(template?.spec_schema, keySpecsFromApi)
  );
  const [scoreSchema, setScoreSchema] = useState<string[]>(() =>
    Array.isArray(template?.score_schema) && template.score_schema.length > 0
      ? [...template.score_schema]
      : [""]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isNew && name.trim()) {
      setSlug(slugify(name));
    }
  }, [isNew, name]);

  const addGroup = useCallback(() => {
    setGroups((prev) => [
      ...prev,
      { id: generateId(), groupName: "", specs: [] },
    ]);
  }, []);

  const removeGroup = useCallback((groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  }, []);

  const updateGroupName = useCallback((groupId: string, groupName: string) => {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, groupName } : g)));
  }, []);

  const addSpecToGroup = useCallback((groupId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, specs: [...g.specs, { id: generateId(), name: "", isKey: false, type: "text" }] }
          : g
      )
    );
  }, []);

  const removeSpec = useCallback((groupId: string, specId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, specs: g.specs.filter((s) => s.id !== specId) } : g
      )
    );
  }, []);

  const updateSpec = useCallback((groupId: string, specId: string, updates: Partial<SpecItem>) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              specs: g.specs.map((s) => (s.id === specId ? { ...s, ...updates } : s)),
            }
          : g
      )
    );
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleGroupDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setGroups((prev) => {
      const ids = prev.map((g) => g.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const addScore = useCallback(() => {
    setScoreSchema((prev) => [...prev, ""]);
  }, []);

  const updateScore = useCallback((index: number, value: string) => {
    setScoreSchema((prev) => prev.map((v, i) => (i === index ? value : v)));
  }, []);

  const removeScore = useCallback((index: number) => {
    setScoreSchema((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const scoreList = scoreSchema.map((s) => s.trim()).filter(Boolean);
    const key_specs = groups.flatMap((g) => g.specs.filter((s) => s.isKey && s.name.trim()).map((s) => s.name.trim()));
    const payload: Partial<ProductTemplate> = {
      ...(template?.id ? { id: template.id } : {}),
      name: name.trim(),
      slug: slug.trim(),
      spec_schema: groups,
      score_schema: scoreList,
      key_specs,
    };
    const result = await upsertTemplate(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/admin/products/templates");
  }

  if (!isMounted) {
    return (
      <div className="animate-pulse h-96 bg-white/5 rounded-xl max-w-2xl" aria-busy="true" />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <h2 className="font-sans text-lg font-medium text-hot-white">Basic info</h2>
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="e.g. Smartphone"
            required
          />
        </div>
        <div>
          <label className={labelClass}>Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={inputClass}
            placeholder="e.g. smartphone"
            required
          />
          {isNew && (
            <p className="mt-1 text-xs text-gray-500">Slug is auto-generated from the name; you can edit it.</p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-lg font-medium text-hot-white">Spec schema</h2>
          <button
            type="button"
            onClick={addGroup}
            className="flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-3 py-1.5 font-sans text-sm text-gray-400 hover:bg-white/10 hover:text-hot-white"
          >
            <Plus className="h-4 w-4" />
            Add Group
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Groups (e.g. Display, Performance) and spec labels. Mark &quot;Key&quot; to show in the Review Box by default.
        </p>
        {groups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/20 p-6 text-center text-gray-500">
            <p className="mb-3 text-sm">No groups yet.</p>
            <button
              type="button"
              onClick={addGroup}
              className="rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-hot-white hover:bg-white/10"
            >
              Add Group
            </button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
            <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {groups.map((group, idx) => (
                  <SortableGroupBlock
                    key={group.id}
                    group={group}
                    defaultOpen={idx === 0}
                    onUpdateGroupName={(n) => updateGroupName(group.id, n)}
                    onRemoveGroup={() => removeGroup(group.id)}
                    onAddSpec={() => addSpecToGroup(group.id)}
                    onRemoveSpec={(specId) => removeSpec(group.id, specId)}
                    onUpdateSpec={(specId, updates) => updateSpec(group.id, specId, updates)}
                    onSpecDragEnd={(newSpecs) =>
                      setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, specs: newSpecs } : g)))
                    }
                    inputClass={inputClass}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-lg font-medium text-hot-white">Score schema</h2>
          <button
            type="button"
            onClick={addScore}
            className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 font-sans text-sm text-gray-400 hover:bg-white/10 hover:text-hot-white"
          >
            Add Score
          </button>
        </div>
        <p className="text-sm text-gray-500">Labels for sub-scores (e.g. Performance, Camera, Value).</p>
        <div className="space-y-2">
          {scoreSchema.map((value, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={value}
                onChange={(e) => updateScore(i, e.target.value)}
                className={inputClass}
                placeholder="e.g. Performance"
              />
              <button
                type="button"
                onClick={() => removeScore(i)}
                className="shrink-0 rounded px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
                aria-label="Remove score"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-hot-white px-4 py-2 font-sans text-sm font-medium text-hot-black transition-colors hover:bg-hot-white/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : template ? "Update Template" : "Create Template"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/products/templates")}
          className="rounded-md border border-white/20 px-4 py-2 font-sans text-sm text-gray-400 hover:bg-white/5 hover:text-hot-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
