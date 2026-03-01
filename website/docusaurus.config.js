const { themes: prismThemes } = require('prism-react-renderer');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'slogx docs',
  tagline: 'Structured logs for local and CI workflows',
  favicon: 'img/icon.png',
  url: 'https://binhonglee.github.io',
  baseUrl: '/slogx/docs/',
  organizationName: 'binhonglee',
  projectName: 'slogx',
  trailingSlash: false,
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'throw',
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/binhonglee/slogx/tree/main/website/',
        },
        blog: false,
        pages: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],
  themeConfig: {
    image: 'img/icon.png',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'slogx',
      logo: {
        alt: 'slogx',
        src: 'img/icon.png',
      },
      items: [
        { to: '/', label: 'Docs', position: 'left' },
        { to: '/sdks', label: 'SDKs', position: 'left' },
        {
          href: 'https://binhonglee.github.io/slogx/app',
          label: 'Live Viewer',
          position: 'right',
        },
        {
          href: 'https://binhonglee.github.io/slogx/replay',
          label: 'Replay Viewer',
          position: 'right',
        },
        {
          href: 'https://github.com/binhonglee/slogx',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Product',
          items: [
            { label: 'Docs', to: '/' },
            { label: 'Live Viewer', href: 'https://binhonglee.github.io/slogx/app' },
            { label: 'Replay Viewer', href: 'https://binhonglee.github.io/slogx/replay' },
          ],
        },
        {
          title: 'Source',
          items: [
            { label: 'Repository', href: 'https://github.com/binhonglee/slogx' },
            { label: 'GitHub Action', href: 'https://github.com/binhonglee/slogx/tree/main/replay' },
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} slogx`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.nightOwl,
      additionalLanguages: ['go', 'rust', 'python', 'json'],
    },
  },
};

module.exports = config;
