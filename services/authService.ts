/**
 * Supabase Auth Service
 *
 * Wraps Supabase auth methods for use throughout the app.
 * Handles sign-up, sign-in, OAuth, password reset, sign-out, and session management.
 */

import { supabase } from './supabaseClient';
import type { Provider, AuthError, User, Session } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────
export interface AuthResult {
    success: boolean;
    error?: string;
    user?: User;
}

// ─── Email/Password Auth ─────────────────────────────────────

/** Sign up with email and password. Name is stored in user metadata. */
export async function signUpWithEmail(
    email: string,
    password: string,
    fullName: string
): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: fullName },
        },
    });

    if (error) return { success: false, error: error.message };
    return { success: true, user: data.user ?? undefined };
}

/** Sign in with email and password. */
export async function signInWithEmail(
    email: string,
    password: string
): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, user: data.user ?? undefined };
}

// ─── OAuth (Social Auth) ─────────────────────────────────────

/** Sign in with a social provider (google, apple, github). */
export async function signInWithOAuth(provider: Provider): Promise<AuthResult> {
    const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: window.location.origin,
        },
    });

    if (error) return { success: false, error: error.message };
    // OAuth redirects — the user won't see a return value here.
    // The session will be available after redirect via onAuthStateChange.
    return { success: true };
}

// ─── Password Reset ──────────────────────────────────────────

/** Send a password reset email to the user. */
export async function resetPassword(email: string): Promise<AuthResult> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}`,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
}

/** Update the currently authenticated user's password (used after PASSWORD_RECOVERY). */
export async function updatePassword(newPassword: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    return { success: true, user: data.user ?? undefined };
}

// ─── Session Management ──────────────────────────────────────

/** Get the current session (null if not logged in). */
export async function getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
}

/** Get the current user (null if not logged in). */
export async function getUser(): Promise<User | null> {
    const { data } = await supabase.auth.getUser();
    return data.user;
}

/** Sign out the current user. */
export async function signOut(): Promise<{ error: AuthError | null }> {
    return await supabase.auth.signOut();
}

/** Subscribe to auth state changes (login, logout, token refresh). */
export function onAuthStateChange(
    callback: (event: string, session: Session | null) => void
) {
    return supabase.auth.onAuthStateChange(callback);
}
