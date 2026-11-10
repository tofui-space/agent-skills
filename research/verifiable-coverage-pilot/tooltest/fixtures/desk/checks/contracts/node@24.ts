import { parseArgs } from 'node:util'

export const contract = {
  package: 'node',
  version: '24',
  members: {
    parseArgs: {
      throws: [
        {
          error: TypeError,
          when: 'the words do not fit the declared options',
          provoke: () => parseArgs({ args: ['--shelf'], options: {} }),
        },
      ],
      ensures: [],
    },
  },
}
