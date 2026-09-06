// Node-only CPU verification loader; the production browser uses Vite resolution.
export async function resolve(specifier,context,next){try{return await next(specifier,context)}catch(error){if(error.code==='ERR_MODULE_NOT_FOUND'&&/^\.\.?\//.test(specifier)&&! /\.[a-z]+$/i.test(specifier))return next(specifier+'.ts',context);throw error}}
