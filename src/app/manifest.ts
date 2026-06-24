import type { MetadataRoute } from "next";

/**
 * PWA web manifest (served at /manifest.webmanifest). Drives the "Add to Home Screen" icon + label on
 * Android/Chrome. iOS uses the apple-touch-icon + appleWebApp metadata (see src/app/layout.tsx).
 * The /manifest.webmanifest path is excluded from the proxy matcher so it stays publicly fetchable.
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Quill & Compass",
        short_name: "Quill & Compass",
        description:
            "Calm, grounded homeschooling: AI curriculum, a living library, and family discipleship in one place.",
        start_url: "/",
        display: "standalone",
        background_color: "#F9F5EF",
        theme_color: "#3A3F76",
        icons: [
            {
                src: "/assets/branding/icons/icon-192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/assets/branding/icons/icon-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/assets/branding/icons/icon-192-maskable.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "maskable",
            },
            {
                src: "/assets/branding/icons/icon-512-maskable.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
        ],
    };
}
