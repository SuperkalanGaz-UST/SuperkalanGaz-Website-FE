import { ChevronDown } from 'lucide-react';

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

export function Select({ value, onChange, options, placeholder, className = '' }: SelectProps) {
  // Check if current value is a placeholder/default value (contains "All" or is the first option in filter contexts)
  const isPlaceholderValue = value === 'all' ||
                             value.toLowerCase().includes('all') ||
                             (options[0]?.value === value && options[0]?.label.toLowerCase().includes('all'));

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none bg-white cursor-pointer text-sm ${
          isPlaceholderValue ? 'text-gray-500' : 'text-gray-900'
        } ${className}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className={`w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
        isPlaceholderValue ? 'text-gray-500' : 'text-gray-900'
      }`} />
    </div>
  );
}
