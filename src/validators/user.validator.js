import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    phone: z.string().optional(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    roleId: z.coerce.number().int().positive('Role is required'),
    tenantId: z.coerce.number().int().positive('Tenant ID is required').optional(),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    phone: z.string().nullable().optional(),
    roleId: z.coerce.number().int().positive('Role is required').optional(),
    status: z.string().optional(),
    avatar: z.string().optional(),
    plan: z.string().optional(),
    is_upgraded: z.boolean().optional(),
    concierge_member: z.boolean().optional(),
    concierge_membership_since: z.string().nullable().optional(),
  }),
});
