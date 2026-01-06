import { Camera, Loader2, Trash2, User } from "lucide-react";
import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export interface AvatarUploadViewProps {
  avatarUrl: string | null;
  fallbackText: string;
  isLoading: boolean;
  isUploading: boolean;
  isDeleting: boolean;
  error: string | null;
  onUpload: (file: File) => void;
  onDelete: () => void;
  onClearError: () => void;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-32 w-32",
};

const iconSizes = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export function AvatarUploadView({
  avatarUrl,
  fallbackText,
  isLoading,
  isUploading,
  isDeleting,
  error,
  onUpload,
  onDelete,
  onClearError,
  size = "lg",
}: AvatarUploadViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const isPending = isUploading || isDeleting;

  // Get initials from fallback text
  const initials = fallbackText
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-4" data-testid="avatar-upload">
      <div className="flex items-center gap-6">
        {/* Avatar with overlay */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: drag and drop zone */}
        <div
          className="relative"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Avatar
            className={`${sizeClasses[size]} ${dragOver ? "ring-2 ring-primary" : ""}`}
          >
            {isLoading ? (
              <AvatarFallback>
                <Loader2
                  className={`${iconSizes[size]} animate-spin text-muted-foreground`}
                />
              </AvatarFallback>
            ) : avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={fallbackText} />
            ) : (
              <AvatarFallback>
                {initials || <User className={iconSizes[size]} />}
              </AvatarFallback>
            )}
          </Avatar>

          {/* Upload overlay on hover */}
          {!isLoading && (
            <button
              type="button"
              className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity hover:opacity-100 disabled:cursor-not-allowed"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending}
              aria-label="Change avatar"
            >
              {isPending ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileChange}
            className="hidden"
            disabled={isPending}
            data-testid="avatar-file-input"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending || isLoading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" />
                {avatarUrl ? "Change" : "Upload"}
              </>
            )}
          </Button>

          {avatarUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={isPending || isLoading}
              className="text-destructive hover:text-destructive"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          className="flex items-center justify-between rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          data-testid="avatar-error"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onClearError}
            className="ml-2 text-xs underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Help text */}
      <p className="text-xs text-muted-foreground">
        JPEG, PNG, GIF, or WebP. Max 5MB.
      </p>
    </div>
  );
}
