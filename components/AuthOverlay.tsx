/**
 * AuthOverlay Component
 *
 * Full-screen frosted-glass overlay with login/sign-up forms.
 * Features:
 * - Password visibility toggle (eye icon)
 * - Forgot password flow (email entry → reset email)
 * - Social auth buttons (Google, Apple, GitHub) — wired for Supabase
 * - Particle disintegration transition on successful auth
 */

import React, { useState, useRef, useCallback } from 'react';
import { useDisintegrate } from '../hooks/useDisintegrate';

interface AuthOverlayProps {
    onAuthenticate: () => void;
}

type AuthMode = 'login' | 'signup' | 'forgot';

interface FormErrors {
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
}

// ─── Eye Icon SVGs ───────────────────────────────────────────
const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const EyeOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
);

// ─── Password Input with Eye Toggle ──────────────────────────
const PasswordInput: React.FC<{
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    hasError?: boolean;
}> = ({ value, onChange, placeholder = '••••••••', hasError }) => {
    const [visible, setVisible] = useState(false);

    return (
        <div style={{ position: 'relative' }}>
            <input
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    ...inputStyle,
                    paddingRight: '44px',
                    borderColor: hasError ? '#ef4444' : '#e2e8f0',
                }}
            />
            <button
                type="button"
                onClick={() => setVisible(!visible)}
                style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.2s ease',
                }}
                title={visible ? 'Hide password' : 'Show password'}
                aria-label={visible ? 'Hide password' : 'Show password'}
            >
                {visible ? <EyeOffIcon /> : <EyeIcon />}
            </button>
        </div>
    );
};

