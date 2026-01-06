import { Loader2 } from "lucide-react";
import type { Area } from "react-easy-crop";
import Cropper from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export interface ImageCropperViewProps {
  imageSrc: string;
  crop: { x: number; y: number };
  zoom: number;
  aspect?: number;
  cropShape?: "rect" | "round";
  onCropChange: (crop: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  onCropComplete: (croppedArea: Area, croppedAreaPixels: Area) => void;
  onApply: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

export function ImageCropperView({
  imageSrc,
  crop,
  zoom,
  aspect = 1,
  cropShape = "round",
  onCropChange,
  onZoomChange,
  onCropComplete,
  onApply,
  onCancel,
  isProcessing,
}: ImageCropperViewProps) {
  return (
    <div className="space-y-6" data-testid="image-cropper">
      {/* Cropping area */}
      <div className="relative h-[300px] w-full overflow-hidden rounded-lg bg-muted">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          cropShape={cropShape}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropComplete}
          showGrid={false}
        />
      </div>

      {/* Zoom slider */}
      <div className="space-y-2">
        <label
          htmlFor="zoom-slider"
          className="text-sm font-medium text-foreground"
        >
          Zoom
        </label>
        <Slider
          id="zoom-slider"
          min={1}
          max={3}
          step={0.1}
          value={[zoom]}
          onValueChange={(values) => onZoomChange(values[0])}
          className="w-full"
          data-testid="zoom-slider"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
          data-testid="cancel-button"
        >
          Cancel
        </Button>
        <Button
          onClick={onApply}
          disabled={isProcessing}
          data-testid="apply-button"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Apply"
          )}
        </Button>
      </div>
    </div>
  );
}
