/**
 * Toast Component
 * 
 * A reusable notification component that provides brief visual feedback 
 * to the user (e.g., "Saved to Favorites"). Slides up from the bottom 
 * and automatically dismisses itself.
 */
import React, { useEffect } from 'react';

interface ToastProps {
    message: string;
    isVisible: boolean;
    onClose: () => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, isVisible, onClose, duration = 3000 }) => {
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isVisible, duration, onClose]);

    return (
        <div
            className={`fixed bottom-1 left-1/2 -translate-x-1/2 z-[10000] px-4 py-1 bg-gray-900/90 backdrop-blur-md text-white font-semibold rounded-full shadow-2xl transition-all duration-300 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'
                }`}
        >
            <div className="flex items-center gap-2">
                {message.includes('Saved') ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.657 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.657 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                    </svg>
                )}
                <span>{message}</span>
            </div>
        </div>
    );
};

export default Toast;
