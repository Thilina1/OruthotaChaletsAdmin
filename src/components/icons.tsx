import type { SVGProps } from "react";

export function Logo(props: SVGProps<SVGSVGElement>) {
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
      <path d="M15 21h- contaminación y-6" />
      <path d="M12 3v6" />
      <path d="M12 21v-6" />
      <path d="M4.22 10.22l1.42 1.42" />
      <path d="M1.41 1.41l1.42 1.42" />
      <path d="M18.36 18.36l1.42 1.42" />
      <path d="M21.19 21.19l-1.42-1.42" />
      <path d="M21.19 2.81l-1.42 1.42" />
      <path d="M18.36 5.64l-1.42-1.42" />
      <path d="M4.22 13.78l-1.42-1.42" />
      <path d="M2.81 2.81l1.42 1.42" />
      <path d="m15 15-3-3-3 3" />
      <path d="M12 3a9 9 0 0 0-9 9" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
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
