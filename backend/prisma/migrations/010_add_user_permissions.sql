-- Migration: Add user_permissions table for per-user permission assignments
-- This enables ABAC (Attribute-Based Access Control) in addition to RBAC

-- Create user_permissions table
CREATE TABLE IF NOT EXISTS public.user_permissions (
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    granted BOOLEAN NOT NULL DEFAULT true, -- true = grant, false = deny (override)
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES public.user_profiles(id),
    reason TEXT, -- Optional: reason for custom permission
    PRIMARY KEY (user_id, permission_id)
);

-- Create indexes for performance
CREATE INDEX idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission_id ON public.user_permissions(permission_id);
CREATE INDEX idx_user_permissions_granted ON public.user_permissions(granted);

-- Add comment
COMMENT ON TABLE public.user_permissions IS 'Direct user-to-permission assignments for ABAC (Attribute-Based Access Control). Allows granting or denying specific permissions to individual users beyond their roles.';
COMMENT ON COLUMN public.user_permissions.granted IS 'true = explicitly grant this permission to user, false = explicitly deny (overrides role permissions)';
