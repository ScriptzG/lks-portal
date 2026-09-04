import { useRef } from "react";
import { ImagePlus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface EditableFieldData {
  id: string;
  fieldKey: string;
  fieldType: "text" | "textarea" | "image" | "color" | "link";
  label: string;
  section: string;
}

interface Props {
  fields: EditableFieldData[];
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  onImageUpload: (fieldId: string, file: File) => Promise<void>;
  uploadingFieldId: string | null;
  resolveImageUrl: (value: string) => string;
  disabled?: boolean;
}

export function EditableFieldForm({ fields, values, onChange, onImageUpload, uploadingFieldId, resolveImageUrl, disabled }: Props) {
  const sections = fields.reduce<Record<string, EditableFieldData[]>>((acc, field) => {
    (acc[field.section] ??= []).push(field);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-8">
      {Object.entries(sections).map(([section, sectionFields]) => (
        <div key={section} className="flex flex-col gap-4">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-gray-400">{section}</h3>
          <div className="flex flex-col gap-4">
            {sectionFields.map((field) => (
              <FieldControl
                key={field.id}
                field={field}
                value={values[field.id] ?? ""}
                onChange={(value) => onChange(field.id, value)}
                onImageUpload={(file) => onImageUpload(field.id, file)}
                uploading={uploadingFieldId === field.id}
                resolveImageUrl={resolveImageUrl}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
  onImageUpload,
  uploading,
  resolveImageUrl,
  disabled,
}: {
  field: EditableFieldData;
  value: string;
  onChange: (value: string) => void;
  onImageUpload: (file: File) => void;
  uploading: boolean;
  resolveImageUrl: (value: string) => string;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (field.fieldType === "textarea") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{field.label}</Label>
        <Textarea rows={4} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }

  if (field.fieldType === "image") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{field.label}</Label>
        <div className="flex items-center gap-3">
          {value && (
            <img
              src={resolveImageUrl(value)}
              alt={field.label}
              className="h-14 w-14 rounded-md border border-gray-200 object-cover"
              onError={(e) => (e.currentTarget.style.visibility = "hidden")}
            />
          )}
          <Button type="button" variant="outline" size="sm" disabled={disabled || uploading} onClick={() => fileInputRef.current?.click()}>
            <ImagePlus className="h-4 w-4" /> {uploading ? "Uploading…" : "Replace image"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImageUpload(file);
              e.target.value = "";
            }}
          />
        </div>
        <p className="text-xs text-gray-400">{value}</p>
      </div>
    );
  }

  if (field.fieldType === "color") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{field.label}</Label>
        <div className="flex items-center gap-2">
          <Input type="color" className="h-9 w-16 p-1" value={value || "#8B5CF6"} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
          <Input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="max-w-[10rem]" />
        </div>
      </div>
    );
  }

  if (field.fieldType === "link") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{field.label}</Label>
        <Input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder="https:// or mailto:" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{field.label}</Label>
      <Input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
