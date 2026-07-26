import * as z from "zod";
import { clothingCategories } from "@/lib/types";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

export const wardrobeFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Gardırop adı zorunludur.")
    .max(80, "Gardırop adı en fazla 80 karakter olabilir."),
  description: optionalText,
});

export const clothingItemFormSchema = z.object({
  wardrobeId: z.string().trim().min(1, "Bulunduğu gardırop seçilmelidir."),
  name: z
    .string()
    .trim()
    .min(1, "Kıyafet adı zorunludur.")
    .max(100, "Kıyafet adı en fazla 100 karakter olabilir."),
  category: z.enum(clothingCategories, {
    error: "Ana kategori seçilmelidir.",
  }),
  type: z
    .string()
    .trim()
    .min(1, "Tür alanı zorunludur.")
    .max(80, "Tür en fazla 80 karakter olabilir."),
  primaryColor: z
    .string()
    .trim()
    .min(1, "Ana renk zorunludur.")
    .max(60, "Ana renk en fazla 60 karakter olabilir."),
  brand: optionalText,
  notes: optionalText,
});

export type FieldErrors = Partial<Record<string, string>>;

export function zodIssuesToFieldErrors(error: z.ZodError): FieldErrors {
  return error.issues.reduce<FieldErrors>((errors, issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && errors[field] === undefined) {
      errors[field] = issue.message;
    }
    return errors;
  }, {});
}
