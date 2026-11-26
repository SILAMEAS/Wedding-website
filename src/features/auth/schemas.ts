import { z } from "zod";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth/password-policy";

export const loginSchema = z.object({
  username: z.string().trim().min(1, { message: "required" }).max(64, { message: "tooLong" }),
  password: z.string().min(1, { message: "required" }).max(PASSWORD_MAX, { message: "tooLong" }),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const newPassword = z
  .string()
  .min(PASSWORD_MIN, { message: "passwordTooShort" })
  .max(PASSWORD_MAX, { message: "tooLong" });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "required" }).max(PASSWORD_MAX),
    newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "passwordMismatch" });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
