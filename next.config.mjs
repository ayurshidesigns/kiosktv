/** @type {import('next').NextConfig} */
export default {
  async rewrites() {
    return [
      { source: '/', destination: '/player.html' },   // TV player lives at the site root
      { source: '/admin', destination: '/admin.html' },
    ];
  },
};
