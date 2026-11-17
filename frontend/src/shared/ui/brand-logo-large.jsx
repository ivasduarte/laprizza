import logoWebp from '../assets/laprizza-logo-grande.webp';
import logoPng from '../assets/laprizza-logo-grande.png';

/** Full LaPrizza logo (slice + lettering). WebP with a PNG fallback. */
export default function BrandLogoLarge({ className, alt = '' }) {
  return (
    <picture>
      <source srcSet={logoWebp} type="image/webp" />
      <img
        className={className}
        src={logoPng}
        width="960"
        height="665"
        alt={alt}
        decoding="async"
      />
    </picture>
  );
}
