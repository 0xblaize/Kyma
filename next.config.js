const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  // Pin the workspace root to this project so Next stops warning about the
  // stray package-lock.json in the home directory.
  turbopack: {
    root: path.join(__dirname),
  },
}
module.exports = nextConfig
