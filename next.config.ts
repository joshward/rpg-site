import type { NextConfig } from 'next';
import { withPlausibleProxy } from 'next-plausible';

const nextConfig: NextConfig = {
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default withPlausibleProxy({
  src: 'https://plausible.io/js/pa-IPpbfnj0EHCGbPErvYox1.js',
})(nextConfig);
