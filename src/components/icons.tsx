import type { SVGProps } from "react";
import Image from "next/image";

export function Logo({ className, ...props }: { className?: string } & any) {
  return (
    <div className={className} {...props}>
      <Image
        src="/images/logo_white.png"
        alt="Oruthota Chalets Logo"
        width={450}
        height={450}
        className="h-full w-full object-contain"
        priority
      />
    </div>
  );
}


export function TableIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 3v18" />
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 12h18" />
    </svg>
  );
}
