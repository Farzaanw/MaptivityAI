/**
 * ResetPasswordOverlay
 *
 * Shown when Supabase fires a PASSWORD_RECOVERY auth event (user clicked
 * the reset link from their email). Lets the user set a new password,
 * then redirects them back to the login screen.
 */

import React, { useState, useCallback } from 'react';
import { updatePassword } from '../services/authService';

interface ResetPasswordOverlayProps {
    /** Called when the password is successfully updated — hides this overlay. */
    onDone: () => void;
}

// Eye icons
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

const PasswordInput: React.FC<{
    value: string;
    onChange: (v: string) => void;
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
                    width: '100%',
                    padding: '12px 44px 12px 14px',
                    borderRadius: '10px',
                    border: `1.5px solid ${hasError ? '#ef4444' : '#e2e8f0'}`,
                    fontSize: '14px',
                    color: '#1e293b',
                    backgroundColor: '#f8fafc',
                    outline: 'none',
                    boxSizing: 'border-box',
                }}
            />
            <button
                type="button"
                onClick={() => setVisible(!visible)}
                style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', cursor: 'pointer', color: '#94a3b8',
                    padding: '2px', display: 'flex', alignItems: 'center',
                }}
                aria-label={visible ? 'Hide password' : 'Show password'}
            >
                {visible ? <EyeOffIcon /> : <EyeIcon />}
            </button>
        </div>
    );
};

const ResetPasswordOverlay: React.FC<ResetPasswordOverlayProps> = ({ onDone }) => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        if (password !== confirm) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        const result = await updatePassword(password);
        setLoading(false);

        if (!result.success) {
            setError(result.error || 'Failed to update password. Please try again.');
            return;
        }

        setSuccess(true);
        // Return to login after a short moment so user sees the success message
        setTimeout(() => onDone(), 2000);
    }, [password, confirm, onDone]);

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                backgroundColor: 'rgba(0,0,0,0.45)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: '420px',
                    margin: '0 16px',
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    borderRadius: '24px',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
                    padding: '40px 36px 36px',
                }}
            >
                {/* Icon */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                    <div
                        style={{
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            padding: '14px',
                            borderRadius: '16px',
                            boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                    </div>
                </div>

                <h2 style={{ textAlign: 'center', fontSize: '22px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
                    Set New Password
                </h2>
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: '14px', marginBottom: '28px', lineHeight: 1.5 }}>
                    Choose a new password for your Maptivity account.
                </p>

                {success ? (
                    <div
                        style={{
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: '12px',
                            padding: '16px',
                            textAlign: 'center',
                        }}
                    >
                        <p style={{ color: '#15803d', fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>
                            ✅ Password updated!
                        </p>
                        <p style={{ color: '#22c55e', fontSize: '13px' }}>
                            Taking you into Maptivity…
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} noValidate>
                        {/* New password */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                                New Password
                            </label>
                            <PasswordInput
                                value={password}
                                onChange={setPassword}
                                hasError={!!error && error.includes('character')}
                            />
                        </div>

                        {/* Confirm password */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                                Confirm Password
                            </label>
                            <PasswordInput
                                value={confirm}
                                onChange={setConfirm}
                                placeholder="••••••••"
                                hasError={!!error && error.includes('match')}
                            />
                        </div>

                        {/* Error */}
                        {error && (
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
                                ⚠️ {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '14px',
                                border: 'none',
                                borderRadius: '12px',
                                background: loading
                                    ? '#a5b4fc'
                                    : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: '#fff',
                                fontSize: '15px',
                                fontWeight: 700,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                boxShadow: loading ? 'none' : '0 4px 14px rgba(99,102,241,0.4)',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {loading ? 'Updating…' : 'Update Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ResetPasswordOverlay;