// ─── Main Component ──────────────────────────────────────────
const AuthOverlay: React.FC<AuthOverlayProps> = ({ onAuthenticate }) => {
    const [mode, setMode] = useState<AuthMode>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState<FormErrors>({});
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotError, setForgotError] = useState('');
    const [forgotSuccess, setForgotSuccess] = useState(false);
    const [socialAuthError, setSocialAuthError] = useState('');

    const overlayRef = useRef<HTMLDivElement>(null);
    const { trigger: triggerDisintegrate } = useDisintegrate(overlayRef);

    const validate = useCallback((): FormErrors => {
        const errs: FormErrors = {};

        if (!email.trim()) errs.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email';

        if (!password.trim()) errs.password = 'Password is required';
        else if (password.length < 6) errs.password = 'Password must be at least 6 characters';

        if (mode === 'signup') {
            if (!name.trim()) errs.name = 'Name is required';
            if (!confirmPassword.trim()) errs.confirmPassword = 'Please confirm your password';
            else if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
        }

        return errs;
    }, [email, password, confirmPassword, name, mode]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const validationErrors = validate();
        setErrors(validationErrors);

        if (Object.keys(validationErrors).length > 0) return;
        if (isTransitioning) return;

        setIsTransitioning(true);

        // TODO: Replace with Supabase auth calls
        // if (mode === 'login') {
        //   const { error } = await supabase.auth.signInWithPassword({ email, password });
        // } else {
        //   const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
        // }

        await triggerDisintegrate();
        onAuthenticate();
    }, [validate, isTransitioning, triggerDisintegrate, onAuthenticate]);

    const handleSocialAuth = useCallback(async (provider: 'google' | 'apple' | 'github') => {
        setSocialAuthError('');

        // TODO: Replace with Supabase OAuth
        // const { error } = await supabase.auth.signInWithOAuth({
        //   provider,
        //   options: { redirectTo: window.location.origin }
        // });
        // if (error) { setSocialAuthError(error.message); return; }

        setSocialAuthError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} auth requires Supabase setup. See README for instructions.`);
    }, []);

    const handleForgotPassword = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setForgotError('');
        setForgotSuccess(false);

        if (!forgotEmail.trim()) {
            setForgotError('Please enter your email address');
            return;
        }
        if (!/\S+@\S+\.\S+/.test(forgotEmail)) {
            setForgotError('Please enter a valid email address');
            return;
        }

        // TODO: Replace with Supabase password reset
        // const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        //   redirectTo: `${window.location.origin}/reset-password`
        // });
        // if (error) { setForgotError(error.message); return; }

        setForgotSuccess(true);
    }, [forgotEmail]);

    const switchMode = (newMode: AuthMode) => {
        setMode(newMode);
        setErrors({});
        setSocialAuthError('');
        setForgotError('');
        setForgotSuccess(false);
    };

    // ─── Forgot Password Screen ─────────────────────────────
    if (mode === 'forgot') {
        return (
            <div
                ref={overlayRef}
                className="fixed inset-0 z-[9999] flex items-center justify-center"
                style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.45)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                }}
            >
                <div
                    className="relative w-full max-w-md mx-4"
                    style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.92)',
                        borderRadius: '24px',
                        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                        padding: '40px 36px 36px',
                    }}
                >
                    {/* Back button */}
                    <button
                        type="button"
                        onClick={() => switchMode('login')}
                        style={{
                            position: 'absolute',
                            top: '20px',
                            left: '20px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '13px',
                            fontWeight: 500,
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>

                    {/* Icon */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', marginTop: '8px' }}>
                        <div
                            style={{
                                background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                                padding: '14px',
                                borderRadius: '16px',
                                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                        </div>
                    </div>

                    <h2 style={{ textAlign: 'center', fontSize: '22px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
                        Reset Password
                    </h2>
                    <p style={{ textAlign: 'center', color: '#64748b', fontSize: '14px', marginBottom: '28px', lineHeight: '1.5' }}>
                        Enter your email and we'll send you a link to reset your password.
                    </p>

                    {forgotSuccess ? (
                        <div>
                            <div
                                style={{
                                    background: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    marginBottom: '20px',
                                    textAlign: 'center',
                                }}
                            >
                                <p style={{ color: '#15803d', fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                                    ✉️ Check your inbox!
                                </p>
                                <p style={{ color: '#22c55e', fontSize: '13px' }}>
                                    We've sent a password reset link to <strong>{forgotEmail}</strong>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => switchMode('login')}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    border: 'none',
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    color: '#fff',
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                                }}
                            >
                                Back to Sign In
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleForgotPassword} noValidate>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={labelStyle}>Email Address</label>
                                <input
                                    type="email"
                                    value={forgotEmail}
                                    onChange={(e) => { setForgotEmail(e.target.value); setForgotError(''); }}
                                    placeholder="you@example.com"
                                    style={{
                                        ...inputStyle,
                                        borderColor: forgotError ? '#ef4444' : '#e2e8f0',
                                    }}
                                />
                                {forgotError && <span style={errorStyle}>{forgotError}</span>}
                            </div>

                            <button
                                type="submit"
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    border: 'none',
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                                    color: '#fff',
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)',
                                }}
                            >
                                Send Reset Link
                            </button>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    // ─── Login / Sign-up Screen ─────────────────────────────
    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{
                backgroundColor: 'rgba(0, 0, 0, 0.45)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
            }}
        >
            {/* Auth card */}
            <div
                className="relative w-full max-w-md mx-4"
                style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.92)',
                    borderRadius: '24px',
                    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                    padding: '40px 36px 36px',
                }}
            >
                {/* Logo / Branding */}
                <div className="flex items-center justify-center gap-3 mb-2">
                    <div
                        style={{
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            padding: '10px',
                            borderRadius: '14px',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <h1
                        style={{
                            fontSize: '28px',
                            fontWeight: 900,
                            letterSpacing: '-0.02em',
                            background: 'linear-gradient(135deg, #1e293b, #6366f1)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        Maptivity
                    </h1>
                </div>

                <p
                    style={{
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: '14px',
                        marginBottom: '28px',
                    }}
                >
                    Discover what's worth doing, right on the map.
                </p>

                {/* Mode Tabs */}
                <div
                    style={{
                        display: 'flex',
                        background: '#f1f5f9',
                        borderRadius: '12px',
                        padding: '4px',
                        marginBottom: '24px',
                    }}
                >
                    {(['login', 'signup'] as AuthMode[]).map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => switchMode(m)}
                            style={{
                                flex: 1,
                                padding: '10px 0',
                                borderRadius: '10px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 600,
                                transition: 'all 0.2s ease',
                                background: mode === m ? '#fff' : 'transparent',
                                color: mode === m ? '#1e293b' : '#94a3b8',
                                boxShadow: mode === m ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                            }}
                        >
                            {m === 'login' ? 'Sign In' : 'Sign Up'}
                        </button>
                    ))}
                </div>

                {/* Social Auth Error */}
                {socialAuthError && (
                    <div
                        style={{
                            background: '#fef3c7',
                            border: '1px solid #fcd34d',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            marginBottom: '16px',
                            fontSize: '13px',
                            color: '#92400e',
                        }}
                    >
                        ⚠️ {socialAuthError}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} noValidate>
                    {mode === 'signup' && (
                        <div style={{ marginBottom: '16px' }}>
                            <label style={labelStyle}>Full Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: undefined })); }}
                                placeholder="John Doe"
                                style={{
                                    ...inputStyle,
                                    borderColor: errors.name ? '#ef4444' : '#e2e8f0',
                                }}
                            />
                            {errors.name && <span style={errorStyle}>{errors.name}</span>}
                        </div>
                    )}

                    <div style={{ marginBottom: '16px' }}>
                        <label style={labelStyle}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: undefined })); }}
                            placeholder="you@example.com"
                            style={{
                                ...inputStyle,
                                borderColor: errors.email ? '#ef4444' : '#e2e8f0',
                            }}
                        />
                        {errors.email && <span style={errorStyle}>{errors.email}</span>}
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={labelStyle}>Password</label>
                        <PasswordInput
                            value={password}
                            onChange={(val) => { setPassword(val); setErrors((prev) => ({ ...prev, password: undefined })); }}
                            hasError={!!errors.password}
                        />
                        {errors.password && <span style={errorStyle}>{errors.password}</span>}
                    </div>

                    {mode === 'signup' && (
                        <div style={{ marginBottom: '16px' }}>
                            <label style={labelStyle}>Confirm Password</label>
                            <PasswordInput
                                value={confirmPassword}
                                onChange={(val) => { setConfirmPassword(val); setErrors((prev) => ({ ...prev, confirmPassword: undefined })); }}
                                hasError={!!errors.confirmPassword}
                            />
                            {errors.confirmPassword && <span style={errorStyle}>{errors.confirmPassword}</span>}
                        </div>
                    )}

                    {mode === 'login' && (
                        <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                            <button
                                type="button"
                                onClick={() => switchMode('forgot')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#6366f1',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                }}
                            >
                                Forgot password?
                            </button>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isTransitioning}
                        style={{
                            width: '100%',
                            padding: '14px',
                            border: 'none',
                            borderRadius: '12px',
                            background: isTransitioning
                                ? '#a5b4fc'
                                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            color: '#fff',
                            fontSize: '15px',
                            fontWeight: 700,
                            cursor: isTransitioning ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: isTransitioning
                                ? 'none'
                                : '0 4px 14px rgba(99, 102, 241, 0.4)',
                            marginTop: mode === 'signup' ? '8px' : '0',
                        }}
                    >
                        {isTransitioning
                            ? 'Entering Maptivity...'
                            : mode === 'login'
                                ? 'Sign In'
                                : 'Create Account'}
                    </button>
                </form>

                {/* Divider */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        margin: '24px 0',
                        gap: '12px',
                    }}
                >
                    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                    <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>or continue with</span>
                    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                </div>

                {/* Social Buttons */}
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="button" onClick={() => handleSocialAuth('google')} style={socialButtonStyle} title="Continue with Google">
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                    </button>
                    <button type="button" onClick={() => handleSocialAuth('apple')} style={socialButtonStyle} title="Continue with Apple">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#000">
                            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                        </svg>
                    </button>
                    <button type="button" onClick={() => handleSocialAuth('github')} style={socialButtonStyle} title="Continue with GitHub">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#333">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Inline Styles ───────────────────────────────────────────
const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#475569',
    marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1.5px solid #e2e8f0',
    fontSize: '14px',
    color: '#1e293b',
    backgroundColor: '#f8fafc',
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    boxSizing: 'border-box',
};

const errorStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    color: '#ef4444',
    marginTop: '4px',
    fontWeight: 500,
};

const socialButtonStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
    borderRadius: '12px',
    border: '1.5px solid #e2e8f0',
    background: '#fff',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
};

export default AuthOverlay;
