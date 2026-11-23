/** Source of the bundled chunk worker, inlined by scripts/build.mjs ('' when unavailable). */
declare module 'virtual:worker' {
  const source: string;
  export default source;
}

declare module '*.png' {
  const url: string;
  export default url;
}

declare module '*.css' {
  const css: string;
  export default css;
}
