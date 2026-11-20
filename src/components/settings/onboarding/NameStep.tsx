import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NameStep({
  fullName,
  nickname,
  onFullNameChange,
  onNicknameChange,
}: {
  fullName: string;
  nickname: string;
  onFullNameChange: (value: string) => void;
  onNicknameChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Nombre completo</Label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => onFullNameChange(e.target.value)}
          placeholder="Tu nombre"
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nickname">Apodo</Label>
        <Input
          id="nickname"
          value={nickname}
          onChange={(e) => onNicknameChange(e.target.value)}
          placeholder="Como quieres que te saludemos?"
        />
      </div>
    </div>
  );
}
