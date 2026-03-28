import type { Preview } from '@storybook/nextjs-vite';
import { withThemeByClassName } from '@storybook/addon-themes';

import { fontStyles, baseStyles } from '../src/app/styles';
import './storybook-styles.css';
import { twJoin } from 'tailwind-merge';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },
  },
  decorators: [
    withThemeByClassName({
      themes: {
        light: 'light',
        dark: 'dark',
      },
      defaultTheme: 'dark',
    }),
    (Story) => (
      <div className={twJoin(fontStyles, baseStyles)}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
