export default function Logo() {
  return (
    <span className="brand">
      <svg
        className="brand-logo"
        viewBox="0 0 32 32"
        width="32"
        height="32"
        aria-hidden="true"
      >
        <path d="M16 30 2 6a20 20 0 0 1 28 0z" fill="#f2b84b" />~
        <path
          d="M2 6a20 20 0 0 1 28 0l-1.4 2.4a17 17 0 0 0-25.2 0z"
          fill="#fff"
        />
        <circle cx="13" cy="12" r="2" fill="#9b1c25" />
        <circle cx="19" cy="14" r="2" fill="#9b1c25" />
        <circle cx="16" cy="20" r="2" fill="#9b1c25" />
      </svg>
      <span className="brand-name">LaPrizza</span>
    </span>
  );
}
