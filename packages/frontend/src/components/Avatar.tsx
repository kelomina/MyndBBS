'use client'

type AvatarProps = {
  src?: string | null
  username: string
  size?: 20 | 24 | 32 | 36 | 40 | 72 | 128
  className?: string
}

const avatarSizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  20: 'h-5 w-5 min-w-5 max-w-5 text-xs',
  24: 'h-6 w-6 min-w-6 max-w-6 text-xs',
  32: 'h-8 w-8 min-w-8 max-w-8 text-sm',
  36: 'h-9 w-9 min-w-9 max-w-9 text-sm',
  40: 'h-10 w-10 min-w-10 max-w-10 text-base',
  72: 'h-[72px] w-[72px] min-w-[72px] max-w-[72px] text-3xl',
  128: 'h-32 w-32 min-w-32 max-w-32 text-5xl',
}

export function Avatar({ src, username, size = 40, className = '' }: AvatarProps) {
  const sizeClass = avatarSizeClasses[size] || avatarSizeClasses[40]

  if (src) {
    return (
      <div className={`rounded-full overflow-hidden shrink-0 ${sizeClass} ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={username}
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  const initial = username.length > 0 ? username.charAt(0).toUpperCase() : 'U'
  return (
    <div
      className={`rounded-full bg-primary text-primary-foreground flex items-center justify-center uppercase font-bold shrink-0 ${sizeClass} ${className}`}
    >
      {initial}
    </div>
  )
}
