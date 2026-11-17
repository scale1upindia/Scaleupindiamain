// Scale-up India — Phase 16: Centralized Enterprise Security Configuration
// Path: src/lib/security/config.ts

export const SECURITY_CONFIG = {
  // Authentication & Passwords
  AUTH: {
    MIN_PASSWORD_LENGTH: 8,
    MAX_PASSWORD_LENGTH: 128,
    MAX_FAILED_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION_MINUTES: 30,
    SESSION_EXPIRY_DAYS: 7,
    PASSWORD_RESET_EXPIRY_HOURS: 1,
    EMAIL_VERIFICATION_EXPIRY_HOURS: 24,
    BCRYPT_ROUNDS: 12,
  },

  // Cookies & Session Handling
  COOKIES: {
    SESSION_NAME: "__scaleup_session",
    MAX_AGE_SECONDS: 7 * 24 * 60 * 60, // 7 days
    SAME_SITE: "lax" as const,
    PATH: "/",
  },

  // Document Vault & File Upload Security
  FILE_UPLOAD: {
    MAX_FILE_SIZE_BYTES: 15 * 1024 * 1024, // 15MB
    ALLOWED_EXTENSIONS: [".pdf", ".png", ".jpg", ".jpeg"] as const,
    ALLOWED_MIME_TYPES: [
      "application/pdf",
      "image/png",
      "image/jpeg",
    ] as const,
    MAGIC_BYTES: {
      PDF: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
      PNG: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // .PNG\r\n\x1a\n
      JPEG: [0xff, 0xd8, 0xff], // SOI
    },
    DISALLOWED_EXECUTABLE_EXTENSIONS: [
      ".exe", ".sh", ".bat", ".cmd", ".php", ".phtml",
      ".js", ".ts", ".html", ".htm", ".svg", ".jar",
      ".py", ".jsp", ".asp", ".aspx", ".cgi", ".vbs",
    ],
  },

  // Cryptographic Signed Download Tokens
  SIGNED_TOKENS: {
    TOKEN_TTL_SECONDS: 300, // 5 minutes
    ALGORITHM: "sha256",
  },

  // Webhook Security
  WEBHOOKS: {
    TIMESTAMP_TOLERANCE_SECONDS: 300, // 5 minutes
    SIGNATURE_ALGORITHM: "sha256",
  },

  // Rate Limiting (Sliding Window in ms and request caps)
  RATE_LIMITS: {
    AUTH_BURST: { WINDOW_MS: 60 * 1000, MAX_REQUESTS: 5 }, // 5 / min
    PASSWORD_RESET: { WINDOW_MS: 60 * 1000, MAX_REQUESTS: 3 }, // 3 / min
    MUTATION: { WINDOW_MS: 60 * 1000, MAX_REQUESTS: 60 }, // 60 / min
    QUERY: { WINDOW_MS: 60 * 1000, MAX_REQUESTS: 120 }, // 120 / min
    FILE_UPLOAD: { WINDOW_MS: 60 * 1000, MAX_REQUESTS: 10 }, // 10 / min
  },

  // SSRF Protection: Denied Hosts & Subnets
  SSRF: {
    BLOCKED_HOSTNAMES: [
      "localhost",
      "127.0.0.1",
      "::1",
      "[::1]",
      "0.0.0.0",
      "metadata.google.internal",
      "169.254.169.254", // AWS/GCP/Azure link-local metadata
    ],
    BLOCKED_PREFIXES: [
      "10.", // Class A private
      "172.16.", "172.17.", "172.18.", "172.19.", // Class B private
      "172.20.", "172.21.", "172.22.", "172.23.",
      "172.24.", "172.25.", "172.26.", "172.27.",
      "172.28.", "172.29.", "172.30.", "172.31.",
      "192.168.", // Class C private
      "169.254.", // Link-local
      "127.", // Loopback
      "0.", // Current network
    ],
    ALLOWED_PROTOCOLS: ["http:", "https:"],
  },

  // Security Headers (CSP, HSTS, Frame Protection)
  HEADERS: {
    CONTENT_SECURITY_POLICY: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
    HSTS: "max-age=31536000; includeSubDomains; preload",
    FRAME_OPTIONS: "DENY",
    CONTENT_TYPE_OPTIONS: "nosniff",
    REFERRER_POLICY: "strict-origin-when-cross-origin",
    PERMISSIONS_POLICY: "camera=(), microphone=(), geolocation=(), payment=()",
  },
} as const;
