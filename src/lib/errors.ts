/** A problem the person can fix: its message is safe to show as it is. */
export class InputError extends Error {
  constructor(message: string) { super(message); this.name = 'InputError'; }
}
