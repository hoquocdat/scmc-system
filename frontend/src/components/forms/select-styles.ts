// Custom styles for react-select to match Shadcn UI
export const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: '36px',
    borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
    boxShadow: state.isFocused ? '0 0 0 1px hsl(var(--ring))' : 'none',
    '&:hover': {
      borderColor: 'hsl(var(--input))',
    },
    backgroundColor: 'transparent',
  }),
  menu: (base: any) => ({
    ...base,
    zIndex: 100,
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isFocused ? 'hsl(var(--accent))' : 'transparent',
    color: state.isFocused ? 'hsl(var(--accent-foreground))' : 'inherit',
    '&:active': {
      backgroundColor: 'hsl(var(--accent))',
    },
  }),
  multiValue: (base: any) => ({
    ...base,
    backgroundColor: 'hsl(var(--secondary))',
  }),
  multiValueLabel: (base: any) => ({
    ...base,
    color: 'hsl(var(--secondary-foreground))',
  }),
  multiValueRemove: (base: any) => ({
    ...base,
    color: 'hsl(var(--secondary-foreground))',
    '&:hover': {
      backgroundColor: 'hsl(var(--secondary))',
      color: 'hsl(var(--foreground))',
    },
  }),
};
