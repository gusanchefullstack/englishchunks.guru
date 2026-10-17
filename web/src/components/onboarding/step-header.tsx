import { Progress } from "@/components/ui/progress";

export function StepHeader({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-10">
      <div className="flex justify-end">
        <p className="text-muted-foreground text-sm">Step {step} of 2</p>
      </div>
      <Progress value={step * 50} aria-label={`Step ${step} of 2`} className="mt-2 h-1" />
    </div>
  );
}
