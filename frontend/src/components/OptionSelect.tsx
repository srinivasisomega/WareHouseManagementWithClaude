import type { ControlProps } from './FormField'

export interface Option {
  value: number
  label: string
}

interface OptionSelectProps extends ControlProps {
  value: number | ''
  options: Option[]
  placeholder: string
  onChange: (value: number | '') => void
  disabled?: boolean
}

/** Numeric-id select used for item and location pickers. */
export function OptionSelect({ value, options, placeholder, onChange, disabled, ...control }: OptionSelectProps) {
  return (
    <select
      {...control}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
