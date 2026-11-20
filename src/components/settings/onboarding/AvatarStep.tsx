import { useRef } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function AvatarStep({
  avatarSrc,
  initials,
  uploading,
  onSelectFile,
  onRemove,
}: {
  avatarSrc: string | null;
  initials: string;
  uploading: boolean;
  onSelectFile: (file: File) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onSelectFile(file);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group">
        <Avatar className="size-28 rounded-full ring-2 ring-border">
          {avatarSrc && (
            <AvatarImage
              src={avatarSrc}
              alt=""
              className="rounded-full object-cover"
            />
          )}
          <AvatarFallback className="rounded-full text-xl font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="gap-2"
        >
          <Camera className="size-4" />
          {avatarSrc ? "Cambiar foto" : "Subir foto"}
        </Button>
        {avatarSrc && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={uploading}
            className="gap-1.5 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            Eliminar
          </Button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />
      <p className="text-xs text-muted-foreground text-center">
        PNG, JPG o WebP. Se recorta a 256x256.
      </p>
    </div>
  );
}
