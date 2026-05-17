import Image from "next/image";
import Link from "next/link";

type LogoMarkProps = {
  size?: number;
  alt?: string;
};

export function LogoMark({ size = 30, alt = "" }: LogoMarkProps) {
  return (
    <Image
      src="/assets/logo.svg"
      alt={alt}
      width={size}
      height={size}
      priority
      style={{ width: size, height: size }}
    />
  );
}

export function QuatBullet({ size = 12 }: { size?: number }) {
  return (
    <Image
      src="/assets/logo.svg"
      alt=""
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

type BrandLockupProps = {
  href?: string;
  size?: number;
  fontSize?: number;
  showPro?: boolean;
};

export function BrandLockup({
  href = "/",
  size = 28,
  fontSize = 18,
  showPro = true,
}: BrandLockupProps) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 9,
        color: "inherit",
      }}
    >
      <LogoMark size={size} />
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 500,
          fontSize,
          color: "var(--ink-900)",
          letterSpacing: "-0.01em",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        Seller&nbsp;Lab
      </span>
      {showPro && (
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 700,
            fontSize: 9.5,
            letterSpacing: "0.16em",
            color: "var(--saffron-700)",
            background: "var(--saffron-100)",
            padding: "3px 5px",
            borderRadius: 3,
            lineHeight: 1,
          }}
        >
          PRO
        </span>
      )}
    </Link>
  );
}
