export async function resolve(specifier,context,nextResolve) {
  if(specifier==='pg') return {url:new URL('./pglite-driver.mjs',import.meta.url).href,shortCircuit:true};
  return nextResolve(specifier,context);
}
