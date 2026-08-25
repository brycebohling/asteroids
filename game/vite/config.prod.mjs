import { defineConfig } from 'vite';

const phasermsg = () => {
    return {
        name: 'phasermsg',
        buildStart() {
            process.stdout.write(`Building for production...\n`);
        },
        buildEnd() {
            const line = "---------------------------------------------------------";
            const msg = `❤️❤️❤️ Tell us about your game! - games@phaser.io ❤️❤️❤️`;
            process.stdout.write(`${line}\n${msg}\n${line}\n`);
            
            process.stdout.write(`✨ Done ✨\n`);
        }
    }
}   

export default defineConfig({
    base: './',
    logLevel: 'warning',
    build: {
        rollupOptions: {
            output: {
                // rolldown-vite requires a function here; the object form the
                // Phaser template shipped fails with "manualChunks is not a
                // function" at build time.
                manualChunks: (id) => (id.includes('node_modules/phaser') ? 'phaser' : undefined)
            }
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                passes: 2
            },
            mangle: true,
            format: {
                comments: false
            }
        }
    },
    server: {
        port: 8080
    },
    plugins: [
        phasermsg()
    ]
});
