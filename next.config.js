/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone", // needed for the Docker/Railway deploy (see Dockerfile)
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
  },
};

module.exports = nextConfig;
