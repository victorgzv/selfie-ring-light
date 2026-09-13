/**
 * NativeWind ships the `className` typings but not a declaration for importing
 * the stylesheet itself, and TypeScript 6 rejects an untyped side-effect import.
 */
declare module '*.css';
