// Summer ChatBot app logo icon. Was a blue tile with an "S" letter; now uses
// the mentor illustration from public/avatar-mentor.jpg with the same trick
// as Martina's avatar — the image is scaled up inside a fixed-size rounded
// container so the face fills the frame regardless of source aspect ratio.

interface AppIconProps {
  size?: "sm" | "md" | "lg";
}

const SIZE_TO_CLASSES: Record<NonNullable<AppIconProps["size"]>, { box: string }> = {
  sm: { box: "w-10 h-10 rounded-xl" },
  md: { box: "w-12 h-12 rounded-2xl" },
  lg: { box: "w-16 h-16 rounded-3xl" },
};

export function AppIcon({ size = "sm" }: AppIconProps) {
  const { box } = SIZE_TO_CLASSES[size];
  return (
    <div className={`${box} overflow-hidden bg-summer-blue flex-shrink-0 shadow-sm`}>
      <img
        src="/avatar-mentor.jpg"
        alt="Summer ChatBot"
        className="w-full h-full object-cover"
        style={{ transform: "scale(1.7)", transformOrigin: "50% 30%" }}
      />
    </div>
  );
}
