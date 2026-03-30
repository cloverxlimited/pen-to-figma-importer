import esbuild from 'esbuild'

const watch = process.argv.includes('--watch')

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  target: 'es2015',
  format: 'iife',
  logLevel: 'info',
})

if (watch) {
  await ctx.watch()
  console.log('Watching for changes...')
} else {
  await ctx.rebuild()
  await ctx.dispose()
  console.log('Build complete.')
}
