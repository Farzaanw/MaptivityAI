import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getSession, signOut, onAuthStateChange } from '../services/authService';
import type { User } from '@supabase/supabase-js';

export type AppPage = 'map' | 'planner' | 'favorites';

// ─── Default avatar options ───────────────────────────────────────────────────
const DEFAULT_AVATARS = [
  { id: 'a', color: '#6366f1', initials: true },   // indigo
  { id: 'b', color: '#8b5cf6', initials: true },   // violet
  { id: 'c', color: '#0ea5e9', initials: true },   // sky
  { id: 'd', color: '#10b981', initials: true },   // emerald
  { id: 'e', color: '#f59e0b', initials: true },   // amber
  { id: 'f', color: '#ef4444', initials: true },   // red
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Profile Sidebar ─────────────────────────────────────────────────────────
interface ProfileSidebarProps {
  user: User;
  onClose: () => void;
}

const ProfileSidebar: React.FC<ProfileSidebarProps> = ({ user, onClose }) => {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string>('a');
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fullName: string = user.user_metadata?.full_name || 'No name set';
  const username: string = user.email || '';
  const initials = getInitials(fullName);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setUploadedPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const currentAvatarColor = DEFAULT_AVATARS.find((a) => a.id === selectedAvatar)?.color ?? '#6366f1';

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          background: 'transparent',
        }}
      />

      {/* Sidebar panel */}
      <div
        ref={sidebarRef}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: '300px',
          background: '#fff',
          borderLeft: '1px solid #e2e8f0',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          animation: 'slideInRight 0.22s ease-out',
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px 16px',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>Profile</span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '6px',
            }}
            aria-label="Close profile"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 24px', flex: 1, overflowY: 'auto' }}>

          {/* Avatar display */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' }}>
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              {uploadedPhoto ? (
                <img
                  src={uploadedPhoto}
                  alt="Profile"
                  style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #e2e8f0' }}
                />
              ) : (
                <div
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: currentAvatarColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '26px',
                    fontWeight: 700,
                    color: '#fff',
                    letterSpacing: '-0.5px',
                    border: '3px solid #e2e8f0',
                  }}
                >
                  {initials}
                </div>
              )}
            </div>

            {/* Name & username */}
            <p style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: '0 0 2px', textAlign: 'center' }}>
              {fullName}
            </p>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, textAlign: 'center' }}>
              {username}
            </p>
          </div>

          {/* Avatar picker section */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Choose avatar
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {DEFAULT_AVATARS.map((av) => (
                <button
                  key={av.id}
                  onClick={() => { setSelectedAvatar(av.id); setUploadedPhoto(null); }}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: av.color,
                    border: selectedAvatar === av.id && !uploadedPhoto
                      ? '3px solid #1e293b'
                      : '3px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#fff',
                    transition: 'border 0.15s ease',
                    flexShrink: 0,
                  }}
                  title={`Avatar ${av.id}`}
                >
                  {initials.slice(0, 1)}
                </button>
              ))}

              {/* Upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: uploadedPhoto ? '#f1f5f9' : '#f8fafc',
                  border: uploadedPhoto ? '3px solid #1e293b' : '3px dashed #cbd5e1',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  flexShrink: 0,
                  transition: 'border 0.15s ease',
                }}
                title="Upload photo"
              >
                {uploadedPhoto ? (
                  <img src={uploadedPhoto} alt="" style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #f1f5f9', margin: '8px 0 20px' }} />

          {/* Sign out */}
          <button
            onClick={async () => { await signOut(); window.location.reload(); }}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '10px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            Sign out
          </button>
        </div>

        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>
      </div>
    </>
  );
};

// ─── Header ───────────────────────────────────────────────────────────────────
interface HeaderProps {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
}

const Header: React.FC<HeaderProps> = ({ activePage, onNavigate }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    getSession().then((session) => setUser(session?.user ?? null));

    const { data: { subscription } } = onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) setIsProfileOpen(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const toggleProfile = useCallback(() => setIsProfileOpen((prev) => !prev), []);

  return (
    <>
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200 h-16 flex items-center px-6 z-50 shadow-sm shrink-0">
        {/* Brand */}
        <button
          onClick={() => onNavigate('map')}
          className="flex items-center gap-2 group cursor-pointer focus:outline-none"
          aria-label="Navigate to map"
        >
          <div className="bg-indigo-600 p-2 rounded-lg group-hover:bg-indigo-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-gray-800 group-hover:text-indigo-600 transition-colors">Maptivity</h1>
        </button>


        {/* Nav */}
        <nav className="ml-auto flex items-center gap-4">
          {/* Nav tabs — Map | Planner | Favorites */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {([
              { id: 'map', label: 'Map' },
              { id: 'planner', label: 'Planner' },
              { id: 'favorites', label: 'Favorites' },
            ] as { id: AppPage; label: string }[]).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: activePage === id ? 700 : 500,
                  color: activePage === id ? '#6366f1' : '#64748b',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  borderBottom: activePage === id ? '2px solid #6366f1' : '2px solid transparent',
                  transition: 'color 0.15s ease, border-color 0.15s ease',
                  lineHeight: 1,
                }}
              >
                {label}
              </button>
            ))}
          </nav>

          {user ? (
            <button
              onClick={toggleProfile}
              className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${isProfileOpen ? 'bg-indigo-200 text-indigo-800' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
              aria-label="Open profile"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => window.location.reload()}
              className="bg-gray-100 px-4 py-2 rounded-full text-sm font-semibold text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition-colors"
            >
              Sign In
            </button>
          )}
        </nav>
      </header>

      {/* Profile sidebar */}
      {isProfileOpen && user && (
        <ProfileSidebar
          user={user}
          onClose={() => setIsProfileOpen(false)}
        />
      )}
    </>
  );
};

export default Header;
