/**
 * Device detection utilities for mobile/touch support
 */

/** Check if device is a mobile phone (not just a small window) */
export function isSmallScreen(): boolean {
  // Check for mobile user agent
  const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

  // Check for touch-only device (no fine pointer like a mouse)
  const isTouchOnly = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches

  // Must be both mobile UA and small screen, OR touch-only with small screen
  const isSmall = window.innerWidth < 768
  return isSmall && (isMobileUA || isTouchOnly)
}
