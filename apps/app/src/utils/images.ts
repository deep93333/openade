import type { ImageAttachment } from "@agentide/shared";

// Supported image formats as per Claude Code documentation
const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp"
];

const MAX_FILE_SIZE = 32 * 1024 * 1024; // 32MB total limit
const MAX_SINGLE_FILE_SIZE = 30 * 1024 * 1024; // 30MB per image
const MAX_IMAGES_PER_REQUEST = 100;

export const isImageFile = (file: File): boolean => {
  return SUPPORTED_IMAGE_TYPES.includes(file.type.toLowerCase());
};

export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  if (!isImageFile(file)) {
    return {
      valid: false,
      error: `Unsupported image format. Supported formats: ${SUPPORTED_IMAGE_TYPES.join(', ')}`
    };
  }

  if (file.size > MAX_SINGLE_FILE_SIZE) {
    return {
      valid: false,
      error: `Image file size must be less than 30MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    };
  }

  return { valid: true };
};

export const validateImageAttachments = (attachments: ImageAttachment[]): { valid: boolean; error?: string } => {
  if (attachments.length > MAX_IMAGES_PER_REQUEST) {
    return {
      valid: false,
      error: `Too many images. Maximum ${MAX_IMAGES_PER_REQUEST} images per message.`
    };
  }

  const totalSize = attachments.reduce((sum, attachment) => sum + attachment.size, 0);
  if (totalSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Total image size must be less than 32MB. Current total: ${(totalSize / 1024 / 1024).toFixed(2)}MB`
    };
  }

  return { valid: true };
};

export const fileToImageAttachment = (file: File): Promise<ImageAttachment> => {
  return new Promise((resolve, reject) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      reject(new Error(validation.error));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        reject(new Error('Failed to read image file'));
        return;
      }

      const attachment: ImageAttachment = {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl,
        file
      };

      resolve(attachment);
    };

    reader.onerror = () => {
      reject(new Error('Failed to read image file'));
    };

    reader.readAsDataURL(file);
  });
};

export const filesToImageAttachments = async (files: FileList | File[]): Promise<ImageAttachment[]> => {
  const fileArray = Array.from(files);
  const imageFiles = fileArray.filter(isImageFile);

  if (imageFiles.length === 0) {
    throw new Error('No valid image files found');
  }

  const attachmentPromises = imageFiles.map(fileToImageAttachment);
  const attachments = await Promise.all(attachmentPromises);

  const validation = validateImageAttachments(attachments);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return attachments;
};

export const createImagePreviewUrl = (attachment: ImageAttachment): string => {
  return attachment.dataUrl;
};