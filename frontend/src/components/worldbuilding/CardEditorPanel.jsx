import { useState, useEffect, useCallback, useRef } from "react";
import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { worldbuildingApi } from "@/lib/api";

function Field({ label, value, onChange, onBlur, multiline, rows = 8, placeholder }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground font-normal">{label}</Label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          rows={rows}
          placeholder={placeholder}
          className="text-sm resize-none"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className="text-sm"
        />
      )}
    </div>
  );
}

export default function CardEditorPanel({ node, onClose, onUpdate, onDelete }) {
  const item = node?.data?.item;

  const [title, setTitle] = useState("");
  const [dataFields, setDataFields] = useState({});

  // Track the committed (server-confirmed) values to diff on blur
  const committedRef = useRef({ title: "", dataFields: {} });

  // Reset form when the selected card changes
  useEffect(() => {
    if (!item) return;
    const t = item.title ?? "";
    const d = item.data ?? {};
    setTitle(t);
    setDataFields(d);
    committedRef.current = { title: t, dataFields: d };
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchTitle = useCallback(async () => {
    if (!item || title === committedRef.current.title) return;
    const prev = committedRef.current.title;
    committedRef.current.title = title;
    onUpdate(item.id, { ...item, title });
    try {
      const res = await worldbuildingApi.updateItem(item.id, { title });
      onUpdate(item.id, res.data);
    } catch {
      setTitle(prev);
      committedRef.current.title = prev;
      onUpdate(item.id, { ...item, title: prev });
      toast.error("Couldn't save that. Try again?");
    }
  }, [item, title, onUpdate]);

  // Backend replaces data wholesale — always send the full merged object.
  const patchData = useCallback(async (newDataFields) => {
    if (!item) return;
    const prev = committedRef.current.dataFields;
    committedRef.current.dataFields = newDataFields;
    onUpdate(item.id, { ...item, data: newDataFields });
    try {
      const res = await worldbuildingApi.updateItem(item.id, { data: newDataFields });
      // Sync server response so provenance marker dims live if ai → ai_edited
      onUpdate(item.id, res.data);
    } catch {
      setDataFields(prev);
      committedRef.current.dataFields = prev;
      onUpdate(item.id, { ...item, data: prev });
      toast.error("Couldn't save that. Try again?");
    }
  }, [item, onUpdate]);

  const handleDataBlur = useCallback((field) => {
    if (dataFields[field] === committedRef.current.dataFields[field]) return;
    patchData(dataFields);
  }, [dataFields, patchData]);

  const handleDelete = useCallback(async () => {
    if (!item) return;
    const confirmed = window.confirm("Delete this card? Gone for good — can't undo.");
    if (!confirmed) return;
    try {
      const res = await worldbuildingApi.deleteItem(item.id);
      const alsoDeleted = res.data.also_deleted_connections ?? 0;
      // Canvas handles toast (needs connection count) and edge state cleanup
      onDelete(item.id, alsoDeleted);
      onClose();
    } catch {
      toast.error("Couldn't delete that card. Try again?");
    }
  }, [item, onDelete, onClose]);

  // Escape closes the panel (keydown listener on document so it fires even
  // when focus is inside the panel's inputs)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!node || !item) return null;

  const type = item.type;
  const headerLabel =
    type === "character" ? "Character" : type === "place" ? "Place" : "Note";

  return (
    <div className="absolute right-0 top-0 h-full w-[360px] bg-card border-l border-border z-20 flex flex-col animate-slide-in-left">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {headerLabel}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-sm"
          onClick={onClose}
          aria-label="Close editor"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <Field
          label={type === "note" ? "Title — optional" : "Name"}
          value={title}
          onChange={setTitle}
          onBlur={patchTitle}
          placeholder={type === "note" ? "Leave blank if you like" : ""}
        />

        {type === "character" && (
          <>
            <Field
              label="Role"
              value={dataFields.role ?? ""}
              onChange={(v) => setDataFields((d) => ({ ...d, role: v }))}
              onBlur={() => handleDataBlur("role")}
              placeholder="Protagonist, mentor, foil…"
            />
            <Field
              label="First seen"
              value={dataFields.first_seen ?? ""}
              onChange={(v) => setDataFields((d) => ({ ...d, first_seen: v }))}
              onBlur={() => handleDataBlur("first_seen")}
              placeholder="Chapter 1, or any reference"
            />
            <Field
              label="Notes"
              value={dataFields.body ?? ""}
              onChange={(v) => setDataFields((d) => ({ ...d, body: v }))}
              onBlur={() => handleDataBlur("body")}
              multiline
              rows={8}
            />
          </>
        )}

        {type === "place" && (
          <>
            <Field
              label="Kind"
              value={dataFields.kind ?? ""}
              onChange={(v) => setDataFields((d) => ({ ...d, kind: v }))}
              onBlur={() => handleDataBlur("kind")}
              placeholder="City, room, planet, region…"
            />
            <Field
              label="First seen"
              value={dataFields.first_seen ?? ""}
              onChange={(v) => setDataFields((d) => ({ ...d, first_seen: v }))}
              onBlur={() => handleDataBlur("first_seen")}
              placeholder="Chapter 1, or any reference"
            />
            <Field
              label="Notes"
              value={dataFields.body ?? ""}
              onChange={(v) => setDataFields((d) => ({ ...d, body: v }))}
              onBlur={() => handleDataBlur("body")}
              multiline
              rows={8}
            />
          </>
        )}

        {type === "note" && (
          <Field
            label="The note"
            value={dataFields.body ?? ""}
            onChange={(v) => setDataFields((d) => ({ ...d, body: v }))}
            onBlur={() => handleDataBlur("body")}
            multiline
            rows={10}
          />
        )}
      </div>

      {/* Footer — delete */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 w-full justify-start"
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4" />
          Delete card
        </Button>
      </div>
    </div>
  );
}
