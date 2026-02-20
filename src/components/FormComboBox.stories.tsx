import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FormComboBox } from './FormComboBox';
import { useForm } from '@tanstack/react-form';
import * as v from 'valibot';
import Button from './Button';
import Paper from './Paper';
import { ComboboxOption } from './Combobox';

const meta = {
  title: 'Components/FormComboBox',
  component: FormComboBox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    multiple: { control: 'boolean' },
  },
} satisfies Meta<typeof FormComboBox>;

export default meta;
type Story = StoryObj<typeof meta>;

const languages = [
  { id: 'js', label: 'JavaScript' },
  { id: 'ts', label: 'TypeScript' },
  { id: 'py', label: 'Python' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
];

export const Default: Story = {
  args: {
    label: 'Preferred Language',
    items: languages,
    placeholder: 'Select a language',
    description: 'Choose the language you use most often.',
  },
};

export const Multiple: Story = {
  args: {
    label: 'Languages',
    items: languages,
    multiple: true,
    placeholder: 'Select languages',
    description: 'Select all languages you are proficient in.',
  },
};

export const WithError: Story = {
  args: {
    label: 'Preferred Language',
    items: languages,
    placeholder: 'Select a language',
    error: 'Please select a language from the list.',
    invalid: true,
  },
};

export const Disabled: Story = {
  args: {
    label: 'Preferred Language',
    items: languages,
    placeholder: 'Select a language',
    disabled: true,
    description: 'Selection is disabled.',
  },
};

export const FunctionalForm: Story = {
  render: () => {
    const form = useForm({
      defaultValues: {
        role: null as ComboboxOption | null,
        tags: [] as ComboboxOption[],
      },
      onSubmit: async ({ value }) => {
        alert(JSON.stringify(value, null, 2));
      },
    });

    const roleValidator = v.pipe(
      v.nullable(v.object({ id: v.union([v.string(), v.number()]), label: v.string() })),
      v.check((val) => val !== null, 'Please select a role'),
    );

    const tagsValidator = v.pipe(
      v.array(v.object({ id: v.union([v.string(), v.number()]), label: v.string() })),
      v.minLength(1, 'Please select at least one tag'),
    );

    return (
      <Paper className="w-[400px]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <form.Field
            name="role"
            validators={{
              onChange: ({ value }) => {
                const result = v.safeParse(roleValidator, value);
                return result.success ? undefined : result.issues[0].message;
              },
            }}
          >
            {(field) => (
              <FormComboBox
                label="Primary Role"
                items={languages}
                placeholder="Select role..."
                value={field.state.value}
                onValueChange={(val) => field.handleChange(val as ComboboxOption | null)}
                error={field.state.meta.errors.join(', ')}
                invalid={field.state.meta.errors.length > 0}
              />
            )}
          </form.Field>

          <form.Field
            name="tags"
            validators={{
              onChange: ({ value }) => {
                const result = v.safeParse(tagsValidator, value);
                return result.success ? undefined : result.issues[0].message;
              },
            }}
          >
            {(field) => (
              <FormComboBox
                label="Skills"
                multiple
                items={languages}
                placeholder="Select skills..."
                value={field.state.value}
                onValueChange={(val) => field.handleChange(val as ComboboxOption[])}
                error={field.state.meta.errors.join(', ')}
                invalid={field.state.meta.errors.length > 0}
              />
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
            children={([canSubmit, isSubmitting]) => (
              <Button type="submit" disabled={!canSubmit} loading={isSubmitting}>
                Submit
              </Button>
            )}
          />
        </form>
      </Paper>
    );
  },
};
