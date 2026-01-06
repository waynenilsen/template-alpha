import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ImageCropperView } from "./image-cropper-view";

// Simple 100x100 colored square as sample image (green)
const SAMPLE_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%234ade80'/%3E%3C/svg%3E";

const meta = {
  title: "Components/ImageCropperView",
  component: ImageCropperView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    imageSrc: SAMPLE_IMAGE,
    crop: { x: 0, y: 0 },
    zoom: 1,
    aspect: 1,
    cropShape: "round",
    onCropChange: fn(),
    onZoomChange: fn(),
    onCropComplete: fn(),
    onApply: fn(),
    onCancel: fn(),
    isProcessing: false,
  },
} satisfies Meta<typeof ImageCropperView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    imageSrc: SAMPLE_IMAGE,
    crop: { x: 0, y: 0 },
    zoom: 1,
    aspect: 1,
    cropShape: "round",
    isProcessing: false,
  },
};

export const Processing: Story = {
  args: {
    imageSrc: SAMPLE_IMAGE,
    crop: { x: 0, y: 0 },
    zoom: 1,
    aspect: 1,
    cropShape: "round",
    isProcessing: true,
  },
};

export const RectangularCrop: Story = {
  args: {
    imageSrc: SAMPLE_IMAGE,
    crop: { x: 0, y: 0 },
    zoom: 1,
    aspect: 1,
    cropShape: "rect",
    isProcessing: false,
  },
};

export const ZoomedIn: Story = {
  args: {
    imageSrc: SAMPLE_IMAGE,
    crop: { x: 0, y: 0 },
    zoom: 2,
    aspect: 1,
    cropShape: "round",
    isProcessing: false,
  },
};

export const WideAspectRatio: Story = {
  args: {
    imageSrc: SAMPLE_IMAGE,
    crop: { x: 0, y: 0 },
    zoom: 1,
    aspect: 16 / 9,
    cropShape: "rect",
    isProcessing: false,
  },
};

export const MaxZoom: Story = {
  args: {
    imageSrc: SAMPLE_IMAGE,
    crop: { x: 0, y: 0 },
    zoom: 3,
    aspect: 1,
    cropShape: "round",
    isProcessing: false,
  },
};
