import { FranchiseDropdown } from '../../components/FranchiseDropdown';

export function ReportFilterDropdown({ label, value, onChange, options, sizingClassName = 'rounded-lg border border-gray-200 px-3 py-2 text-sm' }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  sizingClassName?: string;
}) {
  return (
    <div className="relative inline-block max-w-full">
      {/* Preserve the original native filter's size while styling its menu. */}
      <select aria-hidden="true" tabIndex={-1} defaultValue={options[0]?.value}
        className={`pointer-events-none invisible block ${sizingClassName}`}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <div className="absolute inset-0">
        <FranchiseDropdown
          aria-label={label}
          value={value}
          onChange={onChange}
          options={options}
          matchTriggerWidth
          wrapperClassName="h-full"
          className="h-full px-3"
        />
      </div>
    </div>
  );
}
