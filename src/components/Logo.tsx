/**
 * 보안관 배지 마크. app/icon.svg(파비콘)와 같은 도형이라 탭 아이콘과 화면 로고가 붙어 보인다.
 * 도형을 고칠 일이 생기면 두 파일을 같이 고쳐야 한다.
 */
export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label="SKALA BANG!">
      <g fill="currentColor">
        <path d="M16 3 19.29 11.47 28.36 11.98 21.33 17.73 23.64 26.52 16 21.6 8.36 26.52 10.67 17.73 3.64 11.98 12.71 11.47Z" />
        <circle cx="16" cy="3" r="1.7" />
        <circle cx="28.36" cy="11.98" r="1.7" />
        <circle cx="23.64" cy="26.52" r="1.7" />
        <circle cx="8.36" cy="26.52" r="1.7" />
        <circle cx="3.64" cy="11.98" r="1.7" />
      </g>
      <circle cx="16" cy="16.2" r="3.1" fill="var(--background)" />
      <circle cx="16" cy="16.2" r="1.3" fill="currentColor" opacity="0.55" />
    </svg>
  );
}
