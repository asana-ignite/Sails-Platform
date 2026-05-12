/**
 * INIDOS Utils
 */

/**
 * Utility for joining class names.
 */
export const classNames = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
};
