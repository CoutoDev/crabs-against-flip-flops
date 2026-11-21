import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  prettier,
  {
    files: ['src/domain/**/*.ts', 'src/application/**/*.ts'],
    rules: {
      // Clean Architecture: domain and application must not know about the DOM or the framework layers.
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Domain/application must not touch the DOM.' },
        { name: 'document', message: 'Domain/application must not touch the DOM.' },
        { name: 'localStorage', message: 'Use a repository port instead.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the Rng port (deterministic in tests).',
        },
        { object: 'Date', property: 'now', message: 'Pass time in explicitly (fixed timestep).' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/**', '**/ui/**', '**/data/**'],
              message: 'Dependencies point inwards: domain/application cannot import outer layers.',
            },
          ],
        },
      ],
    },
  },
);
