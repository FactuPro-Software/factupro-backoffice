import { Badge } from '@/components/ui/badge';

interface PlanBadgeProps {
  planName: string;
  editable: boolean;
}

/** Eligible (trial/digital_kit) plans get the brand-soft treatment; everything else is muted. */
export function PlanBadge({ planName, editable }: PlanBadgeProps) {
  return editable ? (
    <Badge className="bg-brand-soft text-foreground">{planName}</Badge>
  ) : (
    <Badge variant="secondary">{planName}</Badge>
  );
}
