import { z } from "zod";

export const ExternalRoleEnum = z.enum(["PROMOTER", "BUYER", "INVESTOR", "PARTNER"]);

export const RegisterSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Please provide a valid corporate or personal email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    firstName: z
      .string()
      .trim()
      .min(2, "First name must be at least 2 characters")
      .max(100),
    lastName: z
      .string()
      .trim()
      .min(1, "Last name must be at least 1 character")
      .max(100),
    phone: z
      .string()
      .trim()
      .regex(/^(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}$/, "Please provide a valid Indian mobile number (+91)")
      .optional()
      .or(z.literal("")),
    roles: z
      .array(ExternalRoleEnum)
      .min(1, "Please select at least one role (Promoter, Buyer, Investor, or Partner)"),
  })
  .strict();

export const LoginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Please provide a valid email address"),
    password: z.string().min(1, "Password is required"),
  })
  .strict();

export const ForgotPasswordSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Please provide a valid registered email address"),
  })
  .strict();

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  })
  .strict();

export const VerifyEmailSchema = z
  .object({
    token: z.string().min(1, "Verification token is required"),
  })
  .strict();

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;

