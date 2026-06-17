interface ResourceCardProps {
  name: string;
  contact: string;
  hours: string;
  description: string;
}

export function ResourceCard({
  name,
  contact,
  hours,
  description,
}: ResourceCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <p className="font-semibold text-sm">{name}</p>
      <p className="text-blue-600 font-mono text-sm mt-1">{contact}</p>
      <p className="text-xs text-gray-500 mt-1">{hours}</p>
      <p className="text-xs text-gray-700 mt-2">{description}</p>
    </div>
  );
}
