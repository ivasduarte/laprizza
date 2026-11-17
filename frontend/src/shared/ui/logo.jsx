/** Brand mark of the header: the "L" pizza slice icon (public/icon-*.png) + the name. */
export default function Logo() {
  return (
    <span className="brand">
      <img
        className="brand-logo"
        src="/icon-192.png"
        srcSet="/icon-192.png 192w, /icon-512.png 512w"
        sizes="3rem"
        width="48"
        height="48"
        alt=""
        decoding="async"
      />
      <span className="brand-name">LaPrizza</span>
    </span>
  );
}
