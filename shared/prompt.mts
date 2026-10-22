// A prompt template with its `{{KEY}}` placeholders filled: sandcastle's `resume` takes prompt text, never a prompt file.
export const fillPrompt = (template: string, args: Readonly<Record<string, string>>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = args[key];
    if (value === undefined) throw new Error(`prompt argument {{${key}}} has no value`);
    return value;
  });
