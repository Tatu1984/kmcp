// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /**
//    * Dev-only: Next blocks cross-origin requests to /_next/* by default, so a
//    * tunnelled host gets the HTML and then 403s on every chunk — the page
//    * renders its shell and never hydrates. Free ngrok rotates the subdomain on
//    * each restart, hence the wildcard rather than one pinned host.
//    */
//   allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.app", "*.ngrok.io"],
// };

// export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Dev-only: Next blocks cross-origin requests to /_next/* by default, so a
   * tunnelled host gets the HTML and then 403s on every chunk — the page
   * renders its shell and never hydrates. Free ngrok rotates the subdomain on
   * each restart, hence the wildcard rather than one pinned host.
   */
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.app", "*.ngrok.io"],
};

export default nextConfig;
