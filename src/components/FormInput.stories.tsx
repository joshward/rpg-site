import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FormInput } from './FormInput';
import { useForm } from '@tanstack/react-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import * as v from 'valibot';
import Button from './Button';
import Paper from './Paper';

const meta = {
  title: 'Components/FormInput',
  component: FormInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof FormInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter your username',
    description: 'This is the name people will see you as.',
  },
};

export const WithError: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter your username',
    error: 'Username is already taken.',
    invalid: true,
  },
};

export const Disabled: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter your username',
    disabled: true,
    description: 'You cannot change your username at this time.',
  },
};

// Full Form Example
const SimpleSchema = v.object({
  username: v.pipe(
    v.string(),
    v.minLength(3, 'Username must be at least 3 characters'),
    v.maxLength(20, 'Username must be at most 20 characters'),
  ),
  email: v.pipe(v.string(), v.email('Invalid email address')),
});

export const FunctionalForm: Story = {
  render: () => {
    const form = useForm({
      defaultValues: {
        username: '',
        email: '',
      },
      onSubmit: async ({ value }) => {
        alert(JSON.stringify(value, null, 2));
      },
    });

    const usernameValidator = v.pipe(
      v.string(),
      v.minLength(3, 'Username must be at least 3 characters'),
      v.maxLength(20, 'Username must be at most 20 characters'),
    );

    const emailValidator = v.pipe(v.string(), v.email('Invalid email address'));

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
            name="username"
            validators={{
              onChange: ({ value }) => {
                const result = v.safeParse(usernameValidator, value);
                return result.success ? undefined : result.issues[0].message;
              },
            }}
          >
            {(field) => (
              <FormInput
                label="Username"
                placeholder="Type username..."
                description="3-20 characters long."
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                error={field.state.meta.errors.join(', ')}
                invalid={field.state.meta.errors.length > 0}
              />
            )}
          </form.Field>

          <form.Field
            name="email"
            validators={{
              onChange: ({ value }) => {
                const result = v.safeParse(emailValidator, value);
                return result.success ? undefined : result.issues[0].message;
              },
            }}
          >
            {(field) => (
              <FormInput
                label="Email"
                placeholder="your@email.com"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
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
