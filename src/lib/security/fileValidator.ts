// Scale-up India — Phase 16: Centralized File Upload Security Validator
// Path: src/lib/security/fileValidator.ts

import path from "path";
import crypto from "crypto";
import { SECURITY_CONFIG } from "./config";
import { ValidationError } from "@/lib/errors";

export interface FileValidationResult {
  isValid: boolean;
  mimeType: string;
  sanitizedFilename: string;
  sha256Hash: string;
  error?: string;
}

/**
 * Inspects buffer magic bytes to determine the true content type,
 * defeating MIME spoofing and disguised executables.
 */
export function detectMagicBytes(buffer: Buffer): "PDF" | "PNG" | "JPEG" | "UNKNOWN" {
  if (buffer.length < 8) return "UNKNOWN";

  // Check PDF: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return "PDF";
  }

  // Check PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "PNG";
  }

  // Check JPEG SOI marker: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "JPEG";
  }

  return "UNKNOWN";
}

/**
 * Sanitizes an uploaded filename to prevent directory traversal and special character attacks
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return `file_${Date.now()}`;
  // Normalize Windows slashes to forward slashes and remove control characters
  const normalized = filename.replace(/\\/g, "/").replace(/[\0\x00-\x1f\x7f]/g, "");
  // Split into path segments
  const segments = normalized.split("/");
  // Filter out empty segments, current directory (.) and parent traversal (..)
  const safeSegments = segments
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "." && s !== "..");

  if (safeSegments.length === 0) {
    return `file_${Date.now()}`;
  }

  // Join segments with underscore to prevent directory hierarchy creation while preserving filename context
  const combined = safeSegments.join("_");
  // Replace all remaining non-whitelisted characters with underscore
  const clean = combined.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+|_+$/g, "");

  return clean.substring(0, 100) || `file_${Date.now()}`;
}

/**
 * Validates an uploaded file buffer against all enterprise security constraints
 */
export function validateUploadedFile(
  buffer: Buffer,
  originalFilename: string,
  declaredMimeType?: string
): FileValidationResult {
  // 1. File size check
  if (buffer.length > SECURITY_CONFIG.FILE_UPLOAD.MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      mimeType: "application/octet-stream",
      sanitizedFilename: sanitizeFilename(originalFilename),
      sha256Hash: "",
      error: `File size (${(buffer.length / 1024 / 1024).toFixed(1)}MB) exceeds maximum permitted limit of 15MB.`,
    };
  }

  if (buffer.length === 0) {
    return {
      isValid: false,
      mimeType: "application/octet-stream",
      sanitizedFilename: sanitizeFilename(originalFilename),
      sha256Hash: "",
      error: "Uploaded file is empty (0 bytes).",
    };
  }

  const cleanFilename = sanitizeFilename(originalFilename);
  const ext = path.extname(cleanFilename).toLowerCase();

  // 2. Reject executable and script extensions
  if ((SECURITY_CONFIG.FILE_UPLOAD.DISALLOWED_EXECUTABLE_EXTENSIONS as readonly string[]).includes(ext)) {
    return {
      isValid: false,
      mimeType: "application/octet-stream",
      sanitizedFilename: cleanFilename,
      sha256Hash: "",
      error: `Executable or script extension '${ext}' is strictly prohibited.`,
    };
  }

  // 3. Extension Whitelist
  if (!SECURITY_CONFIG.FILE_UPLOAD.ALLOWED_EXTENSIONS.includes(ext as any)) {
    return {
      isValid: false,
      mimeType: "application/octet-stream",
      sanitizedFilename: cleanFilename,
      sha256Hash: "",
      error: `Extension '${ext}' is not supported. Allowed formats: PDF, PNG, JPG.`,
    };
  }

  // 4. Magic-Byte Inspection (defeat MIME spoofing)
  const magic = detectMagicBytes(buffer);
  if (magic === "UNKNOWN") {
    return {
      isValid: false,
      mimeType: "application/octet-stream",
      sanitizedFilename: cleanFilename,
      sha256Hash: "",
      error: "File content does not match genuine PDF, PNG, or JPEG header signatures (MIME spoofing detected).",
    };
  }

  // 5. Cross-verify extension vs magic bytes
  let verifiedMime = "application/pdf";
  if (magic === "PDF") {
    if (ext !== ".pdf") {
      return {
        isValid: false,
        mimeType: "application/octet-stream",
        sanitizedFilename: cleanFilename,
        sha256Hash: "",
        error: "Mismatched file extension for PDF binary.",
      };
    }
    verifiedMime = "application/pdf";
  } else if (magic === "PNG") {
    if (ext !== ".png") {
      return {
        isValid: false,
        mimeType: "application/octet-stream",
        sanitizedFilename: cleanFilename,
        sha256Hash: "",
        error: "Mismatched file extension for PNG binary.",
      };
    }
    verifiedMime = "image/png";
  } else if (magic === "JPEG") {
    if (ext !== ".jpg" && ext !== ".jpeg") {
      return {
        isValid: false,
        mimeType: "application/octet-stream",
        sanitizedFilename: cleanFilename,
        sha256Hash: "",
        error: "Mismatched file extension for JPEG binary.",
      };
    }
    verifiedMime = "image/jpeg";
  }

  // 6. Compute Cryptographic Checksum
  const sha256Hash = crypto.createHash("sha256").update(buffer).digest("hex");

  return {
    isValid: true,
    mimeType: verifiedMime,
    sanitizedFilename: cleanFilename,
    sha256Hash,
  };
}

/**
 * Asserts that an uploaded file is secure and valid.
 * Throws ValidationError if the file violates security constraints.
 */
export function assertUploadedFile(
  buffer: Buffer,
  originalFilename: string,
  declaredMimeType?: string
): FileValidationResult {
  const result = validateUploadedFile(buffer, originalFilename, declaredMimeType);
  if (!result.isValid) {
    throw new ValidationError(result.error || "File upload security verification failed.");
  }
  return result;
}
