import Image from "next/image";

export function AriaAvatar({
  size = 40,
  online = false,
  className = "",
}: {
  size?: number;
  online?: boolean;
  className?: string;
}) {
  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      <Image
        src="/aria/avatar.svg"
        alt="Aria"
        width={size}
        height={size}
        className="rounded-full ring-1 ring-border"
        priority
      />
      {online && (
        <span
          className="absolute rounded-full border-2 border-bg bg-green-500"
          style={{
            width: Math.max(10, size * 0.28),
            height: Math.max(10, size * 0.28),
            bottom: -1,
            right: -1,
          }}
        />
      )}
    </span>
  );
}
