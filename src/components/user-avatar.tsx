import { useState } from 'react';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  /** User's display name (used for fallback initial) */
  name?: string;
  /** User's email (used for QQ avatar detection) */
  email?: string;
  /** Avatar size: sm = 24px, md = 32px, lg = 48px, xl = 80px */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes */
  className?: string;
}

const SIZE_MAP = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-20 h-20 text-2xl',
};

/**
 * Get QQ avatar URL from a QQ email address.
 * QQ emails are in the format: {number}@qq.com
 */
function getQQAvatarUrl(email: string): string | null {
  const match = email.match(/^(\d{5,12})@qq\.com$/i);
  if (!match) return null;
  return `https://q.qlogo.cn/g?b=qq&nk=${match[1]}&s=100`;
}

/**
 * Derive a display name from email if no name is provided.
 * e.g. "zhangsan@qq.com" -> "zhangsan"
 */
function getNameFromEmail(email: string): string {
  const local = email.split('@')[0];
  return local || '?';
}

export function UserAvatar({ name, email, size = 'md', className }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const displayName = name || (email ? getNameFromEmail(email) : '?');
  const initial = displayName.charAt(0).toUpperCase();
  const qqAvatarUrl = email ? getQQAvatarUrl(email) : null;
  const showImage = qqAvatarUrl && !imgError;

  return (
    <div
      className={cn(
        'rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0',
        SIZE_MAP[size],
        className,
      )}
    >
      {showImage ? (
        <img
          src={qqAvatarUrl}
          alt={displayName}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="font-medium text-primary leading-none">{initial}</span>
      )}
    </div>
  );
}

export { getQQAvatarUrl };
