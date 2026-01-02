"use client";

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({
  password,
}: PasswordStrengthIndicatorProps) {
  // Calculate password strength based on criteria
  const calculateStrength = (pwd: string): number => {
    let score = 0;

    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    return score;
  };

  const strength = calculateStrength(password);

  // Determine strength level and color
  const getStrengthData = (score: number) => {
    if (score === 0) {
      return { level: "Weak", color: "bg-red-500", bars: 0 };
    }
    if (score === 1) {
      return { level: "Weak", color: "bg-red-500", bars: 1 };
    }
    if (score === 2) {
      return { level: "Fair", color: "bg-orange-500", bars: 2 };
    }
    if (score === 3) {
      return { level: "Good", color: "bg-yellow-500", bars: 3 };
    }
    return { level: "Strong", color: "bg-green-500", bars: 4 };
  };

  const strengthData = getStrengthData(strength);

  return (
    <div className="w-full space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((bar) => (
          <div
            key={bar}
            className={`h-2 flex-1 rounded-full transition-colors ${
              bar <= strengthData.bars ? strengthData.color : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      {password && (
        <p className="text-sm font-medium text-gray-700">
          {strengthData.level}
        </p>
      )}
    </div>
  );
}
