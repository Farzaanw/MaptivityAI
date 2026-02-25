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
import { signInWithEmail, signUpWithEmail, resetPassword } from '../services/authService';

interface AuthOverlayProps {
    onAuthenticate: () => void;
    onGuestLogin: () => void;
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
const AuthOverlay: React.FC<AuthOverlayProps> = ({ onAuthenticate, onGuestLogin }) => {
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
    const [authError, setAuthError] = useState('');

    const overlayRef = useRef<HTMLDivElement>(null);
    // No disintegrate — transition owned by App.tsx

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
        setAuthError('');

        if (Object.keys(validationErrors).length > 0) return;
        if (isTransitioning) return;

        setIsTransitioning(true);

        let result;
        if (mode === 'login') {
            result = await signInWithEmail(email, password);
        } else {
            result = await signUpWithEmail(email, password, name);
        }

        if (!result.success) {
            setAuthError(result.error || 'Authentication failed. Please try again.');
            setIsTransitioning(false);
            return;
        }

        onAuthenticate();
    }, [validate, isTransitioning, onAuthenticate, mode, email, password, name]);

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

        const result = await resetPassword(forgotEmail);
        if (!result.success) {
            setForgotError(result.error || 'Failed to send reset email.');
            return;
        }

        setForgotSuccess(true);
    }, [forgotEmail]);

    const switchMode = (newMode: AuthMode) => {
        setMode(newMode);
        setErrors({});
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

                {/* General Auth Error (Email/Password) */}
                {authError && (
                    <div
                        style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            marginBottom: '16px',
                            fontSize: '13px',
                            color: '#b91c1c',
                        }}
                    >
                        ⚠️ {authError}
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

                <div style={{ margin: '24px 0' }} />



                {/* Guest Mode */}
                <div style={{ textAlign: 'center' }}>
                    <button
                        type="button"
                        onClick={async () => {
                            setIsTransitioning(true);
                            onGuestLogin();
                        }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#64748b',
                            fontSize: '14px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            textUnderlineOffset: '4px',
                        }}
                    >
                        Continue as Guest
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



export default AuthOverlay;
