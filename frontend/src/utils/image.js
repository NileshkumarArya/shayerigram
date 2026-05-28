export function optimizeImageUrl(url, options = {}) {
  if (!url || typeof url !== 'string') return url;

  const isCloudinary = url.includes('res.cloudinary.com') && url.includes('/upload/');
  if (!isCloudinary) return url;

  const {
    width = 900,
    height,
    crop = 'limit',
    quality = 'auto',
    format = 'auto',
    dpr = 'auto',
  } = options;

  const transforms = [
    `f_${format}`,
    `q_${quality}`,
    `c_${crop}`,
    width ? `w_${width}` : null,
    height ? `h_${height}` : null,
    dpr ? `dpr_${dpr}` : null,
  ].filter(Boolean).join(',');

  return url.replace('/upload/', `/upload/${transforms}/`);
}

export function optimizeAvatarUrl(url, size = 'md') {
  const widths = {
    xs: 56,
    sm: 72,
    md: 96,
    lg: 128,
    xl: 192,
    '2xl': 256,
  };

  const width = widths[size] || widths.md;

  return optimizeImageUrl(url, {
    width,
    height: width,
    crop: 'fill',
    quality: 'auto',
    format: 'auto',
  });
}