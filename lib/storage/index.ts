export type { SupportedAvatarType } from "./s3";
export {
  AvatarKeys,
  createS3Client,
  deleteAvatar,
  getAvatar,
  getAvatarBucket,
  getAvatarUploadUrl,
  getAvatarUrl,
  getPublicBucket,
  isValidAvatarType,
  MAX_AVATAR_SIZE,
  SUPPORTED_AVATAR_TYPES,
  uploadAvatar,
} from "./s3";
