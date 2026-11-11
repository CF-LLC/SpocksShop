import { z } from "zod";

export const sellerSignupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  displayName: z.string().trim().min(2).max(60),
  password: z.string().min(10).max(200),
  acceptTerms: z.literal("yes"),
});

export const listingSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(4000).default(""),
  condition: z.string().trim().max(40).optional(),
  price: z.coerce.number().positive().max(100000),
  weight: z.coerce.number().gt(0, "Enter the item weight in pounds.").max(70, "Weight must be 70 lb or less."),
});
